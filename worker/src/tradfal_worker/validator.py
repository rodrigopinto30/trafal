import os
import zipfile
from dataclasses import dataclass
from pathlib import Path

from .central_directory import locate_central_directory
from .errors import ErrorCode, UploadRejected
from .planner import plan_archive
from .rules import UploadRules
from .verifier import NullSink, Sink, stream_verified


@dataclass(frozen=True)
class ValidationReport:
    """Qué contiene un zip que pasó todas las reglas."""

    zip_bytes: int
    file_count: int
    unpacked_bytes: int
    stripped_prefix: str
    files: tuple[str, ...]
    scan_flags: tuple[str, ...]


def validate_archive(path: Path, rules: UploadRules, sink: Sink | None = None) -> ValidationReport:
    """
    Valida un zip subido por alguien desconocido y, si se pasa un destino, entrega ahí sus archivos ya verificados.
    El orden importa: primero el tamaño real del archivo, luego el directorio central (sin descomprimir), y recién
    después la descompresión con topes sobre los bytes reales. Lanza UploadRejected con un código estable.
    """
    destination = sink if sink is not None else NullSink()
    with path.open("rb") as file:
        zip_bytes = os.fstat(file.fileno()).st_size
        if zip_bytes > rules.limits.max_zip_bytes:
            raise UploadRejected(ErrorCode.ZIP_TOO_LARGE, limit=rules.limits.max_zip_bytes)
        directory = locate_central_directory(file, zip_bytes, rules.limits.max_entries)
        try:
            archive = zipfile.ZipFile(file)
        except zipfile.BadZipFile as error:
            raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE) from error
        with archive:
            plan = plan_archive(archive.infolist(), directory.start, rules)
            result = stream_verified(archive, plan, rules, destination)
    return ValidationReport(
        zip_bytes=zip_bytes,
        file_count=len(plan.files),
        unpacked_bytes=result.unpacked_bytes,
        stripped_prefix=plan.stripped_prefix,
        files=tuple(file.target for file in plan.files),
        scan_flags=result.scan_flags,
    )
