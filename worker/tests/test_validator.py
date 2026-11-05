import dataclasses
import unicodedata
from pathlib import Path

import pytest

from tests.conftest import INDEX
from tests.zipforge import FAT, S_IFIFO, S_IFLNK, ForgedEntry, forge_zip, simple_zip
from trafal_worker.errors import ErrorCode, UploadRejected
from trafal_worker.planner import PlannedFile
from trafal_worker.rules import UploadRules
from trafal_worker.validator import validate_archive


def reject(path: Path, rules: UploadRules) -> UploadRejected:
    with pytest.raises(UploadRejected) as caught:
        validate_archive(path, rules)
    return caught.value


def with_limits(rules: UploadRules, **changes: int) -> UploadRules:
    return dataclasses.replace(rules, limits=dataclasses.replace(rules.limits, **changes))


def good(files: dict[str, bytes] | None = None) -> dict[str, bytes]:
    return {"index.html": INDEX, "game.js": b"console.log(1)", **(files or {})}


class CollectingSink:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.events: list[str] = []
        self._current = ""

    def begin(self, file: PlannedFile) -> None:
        self._current = file.target
        self.files[self._current] = b""
        self.events.append(f"begin:{file.target}")

    def write(self, chunk: bytes) -> None:
        self.files[self._current] += chunk

    def end(self, file: PlannedFile) -> None:
        self.events.append(f"end:{file.target}")


