from pathlib import Path
from types import TracebackType
from typing import BinaryIO, Self

from .planner import PlannedFile


class DirectorySink:
    """
    Writes the verified files of a zip into a directory. The validator already rejected unsafe paths; this still refuses
    to write outside the directory (defense in depth) and never follows or creates links.
    """

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.written: list[str] = []
        self._handle: BinaryIO | None = None

    def begin(self, file: PlannedFile) -> None:
        destination = (self.root / file.target).resolve()
        if self.root not in destination.parents:
            raise ValueError(f"path escapes the extraction directory: {file.target!r}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        self._handle = destination.open("xb")

    def write(self, chunk: bytes) -> None:
        if self._handle is None:
            raise RuntimeError("write() called before begin()")
        self._handle.write(chunk)

    def end(self, file: PlannedFile) -> None:
        self.close()
        self.written.append(file.target)

    def close(self) -> None:
        if self._handle is not None:
            self._handle.close()
            self._handle = None

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, traceback: TracebackType | None
    ) -> None:
        self.close()
