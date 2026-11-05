import json

from trafal_worker.errors import ErrorCode
from trafal_worker.rules import default_rules_path, load_rules


def test_rules_match_the_documented_limits() -> None:
    limits = load_rules().limits
    assert limits.max_zip_bytes == 200 * 1024 * 1024
    assert limits.max_uncompressed_bytes == 1024 * 1024 * 1024
    assert limits.max_files == 5000
    assert limits.max_file_bytes == 500 * 1024 * 1024
    assert limits.max_path_length == 240


def test_error_codes_in_json_and_enum_are_the_same() -> None:
    declared = json.loads(default_rules_path().read_text(encoding="utf-8"))["errorCodes"]
    assert sorted(declared) == sorted(code.value for code in ErrorCode)


def test_no_executable_or_archive_extension_is_also_allowed() -> None:
    rules = load_rules()
    assert not rules.allowed_extensions & rules.executable_extensions
    assert not rules.allowed_extensions & rules.archive_extensions
    assert not rules.allowed_extensions & rules.compressed_suffixes