class TestValidArchives:
    def test_accepts_a_minimal_game(self, work: Path, rules: UploadRules) -> None:
        report = validate_archive(simple_zip(work / "g.zip", good()), rules)
        assert report.file_count == 2
        assert report.files == ("index.html", "game.js")
        assert report.unpacked_bytes == len(INDEX) + len(b"console.log(1)")
        assert report.stripped_prefix == ""
        assert report.scan_flags == ()

    @pytest.mark.parametrize("method", [0, 8])
    def test_accepts_stored_and_deflated(self, work: Path, rules: UploadRules, method: int) -> None:
        assert validate_archive(simple_zip(work / "g.zip", good(), method=method), rules).file_count == 2

    def test_delivers_the_exact_bytes_to_the_sink(self, work: Path, rules: UploadRules) -> None:
        sink = CollectingSink()
        archive = simple_zip(work / "g.zip", good({"data/level1.json": b"{}" * 100_000}))
        validate_archive(archive, rules, sink)
        assert sink.files["index.html"] == INDEX
        assert sink.files["data/level1.json"] == b"{}" * 100_000
        assert sink.events[0] == "begin:index.html" and sink.events[-1] == "end:data/level1.json"

    def test_flattens_a_single_wrapping_folder(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", {f"mi-juego/{name}": data for name, data in good().items()})
        report = validate_archive(archive, rules)
        assert report.stripped_prefix == "mi-juego/"
        assert report.files == ("index.html", "game.js")

    def test_does_not_flatten_when_files_sit_at_the_root(self, work: Path, rules: UploadRules) -> None:
        report = validate_archive(simple_zip(work / "g.zip", good({"assets/a.png": b"\x89PNG....."})), rules)
        assert report.stripped_prefix == ""
        assert "assets/a.png" in report.files

    def test_ignores_system_junk_without_error(self, work: Path, rules: UploadRules) -> None:
        junk = {
            "__MACOSX/._index.html": b"x",
            ".DS_Store": b"x",
            "Thumbs.db": b"x",
            "assets/._a.png": b"x",
            "assets/.DS_Store": b"x",
        }
        report = validate_archive(simple_zip(work / "g.zip", {**good(), **junk}), rules)
        assert report.files == ("index.html", "game.js")

    def test_accepts_precompressed_assets_with_a_second_extension(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(
            work / "g.zip", good({"Build/game.wasm.br": b"\x00" * 10, "Build/game.data.gz": b"\x1f\x8b" + b"\x00" * 10})
        )
        assert validate_archive(archive, rules).file_count == 4

    def test_accepts_empty_directories_and_unicode_names(self, work: Path, rules: UploadRules) -> None:
        entries = [ForgedEntry(name, data) for name, data in good({"sonidos/música ñandú.ogg": b"OggS...."}).items()]
        entries.append(ForgedEntry("vacio/"))
        assert validate_archive(forge_zip(work / "g.zip", entries), rules).file_count == 3

    def test_accepts_zip64_and_data_before_the_archive(self, work: Path, rules: UploadRules) -> None:
        entries = [ForgedEntry(name, data) for name, data in good().items()]
        assert validate_archive(forge_zip(work / "a.zip", entries, zip64=True), rules).file_count == 2
        assert validate_archive(forge_zip(work / "b.zip", entries, prefix=b"#!/bin/sh\n"), rules).file_count == 2

    def test_a_text_starting_with_mz_is_not_an_executable(self, work: Path, rules: UploadRules) -> None:
        assert (
            validate_archive(simple_zip(work / "g.zip", good({"creditos.txt": b"MZ Games presenta"})), rules).file_count
            == 3
        )


class TestNotAZip:
    @pytest.mark.parametrize("content", [b"", b"hola", b"%PDF-1.4" + b"\x00" * 100, b"PK\x03\x04" + b"\x00" * 10])
    def test_rejects_files_that_are_not_zips(self, work: Path, rules: UploadRules, content: bytes) -> None:
        path = work / "x.zip"
        path.write_bytes(content)
        assert reject(path, rules).code is ErrorCode.NOT_A_ZIP

    def test_rejects_a_truncated_zip(self, work: Path, rules: UploadRules) -> None:
        path = simple_zip(work / "g.zip", good())
        path.write_bytes(path.read_bytes()[:-30])
        assert reject(path, rules).code in {ErrorCode.NOT_A_ZIP, ErrorCode.CORRUPT_ARCHIVE}

    def test_rejects_corrupted_data(self, work: Path, rules: UploadRules) -> None:
        path = simple_zip(work / "g.zip", good({"data.bin": bytes(range(256)) * 64}), method=0)
        raw = bytearray(path.read_bytes())
        raw[raw.index(bytes(range(256))) + 100] ^= 0xFF
        path.write_bytes(bytes(raw))
        assert reject(path, rules).code is ErrorCode.CORRUPT_ARCHIVE

    def test_rejects_a_directory_that_disagrees_with_its_declared_entries(self, work: Path, rules: UploadRules) -> None:
        raw = bytearray(simple_zip(work / "g.zip", good()).read_bytes())
        end = raw.rindex(b"PK\x05\x06")
        raw[end + 10 : end + 12] = (7).to_bytes(2, "little")
        (work / "g.zip").write_bytes(bytes(raw))
        assert reject(work / "g.zip", rules).code is ErrorCode.CORRUPT_ARCHIVE


class TestLimits:
    def test_rejects_a_zip_over_the_size_limit(self, work: Path, rules: UploadRules) -> None:
        path = simple_zip(work / "g.zip", good())
        error = reject(path, with_limits(rules, max_zip_bytes=100))
        assert error.code is ErrorCode.ZIP_TOO_LARGE and error.params["limit"] == 100

    def test_rejects_too_many_files(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", good({f"a{n}.txt": b"x" for n in range(5)}))
        assert reject(archive, with_limits(rules, max_files=4)).code is ErrorCode.TOO_MANY_FILES

    def test_rejects_too_many_directory_entries_before_reading_any_of_them(
        self, work: Path, rules: UploadRules
    ) -> None:
        entries = [ForgedEntry(name, data) for name, data in good().items()] + [
            ForgedEntry(f"d{n}/") for n in range(50)
        ]
        error = reject(forge_zip(work / "g.zip", entries), with_limits(rules, max_entries=10))
        assert error.code is ErrorCode.TOO_MANY_FILES

    def test_rejects_when_declared_sizes_add_up_to_too_much(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", good({"big.dat": b"\x00" * 5000}))
        assert reject(archive, with_limits(rules, max_uncompressed_bytes=4000)).code is ErrorCode.UNCOMPRESSED_TOO_LARGE

    def test_rejects_a_single_file_over_its_limit(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", good({"big.dat": b"\x00" * 5000}))
        error = reject(archive, with_limits(rules, max_file_bytes=4000))
        assert error.code is ErrorCode.FILE_TOO_LARGE and error.params["path"] == "big.dat"

    def test_a_small_zip_that_expands_a_lot_is_stopped_while_unpacking(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "bomb.zip", good({"zeros.dat": b"\x00" * (40 * 1024 * 1024)}))
        assert archive.stat().st_size < 100_000
        assert (
            reject(archive, with_limits(rules, max_uncompressed_bytes=8 * 1024 * 1024)).code
            is ErrorCode.UNCOMPRESSED_TOO_LARGE
        )

    def test_lying_about_the_size_in_the_directory_does_not_help(self, work: Path, rules: UploadRules) -> None:
        payload = b"\x00" * (20 * 1024 * 1024)
        entries = [ForgedEntry("index.html", INDEX), ForgedEntry("zeros.dat", payload, method=8, declared_size=100)]
        assert reject(forge_zip(work / "g.zip", entries), rules).code is ErrorCode.CORRUPT_ARCHIVE

    def test_many_entries_pointing_to_the_same_data_are_rejected(self, work: Path, rules: UploadRules) -> None:
        payload = b"\x00" * (1024 * 1024)
        entries = [ForgedEntry("index.html", INDEX), ForgedEntry("a.dat", payload, method=8)]
        entries += [ForgedEntry(f"copy{n}.dat", payload, method=8, share_header_with=1) for n in range(20)]
        assert reject(forge_zip(work / "g.zip", entries), rules).code is ErrorCode.OVERLAPPING_ENTRIES

    def test_an_entry_that_claims_more_compressed_bytes_than_it_has_is_rejected(
        self, work: Path, rules: UploadRules
    ) -> None:
        entries = [
            ForgedEntry("index.html", INDEX),
            ForgedEntry("a.dat", b"a" * 1000, method=8, declared_compressed_size=9000),
            ForgedEntry("b.dat", b"b"),
        ]
        assert reject(forge_zip(work / "g.zip", entries), rules).code is ErrorCode.OVERLAPPING_ENTRIES


class TestPaths:
    @pytest.mark.parametrize(
        "name",
        [
            "../evil.js",
            "a/../../evil.js",
            "/etc/passwd",
            "C:/Windows/x.js",
            "c:evil.js",
            "a\\b.js",
            "a//b.js",
            "./a.js",
            "a/./b.js",
            "a\x07.js",
            "a\u202eb.js",
            "a\u2028b.js",
            "a\u200bb.js",
        ],
    )
    def test_rejects_unsafe_paths(self, work: Path, rules: UploadRules, name: str) -> None:
        archive = forge_zip(work / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry(name, b"x")])
        assert reject(archive, rules).code is ErrorCode.UNSAFE_PATH

    def test_a_name_with_a_null_byte_is_judged_as_the_library_reads_it(self, work: Path, rules: UploadRules) -> None:
        archive = forge_zip(work / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry("a\x00b.js", b"x")])
        assert reject(archive, rules).code in {ErrorCode.UNSAFE_PATH, ErrorCode.EXTENSION_NOT_ALLOWED}

    def test_rejects_unsafe_paths_even_inside_ignored_junk(self, work: Path, rules: UploadRules) -> None:
        archive = forge_zip(work / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry("__MACOSX/../../x", b"x")])
        assert reject(archive, rules).code is ErrorCode.UNSAFE_PATH

    def test_rejects_very_long_paths(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", good({"a/" * 119 + "b.txt": b"x"}))
        assert reject(archive, rules).code is ErrorCode.PATH_TOO_LONG

    def test_error_paths_never_carry_control_characters(self, work: Path, rules: UploadRules) -> None:
        archive = forge_zip(work / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry("a\x1b[31m\u202e.js", b"x")])
        error = reject(archive, rules)
        assert "\x1b" not in str(error.params["path"]) and "\u202e" not in str(error.params["path"])

    def test_rejects_names_that_differ_only_by_case(self, work: Path, rules: UploadRules) -> None:
        assert (
            reject(simple_zip(work / "g.zip", good({"A.png": b"x", "a.PNG": b"y"})), rules).code
            is ErrorCode.DUPLICATE_PATH
        )

    def test_rejects_names_that_differ_only_by_unicode_form(self, work: Path, rules: UploadRules) -> None:
        composed, decomposed = unicodedata.normalize("NFC", "canción.mp3"), unicodedata.normalize("NFD", "canción.mp3")
        assert composed != decomposed
        assert (
            reject(simple_zip(work / "g.zip", good({composed: b"x", decomposed: b"y"})), rules).code
            is ErrorCode.DUPLICATE_PATH
        )

    def test_rejects_a_file_that_is_also_a_folder(self, work: Path, rules: UploadRules) -> None:
        assert (
            reject(simple_zip(work / "g.zip", good({"assets.png": b"x", "assets.png/a.png": b"y"})), rules).code
            is ErrorCode.PATH_CONFLICT
        )


class TestEntryKinds:
    def test_rejects_encrypted_entries(self, work: Path, rules: UploadRules) -> None:
        archive = forge_zip(
            work / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry("secret.dat", b"x", flags=1)]
        )
        assert reject(archive, rules).code is ErrorCode.ENCRYPTED_ENTRY

    def test_rejects_compression_methods_other_than_deflate(self, work: Path, rules: UploadRules) -> None:
        archive = forge_zip(
            work / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry("a.dat", b"x", method=12, compressed=b"x")]
        )
        assert reject(archive, rules).code is ErrorCode.UNSUPPORTED_COMPRESSION

    def test_rejects_symlinks(self, work: Path, rules: UploadRules) -> None:
        archive = forge_zip(
            work / "g.zip",
            [ForgedEntry("index.html", INDEX), ForgedEntry("link.txt", b"/etc/passwd", mode=S_IFLNK | 0o777)],
        )
        assert reject(archive, rules).code is ErrorCode.SYMLINK_NOT_ALLOWED

    def test_rejects_windows_reparse_points(self, work: Path, rules: UploadRules) -> None:
        entry = ForgedEntry("link.txt", b"x", create_system=FAT, external_attr=0x400)
        assert (
            reject(forge_zip(work / "g.zip", [ForgedEntry("index.html", INDEX), entry]), rules).code
            is ErrorCode.SYMLINK_NOT_ALLOWED
        )

    def test_rejects_special_files(self, work: Path, rules: UploadRules) -> None:
        entry = ForgedEntry("pipe.txt", b"", mode=S_IFIFO | 0o644)
        assert (
            reject(forge_zip(work / "g.zip", [ForgedEntry("index.html", INDEX), entry]), rules).code
            is ErrorCode.SPECIAL_FILE
        )


