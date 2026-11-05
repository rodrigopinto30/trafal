from enum import StrEnum

type ErrorParams = dict[str, str | int]


class ErrorCode(StrEnum):
    """Motivos estables por los que se rechaza un zip. La interfaz traduce cada código a un mensaje claro."""

    NOT_A_ZIP = "NOT_A_ZIP"
    CORRUPT_ARCHIVE = "CORRUPT_ARCHIVE"
    ZIP_TOO_LARGE = "ZIP_TOO_LARGE"
    UNCOMPRESSED_TOO_LARGE = "UNCOMPRESSED_TOO_LARGE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    TOO_MANY_FILES = "TOO_MANY_FILES"
    UNSAFE_PATH = "UNSAFE_PATH"
    PATH_TOO_LONG = "PATH_TOO_LONG"
    DUPLICATE_PATH = "DUPLICATE_PATH"
    PATH_CONFLICT = "PATH_CONFLICT"
    ENCRYPTED_ENTRY = "ENCRYPTED_ENTRY"
    UNSUPPORTED_COMPRESSION = "UNSUPPORTED_COMPRESSION"
    OVERLAPPING_ENTRIES = "OVERLAPPING_ENTRIES"
    SYMLINK_NOT_ALLOWED = "SYMLINK_NOT_ALLOWED"
    SPECIAL_FILE = "SPECIAL_FILE"
    EXECUTABLE_FILE = "EXECUTABLE_FILE"
    NESTED_ARCHIVE = "NESTED_ARCHIVE"
    EXTENSION_NOT_ALLOWED = "EXTENSION_NOT_ALLOWED"
    NO_INDEX_HTML = "NO_INDEX_HTML"


class UploadRejected(Exception):
    """El zip no cumple las reglas de subida. Lleva el código estable y parámetros simples (se guardan como JSON)."""

    def __init__(self, code: ErrorCode, **params: str | int) -> None:
        super().__init__(code.value)
        self.code = code
        self.params: ErrorParams = dict(params)
