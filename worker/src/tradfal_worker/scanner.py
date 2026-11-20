from collections.abc import Mapping

from .errors import ErrorCode, UploadRejected
from .rules import UploadRules

_PE_HEADER_OFFSET_FIELD = slice(0x3C, 0x40)
_PE_MIN_HEAD_BYTES = 64


def forbidden_content(head: bytes, file_size: int, rules: UploadRules, path: str) -> None:
    """
    Mira los primeros bytes de un archivo y rechaza ejecutables y archivos comprimidos aunque tengan otra extensión.
    «MZ» solo cuenta si además el offset del encabezado PE cae dentro del archivo: así un texto que empieza con
    esas dos letras no se confunde con un .exe.
    """
    for signature in rules.executable_magic:
        if head.startswith(signature.prefix):
            raise UploadRejected(ErrorCode.EXECUTABLE_FILE, path=path, kind=signature.name)
    if head.startswith(b"MZ") and len(head) >= _PE_MIN_HEAD_BYTES:
        pe_offset = int.from_bytes(head[_PE_HEADER_OFFSET_FIELD], "little")
        if _PE_MIN_HEAD_BYTES <= pe_offset <= file_size - 4:
            raise UploadRejected(ErrorCode.EXECUTABLE_FILE, path=path, kind="PE")
    for signature in rules.archive_magic:
        if head.startswith(signature.prefix):
            raise UploadRejected(ErrorCode.NESTED_ARCHIVE, path=path, kind=signature.name)


class SignatureScanner:
    """
    Busca texto sospechoso (minado, campos de contraseña, intentos de navegar la ventana superior) mientras el archivo
    se descomprime. No bloquea nada: devuelve marcas para que un administrador revise el juego.
    """

    def __init__(self, signatures: Mapping[str, tuple[bytes, ...]], max_bytes: int) -> None:
        self._signatures = signatures
        self._remaining = max_bytes
        self._overlap = max((len(pattern) for patterns in signatures.values() for pattern in patterns), default=1) - 1
        self._tail = b""
        self.flags: set[str] = set()

    def feed(self, chunk: bytes) -> None:
        """Revisa un trozo, junto con el final del anterior para no perder coincidencias partidas entre trozos."""
        if self._remaining <= 0:
            return
        window = self._tail + chunk[: self._remaining].lower()
        self._remaining -= len(chunk)
        for flag, patterns in self._signatures.items():
            if flag not in self.flags and any(pattern in window for pattern in patterns):
                self.flags.add(flag)
        self._tail = window[-self._overlap :] if self._overlap else b""