class TestContent:
    @pytest.mark.parametrize(
        "name", ["setup.exe", "lib.dll", "run.sh", "tool.bat", "app.jar", "juego.apk", "x.EXE", "x.exe.gz", "x.dylib"]
    )
    def test_rejects_executable_extensions(self, work: Path, rules: UploadRules, name: str) -> None:
        assert reject(simple_zip(work / "g.zip", good({name: b"x"})), rules).code is ErrorCode.EXECUTABLE_FILE

    @pytest.mark.parametrize(
        "head",
        [
            b"\x7fELF\x02\x01\x01" + b"\x00" * 60,
            b"\xcf\xfa\xed\xfe" + b"\x00" * 60,
            b"\xfe\xed\xfa\xcf" + b"\x00" * 60,
            b"\xca\xfe\xba\xbe" + b"\x00" * 60,
        ],
    )
    def test_rejects_executables_hidden_behind_a_harmless_name(
        self, work: Path, rules: UploadRules, head: bytes
    ) -> None:
        assert reject(simple_zip(work / "g.zip", good({"music.ogg": head})), rules).code is ErrorCode.EXECUTABLE_FILE

    def test_rejects_a_windows_executable_hidden_behind_a_harmless_name(self, work: Path, rules: UploadRules) -> None:
        pe = bytearray(b"MZ" + b"\x00" * 126)
        pe[0x3C:0x40] = (0x80).to_bytes(4, "little")
        pe[0x80:0x84] = b"PE\x00\x00"
        assert (
            reject(simple_zip(work / "g.zip", good({"cover.png": bytes(pe)})), rules).code is ErrorCode.EXECUTABLE_FILE
        )

    def test_rejects_an_executable_even_when_it_is_not_in_the_first_file(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", good({"a.dat": b"x" * 200_000, "z.ogg": b"\x7fELF" + b"\x00" * 100}))
        assert reject(archive, rules).code is ErrorCode.EXECUTABLE_FILE

    @pytest.mark.parametrize("name", ["extra.zip", "mod.rar", "pack.7z", "x.tar", "x.tgz"])
    def test_rejects_nested_archives_by_extension(self, work: Path, rules: UploadRules, name: str) -> None:
        assert reject(simple_zip(work / "g.zip", good({name: b"x"})), rules).code is ErrorCode.NESTED_ARCHIVE

    @pytest.mark.parametrize(
        "head", [b"PK\x03\x04" + b"\x00" * 30, b"Rar!\x1a\x07\x00" + b"\x00" * 30, b"7z\xbc\xaf\x27\x1c" + b"\x00" * 30]
    )
    def test_rejects_nested_archives_hidden_behind_a_harmless_name(
        self, work: Path, rules: UploadRules, head: bytes
    ) -> None:
        assert reject(simple_zip(work / "g.zip", good({"levels.dat": head})), rules).code is ErrorCode.NESTED_ARCHIVE

    @pytest.mark.parametrize(
        "name",
        ["index.php", "server.py", "LICENSE", ".htaccess", "a.br", "x.js.gz.br", "page.htmlx", "movie.mkv", "weird."],
    )
    def test_rejects_extensions_outside_the_list(self, work: Path, rules: UploadRules, name: str) -> None:
        assert reject(simple_zip(work / "g.zip", good({name: b"x"})), rules).code is ErrorCode.EXTENSION_NOT_ALLOWED


class TestRequiredFiles:
    def test_requires_index_html(self, work: Path, rules: UploadRules) -> None:
        error = reject(simple_zip(work / "g.zip", {"game.js": b"x"}), rules)
        assert error.code is ErrorCode.NO_INDEX_HTML and error.params["file"] == "index.html"

    def test_an_empty_zip_has_no_index(self, work: Path, rules: UploadRules) -> None:
        assert reject(forge_zip(work / "g.zip", []), rules).code is ErrorCode.NO_INDEX_HTML

    def test_index_html_must_be_at_the_root_after_flattening(self, work: Path, rules: UploadRules) -> None:
        archive = simple_zip(work / "g.zip", {"index.html": INDEX, "sub/index.html": INDEX, "sub/a.js": b"x"})
        assert validate_archive(archive, rules).files == ("index.html", "sub/index.html", "sub/a.js")
        assert (
            reject(simple_zip(work / "h.zip", {"a/b/index.html": INDEX, "a/c.js": b"x"}), rules).code
            is ErrorCode.NO_INDEX_HTML
        )

    def test_the_name_is_case_sensitive(self, work: Path, rules: UploadRules) -> None:
        assert reject(simple_zip(work / "g.zip", {"Index.html": INDEX}), rules).code is ErrorCode.NO_INDEX_HTML


class TestScanFlags:
    def flags(self, work: Path, rules: UploadRules, files: dict[str, bytes]) -> tuple[str, ...]:
        return validate_archive(simple_zip(work / "g.zip", good(files)), rules).scan_flags

    def test_marks_but_does_not_block(self, work: Path, rules: UploadRules) -> None:
        found = self.flags(
            work,
            rules,
            {
                "m.js": b"new CoinHive.Anonymous('k')",
                "login.html": b'<input type="password">',
                "t.js": b"top.location = 'x'",
            },
        )
        assert found == ("CRYPTO_MINER", "PASSWORD_FIELD", "TOP_NAVIGATION_ATTEMPT")

    def test_finds_a_signature_split_across_two_chunks(self, work: Path, rules: UploadRules) -> None:
        padding = b"a" * (64 * 1024 - 4)
        assert self.flags(work, rules, {"big.js": padding + b"coinhive" + b"b" * 10}) == ("CRYPTO_MINER",)

    def test_only_scans_text_files(self, work: Path, rules: UploadRules) -> None:
        assert self.flags(work, rules, {"notes.txt": b"coinhive", "pic.png": b"coinhive"}) == ()

    def test_does_not_flag_clean_games(self, work: Path, rules: UploadRules) -> None:
        assert self.flags(work, rules, {}) == ()
