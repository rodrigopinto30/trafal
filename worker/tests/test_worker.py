import threading
from pathlib import Path

import pytest

from tests.conftest import INDEX
from tests.fakes import FakeQueue, FakeStorage
from tests.zipforge import ForgedEntry, forge_zip, simple_zip
from trafal_worker.config import ConfigError, WorkerConfig, load_config
from trafal_worker.rules import UploadRules
from trafal_worker.runner import Worker
from trafal_worker.version_queue import ClaimedVersion

QUARANTINE = "quarantine"
GAMES = "games"


def make_config(tmp_path: Path, **changes: object) -> WorkerConfig:
    values: dict[str, object] = {
        "database_url": "postgresql://unused",
        "s3_endpoint": "http://unused",
        "s3_region": "local",
        "s3_access_key_id": "key",
        "s3_secret_access_key": "secret",
        "quarantine_bucket": QUARANTINE,
        "games_bucket": GAMES,
        "work_dir": tmp_path / "work",
        "worker_name": "test-worker",
        "poll_interval_seconds": 0.01,
        "upload_threads": 4,
        "heartbeat_file": tmp_path / "heartbeat",
    }
    values.update(changes)
    return WorkerConfig(**values)  # type: ignore[arg-type]


def claim_for(storage: FakeStorage, data: bytes, *, declared: int | None = None, number: int = 1) -> ClaimedVersion:
    key = f"game-id/version-{number}.zip"
    storage.put(QUARANTINE, key, data)
    return ClaimedVersion(
        f"version-{number}", "game-id", "moon-runner", number, key, len(data) if declared is None else declared
    )


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


def run(storage: FakeStorage, claimed: ClaimedVersion, rules: UploadRules, tmp_path: Path) -> FakeQueue:
    queue = FakeQueue([claimed])
    Worker(queue, storage, rules, make_config(tmp_path)).run_once()
    return queue


