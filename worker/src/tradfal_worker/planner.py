import stat
import zipfile
from dataclasses import dataclass

from .errors import ErrorCode, UploadRejected
from .paths import check_extension, check_safe_path, comparison_key, display_path, is_ignored
from .rules import UploadRules

_LOCAL_HEADER_BYTES = 30
_ENCRYPTED_FLAG = 0x1
_FAT_REPARSE_POINT = 0x400
_UNIX = 3
_SUPPORTED_METHODS = frozenset({zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED})
_REGULAR_TYPES = frozenset({0, stat.S_IFREG, stat.S_IFDIR})


@dataclass(frozen=True)
class PlannedFile:
    """Un archivo que se va a publicar: su nombre dentro del zip, su ruta final y su entrada del directorio central."""

    source: str
    target: str
    info: zipfile.ZipInfo


@dataclass(frozen=True)
class ArchivePlan:
    """Resultado de revisar el directorio central, sin haber descomprimido nada todavía."""

    files: tuple[PlannedFile, ...]
    stripped_prefix: str
    declared_bytes: int


def _check_entry_kind(info: zipfile.ZipInfo) -> None:
    if info.flag_bits & _ENCRYPTED_FLAG:
        raise UploadRejected(ErrorCode.ENCRYPTED_ENTRY, path=display_path(info.filename))
    if info.compress_type not in _SUPPORTED_METHODS:
        raise UploadRejected(ErrorCode.UNSUPPORTED_COMPRESSION, path=display_path(info.filename))
    file_type = stat.S_IFMT(info.external_attr >> 16) if info.create_system == _UNIX else 0
    if file_type == stat.S_IFLNK or (info.create_system == 0 and info.external_attr & _FAT_REPARSE_POINT):
        raise UploadRejected(ErrorCode.SYMLINK_NOT_ALLOWED, path=display_path(info.filename))
    if file_type not in _REGULAR_TYPES:
        raise UploadRejected(ErrorCode.SPECIAL_FILE, path=display_path(info.filename))


def check_no_overlaps(infos: list[zipfile.ZipInfo], data_end: int) -> None:
    """
    Rechaza entradas que se pisan entre sí. Es la forma de armar un zip-bomb sin crecer en disco: muchas entradas que
    apuntan a los mismos bytes comprimidos y se descomprimen cada una por separado. Solo usa cotas inferiores del
    tamaño del encabezado local, así nunca rechaza un zip legítimo.
    """
    ordered = sorted(infos, key=lambda info: info.header_offset)
    for index, current in enumerate(ordered):
        end = current.header_offset + _LOCAL_HEADER_BYTES + len(current.filename) + current.compress_size
        limit = ordered[index + 1].header_offset if index + 1 < len(ordered) else data_end
        if end > limit:
            raise UploadRejected(ErrorCode.OVERLAPPING_ENTRIES, path=display_path(current.filename))


def _strip_single_folder(paths: list[str]) -> str:
    firsts = {path.split("/", 1)[0] for path in paths}
    if len(firsts) == 1 and all("/" in path for path in paths):
        return f"{next(iter(firsts))}/"
    return ""


def plan_archive(infos: list[zipfile.ZipInfo], data_end: int, rules: UploadRules) -> ArchivePlan:
    """
    Revisa cada entrada del directorio central contra las reglas, sin descomprimir. Descarta la basura del sistema,
    aplana la carpeta única que envuelve a todo y exige los archivos obligatorios en la raíz.
    """
    limits = rules.limits
    check_no_overlaps(infos, data_end)
    selected: list[tuple[str, zipfile.ZipInfo]] = []
    file_keys: set[str] = set()
    directory_keys: set[str] = set()
    declared_bytes = 0
    for info in infos:
        _check_entry_kind(info)
        path = check_safe_path(info.filename, rules)
        if is_ignored(path, rules):
            continue
        key = comparison_key(path)
        if info.is_dir():
            directory_keys.add(key)
            continue
        check_extension(path, rules)
        if key in file_keys:
            raise UploadRejected(ErrorCode.DUPLICATE_PATH, path=display_path(path))
        if info.file_size > limits.max_file_bytes:
            raise UploadRejected(ErrorCode.FILE_TOO_LARGE, path=display_path(path), limit=limits.max_file_bytes)
        declared_bytes += info.file_size
        if declared_bytes > limits.max_uncompressed_bytes:
            raise UploadRejected(ErrorCode.UNCOMPRESSED_TOO_LARGE, limit=limits.max_uncompressed_bytes)
        file_keys.add(key)
        selected.append((path, info))
        if len(selected) > limits.max_files:
            raise UploadRejected(ErrorCode.TOO_MANY_FILES, limit=limits.max_files)
    _check_no_file_directory_clash(file_keys, directory_keys)
    prefix = _strip_single_folder([path for path, _ in selected]) if selected else ""
    files = tuple(PlannedFile(path, path.removeprefix(prefix), info) for path, info in selected)
    targets = {file.target for file in files}
    for required in rules.required_files:
        if required not in targets:
            raise UploadRejected(ErrorCode.NO_INDEX_HTML, file=required)
    return ArchivePlan(files=files, stripped_prefix=prefix, declared_bytes=declared_bytes)


def _check_no_file_directory_clash(file_keys: set[str], directory_keys: set[str]) -> None:
    parents = set(directory_keys)
    for key in file_keys:
        parts = key.split("/")
        parents.update("/".join(parts[:end]) for end in range(1, len(parts)))
    clash = file_keys & parents
    if clash:
        raise UploadRejected(ErrorCode.PATH_CONFLICT, path=display_path(min(clash)))
