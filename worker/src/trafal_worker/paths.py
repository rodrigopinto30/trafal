import re
import unicodedata

from .errors import ErrorCode, UploadRejected
from .rules import UploadRules

_DRIVE_PREFIX = re.compile(r"^[A-Za-z]:")
_FORBIDDEN_CATEGORIES = frozenset({"Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp"})
_DISPLAY_LIMIT = 120


def display_path(name: str) -> str:
    """Versión de una ruta apta para mostrar en un mensaje: sin caracteres de control y con largo acotado."""
    cleaned = "".join("�" if unicodedata.category(char) in _FORBIDDEN_CATEGORIES else char for char in name)
    return cleaned[:_DISPLAY_LIMIT]


def check_safe_path(name: str, rules: UploadRules) -> str:
    """Devuelve la ruta sin la barra final de los directorios, o rechaza el zip si puede escapar de su carpeta."""
    path = name.removesuffix("/")
    if not path or path.startswith("/") or "\\" in path or _DRIVE_PREFIX.match(path):
        raise UploadRejected(ErrorCode.UNSAFE_PATH, path=display_path(name))
    if any(unicodedata.category(char) in _FORBIDDEN_CATEGORIES for char in path):
        raise UploadRejected(ErrorCode.UNSAFE_PATH, path=display_path(name))
    if any(part in {"", ".", ".."} for part in path.split("/")):
        raise UploadRejected(ErrorCode.UNSAFE_PATH, path=display_path(name))
    if len(path) > rules.limits.max_path_length:
        raise UploadRejected(ErrorCode.PATH_TOO_LONG, path=display_path(name), limit=rules.limits.max_path_length)
    return path


def is_ignored(path: str, rules: UploadRules) -> bool:
    """Basura que dejan el sistema operativo o el compresor (__MACOSX, .DS_Store, ._*): se descarta sin avisar."""
    parts = path.split("/")
    if any(part in rules.ignored_directories for part in parts):
        return True
    name = parts[-1]
    return name in rules.ignored_names or name.startswith(rules.ignored_name_prefixes)


def comparison_key(path: str) -> str:
    """Clave para detectar rutas que en otro sistema serían la misma (mayúsculas, Unicode compuesto o descompuesto)."""
    return unicodedata.normalize("NFC", path).casefold()


def effective_extension(name: str, rules: UploadRules) -> str:
    """Extensión que decide si el archivo está permitido. En «juego.wasm.br» es «wasm»; «br» solo no vale."""
    parts = name.lower().split(".")
    if len(parts) < 2 or (len(parts) == 2 and not parts[0]):
        return ""
    extension = parts[-1]
    if extension in rules.compressed_suffixes and len(parts) >= 3 and parts[-2]:
        return parts[-2]
    return extension


def check_extension(path: str, rules: UploadRules) -> None:
    """Rechaza ejecutables, comprimidos anidados y todo lo que no esté en la lista de extensiones permitidas."""
    extension = effective_extension(path.rsplit("/", 1)[-1], rules)
    if extension in rules.executable_extensions:
        raise UploadRejected(ErrorCode.EXECUTABLE_FILE, path=display_path(path), extension=extension)
    if extension in rules.archive_extensions:
        raise UploadRejected(ErrorCode.NESTED_ARCHIVE, path=display_path(path), extension=extension)
    if extension not in rules.allowed_extensions:
        raise UploadRejected(ErrorCode.EXTENSION_NOT_ALLOWED, path=display_path(path), extension=extension)
