import zipfile
from pathlib import Path

import pytest

from tests.conftest import INDEX
from tests.zipforge import simple_zip
from trafal_worker.planner import PlannedFile
from trafal_worker.rules import UploadRules
from trafal_worker.sink import DirectorySink
from trafal_worker.validator import validate_archive


def planned(target: str) -> PlannedFile:
    return PlannedFile(source=target, target=target, info=zipfile.ZipInfo(target))


class TestDirectorySink:
    def test_extracts_a_validated_zip_with_its_folders(self, tmp_path: Path, rules: UploadRules) -> None:
        archive = simple_zip(tmp_path / "g.zip", {"index.html": INDEX, "img/deep/a.png": b"\x89PNG"})
        with DirectorySink(tmp_path / "out") as sink:
            report = validate_archive(archive, rules, sink)
        assert sorted(sink.written) == sorted(report.files)
        assert (tmp_path / "out" / "index.html").read_bytes() == INDEX
        assert (tmp_path / "out" / "img" / "deep" / "a.png").read_bytes() == b"\x89PNG"

    @pytest.mark.parametrize("target", ["../escape.txt", "a/../../escape.txt", "/abs/escape.txt"])
    def test_refuses_to_write_outside_its_directory(self, tmp_path: Path, target: str) -> None:
        sink = DirectorySink(tmp_path / "out")
        with pytest.raises(ValueError, match="escapes"):
            sink.begin(planned(target))
        assert not (tmp_path / "escape.txt").exists()

    def test_refuses_to_overwrite_an_existing_file(self, tmp_path: Path) -> None:
        sink = DirectorySink(tmp_path / "out")
        sink.begin(planned("a.txt"))
        sink.end(planned("a.txt"))
        with pytest.raises(FileExistsError):
            sink.begin(planned("a.txt"))

    def test_write_before_begin_is_a_bug(self, tmp_path: Path) -> None:
        with pytest.raises(RuntimeError):
            DirectorySink(tmp_path).write(b"x")
