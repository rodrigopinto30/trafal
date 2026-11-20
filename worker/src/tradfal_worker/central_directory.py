import struct
from dataclasses import dataclass
from typing import BinaryIO

from .errors import ErrorCode, UploadRejected

_EOCD_SIGNATURE = b"PK\x05\x06"
_EOCD_STRUCT = struct.Struct("<4s4H2LH")
_ZIP64_LOCATOR_SIGNATURE = b"PK\x06\x07"
_ZIP64_LOCATOR_STRUCT = struct.Struct("<4sLQL")
_ZIP64_EOCD_SIGNATURE = b"PK\x06\x06"
_ZIP64_EOCD_STRUCT = struct.Struct("<4sQHHLLQQQQ")
_ENTRY_SIGNATURE = b"PK\x01\x02"
_ENTRY_STRUCT = struct.Struct("<4s6H3L5H2L")
_MAX_COMMENT_BYTES = 0xFFFF
_BYTES_PER_ENTRY_BUDGET = 2048
_SENTINEL_32 = 0xFFFFFFFF


@dataclass(frozen=True)
class CentralDirectory:
    """Dónde empieza el directorio central del zip, cuánto pesa y cuántas entradas trae."""

    start: int
    size: int
    entries: int


def _find_end_record(file: BinaryIO, file_size: int) -> tuple[int, bytes]:
    window = min(file_size, _EOCD_STRUCT.size + _MAX_COMMENT_BYTES)
    file.seek(file_size - window)
    tail = file.read(window)
    position = tail.rfind(_EOCD_SIGNATURE)
    if position < 0 or len(tail) - position < _EOCD_STRUCT.size:
        raise UploadRejected(ErrorCode.NOT_A_ZIP)
    return file_size - window + position, tail[position : position + _EOCD_STRUCT.size]


def _read_zip64(file: BinaryIO, end_position: int) -> tuple[int, int, int]:
    if end_position < _ZIP64_LOCATOR_STRUCT.size:
        raise UploadRejected(ErrorCode.NOT_A_ZIP)
    file.seek(end_position - _ZIP64_LOCATOR_STRUCT.size)
    locator = file.read(_ZIP64_LOCATOR_STRUCT.size)
    signature = _ZIP64_LOCATOR_STRUCT.unpack(locator)[0]
    if signature != _ZIP64_LOCATOR_SIGNATURE:
        raise UploadRejected(ErrorCode.NOT_A_ZIP)
    record_position = end_position - _ZIP64_LOCATOR_STRUCT.size - _ZIP64_EOCD_STRUCT.size
    if record_position < 0:
        raise UploadRejected(ErrorCode.NOT_A_ZIP)
    file.seek(record_position)
    record = file.read(_ZIP64_EOCD_STRUCT.size)
    fields = _ZIP64_EOCD_STRUCT.unpack(record)
    if fields[0] != _ZIP64_EOCD_SIGNATURE:
        raise UploadRejected(ErrorCode.NOT_A_ZIP)
    return record_position, int(fields[8]), int(fields[7])


def locate_central_directory(file: BinaryIO, file_size: int, max_entries: int) -> CentralDirectory:
    """
    Ubica el directorio central y cuenta sus entradas leyendo solo los encabezados, antes de que zipfile cree un objeto
    por entrada: un zip con millones de entradas diminutas agotaría la memoria del worker. El inicio se calcula como lo
    hace zipfile (contando hacia atrás desde el final), así las dos lecturas coinciden aunque haya datos antepuestos.
    """
    end_position, end_record = _find_end_record(file, file_size)
    fields = _EOCD_STRUCT.unpack(end_record)
    size = int(fields[5])
    declared_entries = int(fields[4])
    boundary = end_position
    if declared_entries == 0xFFFF or size == _SENTINEL_32 or int(fields[6]) == _SENTINEL_32:
        boundary, size, declared_entries = _read_zip64(file, end_position)
    start = boundary - size
    if size > max_entries * _BYTES_PER_ENTRY_BUDGET:
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    if start < 0:
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    file.seek(start)
    directory = file.read(size)
    if len(directory) != size:
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    entries = _count_entries(directory, max_entries)
    if entries != declared_entries:
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    return CentralDirectory(start=start, size=size, entries=entries)


def _count_entries(directory: bytes, max_entries: int) -> int:
    position = 0
    count = 0
    while position < len(directory):
        if len(directory) - position < _ENTRY_STRUCT.size:
            raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
        fields = _ENTRY_STRUCT.unpack_from(directory, position)
        if fields[0] != _ENTRY_SIGNATURE:
            raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
        count += 1
        if count > max_entries:
            raise UploadRejected(ErrorCode.TOO_MANY_FILES, limit=max_entries)
        position += _ENTRY_STRUCT.size + fields[10] + fields[11] + fields[12]
    if position != len(directory):
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    return count