class TestAcceptedGames:
    def test_publishes_every_file_under_game_and_version(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        data = simple_zip(
            tmp_path / "g.zip", {"index.html": INDEX, "game.js": b"x=1", "img/a.png": b"\x89PNG"}
        ).read_bytes()
        queue = run(storage, claim_for(storage, data), rules, tmp_path)
        assert storage.keys(GAMES) == [
            "moon-runner/v1/game.js",
            "moon-runner/v1/img/a.png",
            "moon-runner/v1/index.html",
        ]
        assert storage.objects[(GAMES, "moon-runner/v1/index.html")] == INDEX
        assert len(queue.completed) == 1 and queue.failed == [] and queue.released == []

    def test_reports_the_result_to_the_queue(self, tmp_path: Path, rules: UploadRules, storage: FakeStorage) -> None:
        data = simple_zip(tmp_path / "g.zip", {"index.html": INDEX, "m.js": b"new CoinHive.Anonymous()"}).read_bytes()
        queue = run(storage, claim_for(storage, data), rules, tmp_path)
        assert queue.completed[0] == {
            "version_id": "version-1",
            "file_count": 2,
            "unpacked_bytes": len(INDEX) + len(b"new CoinHive.Anonymous()"),
            "size_bytes": len(data),
            "needs_isolation": False,
            "scan_flags": ["CRYPTO_MINER"],
        }

    def test_serves_each_file_with_its_content_type_and_encoding(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        files = {
            "index.html": INDEX,
            "game.js": b"x",
            "Build/g.wasm.br": b"\x00",
            "Build/g.data.gz": b"\x1f\x8b",
            "a.png": b"\x89PNG",
            "model.bin": b"\x00",
        }
        run(storage, claim_for(storage, simple_zip(tmp_path / "g.zip", files).read_bytes()), rules, tmp_path)

        def meta(name: str) -> dict[str, str | None]:
            return storage.metadata[(GAMES, f"moon-runner/v1/{name}")]

        assert meta("index.html")["type"] == "text/html; charset=utf-8"
        assert meta("game.js")["type"] == "text/javascript; charset=utf-8"
        assert meta("Build/g.wasm.br") == {
            "type": "application/wasm",
            "encoding": "br",
            "cache": "public, max-age=31536000, immutable",
        }
        assert meta("Build/g.data.gz")["encoding"] == "gzip"
        assert meta("a.png")["encoding"] is None
        assert meta("model.bin")["type"] == "application/octet-stream"

    def test_flattens_a_wrapping_folder_and_drops_system_junk(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        files = {
            "game/index.html": INDEX,
            "game/game.js": b"x",
            "__MACOSX/game/._index.html": b"junk",
            "game/.DS_Store": b"junk",
        }
        run(storage, claim_for(storage, simple_zip(tmp_path / "g.zip", files).read_bytes()), rules, tmp_path)
        assert storage.keys(GAMES) == ["moon-runner/v1/game.js", "moon-runner/v1/index.html"]

    def test_the_uploaded_zip_is_deleted_from_quarantine(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        claimed = claim_for(storage, simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes())
        run(storage, claimed, rules, tmp_path)
        assert storage.keys(QUARANTINE) == []

    def test_a_second_version_goes_to_its_own_folder(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        data = simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes()
        run(storage, claim_for(storage, data, number=1), rules, tmp_path)
        run(storage, claim_for(storage, data, number=2), rules, tmp_path)
        assert storage.keys(GAMES) == ["moon-runner/v1/index.html", "moon-runner/v2/index.html"]

    def test_leftovers_of_a_previous_attempt_are_replaced(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        storage.put(GAMES, "moon-runner/v1/stale-file.js", b"left by a crashed attempt")
        run(
            storage,
            claim_for(storage, simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes()),
            rules,
            tmp_path,
        )
        assert storage.keys(GAMES) == ["moon-runner/v1/index.html"]

    def test_detects_the_isolation_requirement(self, tmp_path: Path, rules: UploadRules, storage: FakeStorage) -> None:
        html = b"<html><script>const GODOT_THREADS_ENABLED = true;</script></html>"
        files = {"index.html": html, "index.js": b"var Godot = 1", "index.pck": b"GDPC", "index.wasm": b"\x00asm"}
        queue = run(storage, claim_for(storage, simple_zip(tmp_path / "g.zip", files).read_bytes()), rules, tmp_path)
        assert queue.completed[0]["needs_isolation"] is True

    def test_the_work_directory_is_left_empty(self, tmp_path: Path, rules: UploadRules, storage: FakeStorage) -> None:
        run(
            storage,
            claim_for(storage, simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes()),
            rules,
            tmp_path,
        )
        assert list((tmp_path / "work").iterdir()) == []


class TestRejectedGames:
    def reject(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage, data: bytes, **claim: object
    ) -> FakeQueue:
        queue = run(storage, claim_for(storage, data, **claim), rules, tmp_path)  # type: ignore[arg-type]
        assert queue.completed == [] and queue.released == []
        assert storage.keys(GAMES) == [], "a rejected zip must never reach the games bucket"
        assert storage.keys(QUARANTINE) == [], "and it is removed from quarantine"
        return queue

    def test_reports_the_validator_error_with_its_parameters(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        queue = self.reject(tmp_path, rules, storage, simple_zip(tmp_path / "g.zip", {"game.js": b"x"}).read_bytes())
        assert queue.failed == [
            {"version_id": "version-1", "code": "NO_INDEX_HTML", "params": {"file": "index.html"}, "scan_flags": []}
        ]

    def test_a_path_traversal_zip_publishes_nothing(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        data = forge_zip(
            tmp_path / "g.zip", [ForgedEntry("index.html", INDEX), ForgedEntry("../../evil.html", b"x")]
        ).read_bytes()
        assert self.reject(tmp_path, rules, storage, data).failed[0]["code"] == "UNSAFE_PATH"

    def test_an_executable_hidden_in_a_later_file_publishes_nothing(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        files = {"index.html": INDEX, "a.js": b"x" * 100_000, "z.ogg": b"\x7fELF" + b"\x00" * 100}
        assert (
            self.reject(tmp_path, rules, storage, simple_zip(tmp_path / "g.zip", files).read_bytes()).failed[0]["code"]
            == "EXECUTABLE_FILE"
        )

    def test_something_that_is_not_a_zip(self, tmp_path: Path, rules: UploadRules, storage: FakeStorage) -> None:
        assert self.reject(tmp_path, rules, storage, b"not a zip at all").failed[0]["code"] == "NOT_A_ZIP"

    def test_the_real_size_is_checked_before_downloading(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        data = simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes()
        storage.fail_download = True
        queue = self.reject(tmp_path, rules, storage, data, declared=len(data) + 5)
        assert queue.failed[0]["code"] == "CORRUPT_ARCHIVE"

    def test_an_oversized_object_is_rejected_without_downloading_it(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        small = rules.limits.__class__(**{**rules.limits.__dict__, "max_zip_bytes": 100})
        tight = rules.__class__(**{**rules.__dict__, "limits": small})
        data = simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes()
        storage.fail_download = True
        queue = FakeQueue([claim_for(storage, data)])
        Worker(queue, storage, tight, make_config(tmp_path)).run_once()
        assert queue.failed[0]["code"] == "ZIP_TOO_LARGE" and queue.failed[0]["params"] == {"limit": 100}

    def test_a_missing_object_is_a_corrupt_upload(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        queue = FakeQueue([ClaimedVersion("v", "g", "moon-runner", 1, "missing.zip", 10)])
        Worker(queue, storage, rules, make_config(tmp_path)).run_once()
        assert queue.failed[0]["code"] == "CORRUPT_ARCHIVE"


class TestInfrastructureFailures:
    def test_a_storage_outage_gives_the_version_back_instead_of_rejecting_it(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        claimed = claim_for(storage, simple_zip(tmp_path / "g.zip", {"index.html": INDEX}).read_bytes())
        storage.fail_download = True
        queue = run(storage, claimed, rules, tmp_path)
        assert queue.released == ["version-1"] and queue.failed == [] and queue.completed == []
        assert storage.keys(QUARANTINE) == [claimed.quarantine_key], "the zip stays for the next attempt"

    def test_a_failure_halfway_through_publishing_cleans_up_what_was_uploaded(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        files = {"index.html": INDEX, **{f"f{n}.js": b"x" for n in range(10)}}
        claimed = claim_for(storage, simple_zip(tmp_path / "g.zip", files).read_bytes())
        storage.fail_uploads_after = 3
        queue = run(storage, claimed, rules, tmp_path)
        assert queue.released == ["version-1"] and queue.completed == []
        assert storage.keys(GAMES) == [], "no half-published game is left behind"
        assert storage.keys(QUARANTINE) == [claimed.quarantine_key]


class TestLoop:
    def test_run_once_is_idle_when_the_queue_is_empty(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        assert Worker(FakeQueue(), storage, rules, make_config(tmp_path)).run_once() is False

    def test_it_keeps_going_after_a_queue_error_and_stops_when_asked(
        self, tmp_path: Path, rules: UploadRules, storage: FakeStorage
    ) -> None:
        class FlakyQueue(FakeQueue):
            def claim(self, worker_name: str) -> ClaimedVersion | None:
                if self.resets == 0:
                    raise ConnectionError("database restarting")
                stop.set()
                return None

        stop = threading.Event()
        queue = FlakyQueue()
        config = make_config(tmp_path)
        import trafal_worker.runner as runner_module

        original = runner_module.ERROR_BACKOFF_SECONDS
        runner_module.ERROR_BACKOFF_SECONDS = 0.01
        try:
            Worker(queue, storage, rules, config).run_forever(stop)
        finally:
            runner_module.ERROR_BACKOFF_SECONDS = original
        assert queue.resets == 1
        assert config.heartbeat_file.exists()


class TestConfig:
    def test_lists_everything_that_is_missing(self) -> None:
        with pytest.raises(
            ConfigError, match="S3_ACCESS_KEY_ID, S3_ENDPOINT, S3_SECRET_ACCESS_KEY, WORKER_DATABASE_URL"
        ):
            load_config({})

    def test_applies_defaults(self) -> None:
        config = load_config(
            {
                "WORKER_DATABASE_URL": "postgresql://x",
                "S3_ENDPOINT": "http://s3",
                "S3_ACCESS_KEY_ID": "a",
                "S3_SECRET_ACCESS_KEY": "b",
            }
        )
        assert (config.quarantine_bucket, config.games_bucket, config.s3_region, config.upload_threads) == (
            "quarantine",
            "games",
            "auto",
            8,
        )
