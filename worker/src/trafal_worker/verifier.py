import struct
import zipfile
import zlib
from dataclasses import dataclass
from typing import Protocol

from .errors import ErrorCode, UploadRejected
from .paths import display_path, effective_extension
from .planner import ArchivePlan, PlannedFile
from .rules import UploadRules
from .scanner import SignatureScanner, forbidden_content

CHUNK_BYTES = 64 * 1024
_HEAD_BYTES = 64
_CORRUPTION_ERRORS = (zipfile.BadZipFile, zlib.error, EOFError, NotImplementedError, RuntimeError, struct.error)


class Sink(Protocol):
    """Destino de los bytes ya verificados. El worker lo usa para escribirlos en una carpeta temporal."""

    def begin(self, file: PlannedFile) -> None: ...

    def write(self, chunk: bytes) -> None: ...

    def end(self, file: PlannedFile) -> None: ...


class NullSink:
    """Destino que descarta todo: sirve para validar un zip sin extraerlo."""

    def begin(self, file: PlannedFile) -> None:
        return None

    def write(self, chunk: bytes) -> None:
        return None

    def end(self, file: PlannedFile) -> None:
        return None


@dataclass(frozen=True)
class StreamResult:
    """Lo que se midió de verdad al descomprimir: bytes reales y marcas de revisión."""

    unpacked_bytes: int
    scan_flags: tuple[str, ...]


def stream_verified(archive: zipfile.ZipFile, plan: ArchivePlan, rules: UploadRules, sink: Sink) -> StreamResult:
    """
    Descomprime cada archivo del plan contando los bytes REALES (el tamaño declarado en el zip no es de fiar), revisa
    los primeros bytes de cada uno y entrega los trozos al destino. Si algo falla, el llamador debe descartar todo lo
    que el destino haya recibido: nada se publica hasta que esta función termina sin error.
    """
    limits = rules.limits
    unpacked = 0
    flags: set[str] = set()
    for file in plan.files:
        scanner = _scanner_for(file, rules)
        sink.begin(file)
        file_bytes = 0
        try:
            with archive.open(file.info) as source:
                while chunk := source.read(CHUNK_BYTES):
                    if file_bytes == 0:
                        forbidden_content(chunk[:_HEAD_BYTES], file.info.file_size, rules, display_path(file.source))
                    file_bytes += len(chunk)
                    unpacked += len(chunk)
                    if file_bytes > limits.max_file_bytes:
                        raise UploadRejected(
                            ErrorCode.FILE_TOO_LARGE, path=display_path(file.source), limit=limits.max_file_bytes
                        )
                    if unpacked > limits.max_uncompressed_bytes:
                        raise UploadRejected(ErrorCode.UNCOMPRESSED_TOO_LARGE, limit=limits.max_uncompressed_bytes)
                    if scanner is not None:
                        scanner.feed(chunk)
                    sink.write(chunk)
        except _CORRUPTION_ERRORS as error:
            raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE, path=display_path(file.source)) from error
        if file_bytes != file.info.file_size:
            raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE, path=display_path(file.source))
        sink.end(file)
        if scanner is not None:
            flags |= scanner.flags
    return StreamResult(unpacked_bytes=unpacked, scan_flags=tuple(sorted(flags)))


def _scanner_for(file: PlannedFile, rules: UploadRules) -> SignatureScanner | None:
    if effective_extension(file.target.rsplit("/", 1)[-1], rules) not in rules.scan.extensions:
        return None
    if file.target.lower().endswith(tuple(f".{suffix}" for suffix in rules.compressed_suffixes)):
        return None
    return SignatureScanner(rules.scan.signatures, rules.scan.max_bytes_per_file)
