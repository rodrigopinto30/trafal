import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

RULES_ENV_VAR = "TRAFAL_UPLOAD_RULES"
RULES_RELATIVE_PATH = Path("packages") / "shared" / "upload-rules.json"


@dataclass(frozen=True)
class Limits:
    """Topes del zip, medidos en bytes, archivos y caracteres."""

    max_zip_bytes: int
    max_uncompressed_bytes: int
    max_files: int
    max_entries: int
    max_file_bytes: int
    max_path_length: int


@dataclass(frozen=True)
class MagicSignature:
    """Primeros bytes que delatan un tipo de archivo, sin importar su extensión."""

    name: str
    prefix: bytes


@dataclass(frozen=True)
class ScanRules:
    """Qué archivos se revisan en busca de señales sospechosas y qué texto marca cada señal."""

    extensions: frozenset[str]
    max_bytes_per_file: int
    signatures: Mapping[str, tuple[bytes, ...]]


@dataclass(frozen=True)
class UploadRules:
    """Reglas de subida de juegos. La fuente única es packages/shared/upload-rules.json."""

    limits: Limits
    required_files: tuple[str, ...]
    ignored_directories: frozenset[str]
    ignored_names: frozenset[str]
    ignored_name_prefixes: tuple[str, ...]
    allowed_extensions: frozenset[str]
    compressed_suffixes: frozenset[str]
    executable_extensions: frozenset[str]
    archive_extensions: frozenset[str]
    executable_magic: tuple[MagicSignature, ...]
    archive_magic: tuple[MagicSignature, ...]
    scan: ScanRules
    error_codes: frozenset[str]


def _magic(items: list[dict[str, str]]) -> tuple[MagicSignature, ...]:
    return tuple(MagicSignature(item["name"], bytes.fromhex(item["hex"])) for item in items)


def parse_rules(data: Mapping[str, Any]) -> UploadRules:
    """Convierte el JSON compartido en reglas tipadas. Falla si falta algo: un valor por defecto escondería un error."""
    limits = data["limits"]
    scan = data["scan"]
    ignored = data["ignored"]
    return UploadRules(
        limits=Limits(
            max_zip_bytes=int(limits["maxZipBytes"]),
            max_uncompressed_bytes=int(limits["maxUncompressedBytes"]),
            max_files=int(limits["maxFiles"]),
            max_entries=int(limits["maxEntries"]),
            max_file_bytes=int(limits["maxFileBytes"]),
            max_path_length=int(limits["maxPathLength"]),
        ),
        required_files=tuple(data["requiredFiles"]),
        ignored_directories=frozenset(ignored["directories"]),
        ignored_names=frozenset(ignored["names"]),
        ignored_name_prefixes=tuple(ignored["namePrefixes"]),
        allowed_extensions=frozenset(data["allowedExtensions"]),
        compressed_suffixes=frozenset(data["compressedSuffixes"]),
        executable_extensions=frozenset(data["executableExtensions"]),
        archive_extensions=frozenset(data["archiveExtensions"]),
        executable_magic=_magic(data["executableMagic"]),
        archive_magic=_magic(data["archiveMagic"]),
        scan=ScanRules(
            extensions=frozenset(scan["extensions"]),
            max_bytes_per_file=int(scan["maxBytesPerFile"]),
            signatures={
                flag: tuple(pattern.lower().encode("utf-8") for pattern in patterns)
                for flag, patterns in scan["signatures"].items()
            },
        ),
        error_codes=frozenset(data["errorCodes"]),
    )


def default_rules_path() -> Path:
    """Ruta del JSON: la variable TRAFAL_UPLOAD_RULES o, si no está, la del repositorio."""
    override = os.environ.get(RULES_ENV_VAR)
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[3] / RULES_RELATIVE_PATH


def load_rules(path: Path | None = None) -> UploadRules:
    """Lee las reglas de subida desde el JSON compartido."""
    raw = (path or default_rules_path()).read_text(encoding="utf-8")
    return parse_rules(cast(Mapping[str, Any], json.loads(raw)))
