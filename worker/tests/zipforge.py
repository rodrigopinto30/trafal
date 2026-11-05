import struct
import zlib
from dataclasses import dataclass, field
from pathlib import Path

UNIX = 3
FAT = 0
S_IFLNK = 0o120000
S_IFREG = 0o100000
S_IFIFO = 0o010000


@dataclass
class ForgedEntry:
    """Una entrada de zip armada a mano, para poder fabricar archivos que un compresor normal nunca generaría."""

    name: str
    data: bytes = b""
    method: int = 0
    flags: int = 0
    create_system: int = UNIX
    mode: int = S_IFREG | 0o644
    external_attr: int | None = None
    declared_size: int | None = None
    compressed: bytes | None = None
    declared_compressed_size: int | None = None
    share_header_with: int | None = None
    extra: dict[str, int] = field(default_factory=dict)


def _compress(entry: ForgedEntry) -> bytes:
    if entry.compressed is not None:
        return entry.compressed
    if entry.method == 8:
        compressor = zlib.compressobj(9, zlib.DEFLATED, -15)
        return compressor.compress(entry.data) + compressor.flush()
    return entry.data


def forge_zip(
    path: Path, entries: list[ForgedEntry], *, comment: bytes = b"", zip64: bool = False, prefix: bytes = b""
) -> Path:
    """Escribe un zip con exactamente lo que dicen las entradas, sin las protecciones de la biblioteca estándar."""
    body = bytearray()
    central = bytearray()
    offsets: list[int] = []
    for entry in entries:
        name = entry.name.encode("utf-8")
        payload = _compress(entry)
        crc = zlib.crc32(entry.data)
        size = len(entry.data) if entry.declared_size is None else entry.declared_size
        flags = entry.flags | 0x800
        if entry.share_header_with is not None:
            offset = offsets[entry.share_header_with]
        else:
            offset = len(body)
            body += struct.pack(
                "<4s5H3L2H", b"PK\x03\x04", 20, flags, entry.method, 0, 0x21, crc, len(payload), size, len(name), 0
            )
            body += name + payload
        offsets.append(offset)
        attr = entry.external_attr if entry.external_attr is not None else entry.mode << 16
        central += struct.pack(
            "<4s6H3L5H2L",
            b"PK\x01\x02",
            (entry.create_system << 8) | 20,
            20,
            flags,
            entry.method,
            0,
            0x21,
            crc,
            len(payload) if entry.declared_compressed_size is None else entry.declared_compressed_size,
            size,
            len(name),
            0,
            0,
            0,
            0,
            attr,
            offset,
        )
        central += name
    tail = b""
    if zip64:
        record_offset = len(body) + len(central)
        tail += struct.pack(
            "<4sQHHLLQQQQ", b"PK\x06\x06", 44, 45, 45, 0, 0, len(entries), len(entries), len(central), len(body)
        )
        tail += struct.pack("<4sLQL", b"PK\x06\x07", 0, record_offset, 1)
        end = struct.pack(
            "<4s4H2LH", b"PK\x05\x06", 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFFFFFF, 0xFFFFFFFF, len(comment)
        )
    else:
        end = struct.pack(
            "<4s4H2LH", b"PK\x05\x06", 0, 0, len(entries), len(entries), len(central), len(body), len(comment)
        )
    path.write_bytes(prefix + bytes(body) + bytes(central) + tail + end + comment)
    return path


def simple_zip(path: Path, files: dict[str, bytes], *, method: int = 8) -> Path:
    """Zip normal con los archivos dados, comprimidos con deflate."""
    return forge_zip(path, [ForgedEntry(name, data, method=method) for name, data in files.items()])
