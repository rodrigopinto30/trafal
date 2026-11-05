import contextlib
import tempfile
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from .config import WorkerConfig
from .content_types import describe_file
from .engine import READ_LIMIT_BYTES, EngineDetection, detect_engine
from .errors import ErrorCode, UploadRejected
from .rules import UploadRules
from .sink import DirectorySink
from .storage import ObjectStorage
from .validator import ValidationReport, validate_archive
from .version_queue import ClaimedVersion

GAME_CACHE_CONTROL = "public, max-age=31536000, immutable"


class TransientFailure(Exception):
    """Something went wrong that is not the zip's fault (storage or network): the version goes back to the queue."""


@dataclass(frozen=True)
class Processed:
    """A version that passed every check and whose files are published."""

    report: ValidationReport
    engine: EngineDetection
    zip_bytes: int


def games_prefix(claimed: ClaimedVersion) -> str:
    """Where the files of a version live in the games bucket: `<public id>/v<number>/`."""
    return f"{claimed.public_id}/v{claimed.version_number}/"


def _read_text(root: Path, files: list[str]) -> Callable[[str], str]:
    by_lowercase = {name.lower(): name for name in files}

    def read(name: str) -> str:
        actual = by_lowercase.get(name.lower())
        if actual is None:
            return ""
        with (root / actual).open("rb") as handle:
            return handle.read(READ_LIMIT_BYTES).decode("utf-8", errors="replace")

    return read


def _download(
    claimed: ClaimedVersion, storage: ObjectStorage, config: WorkerConfig, rules: UploadRules, destination: Path
) -> None:
    """Checks the real size of the uploaded object BEFORE downloading it: the declared size is only a claim."""
    size = storage.object_size(config.quarantine_bucket, claimed.quarantine_key)
    if size is None:
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    if size > rules.limits.max_zip_bytes:
        raise UploadRejected(ErrorCode.ZIP_TOO_LARGE, limit=rules.limits.max_zip_bytes)
    if claimed.declared_size_bytes is not None and size != claimed.declared_size_bytes:
        raise UploadRejected(ErrorCode.CORRUPT_ARCHIVE)
    try:
        storage.download(config.quarantine_bucket, claimed.quarantine_key, destination)
    except Exception as error:
        raise TransientFailure("could not download the zip from quarantine") from error


def _publish(
    claimed: ClaimedVersion,
    files: list[str],
    root: Path,
    storage: ObjectStorage,
    config: WorkerConfig,
    rules: UploadRules,
) -> None:
    prefix = games_prefix(claimed)

    def upload(name: str) -> None:
        delivery = describe_file(name, rules)
        storage.upload(
            config.games_bucket,
            prefix + name,
            root / name,
            delivery.content_type,
            delivery.content_encoding,
            GAME_CACHE_CONTROL,
        )

    try:
        storage.delete_prefix(config.games_bucket, prefix)
        with ThreadPoolExecutor(max_workers=max(1, config.upload_threads)) as pool:
            for _ in pool.map(upload, files):
                pass
    except Exception as error:
        with contextlib.suppress(Exception):
            storage.delete_prefix(config.games_bucket, prefix)
        raise TransientFailure("could not publish the game files") from error


def process_version(
    claimed: ClaimedVersion, storage: ObjectStorage, rules: UploadRules, config: WorkerConfig
) -> Processed:
    """
    Turns an uploaded zip into a published game: checks the real size, downloads it, validates it while extracting into
    a temporary directory, detects the engine and only then copies the files to the games bucket. Nothing reaches that
    bucket unless every check passed. Raises UploadRejected when the zip breaks a rule and TransientFailure for
    infrastructure errors.
    """
    config.work_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=config.work_dir, prefix="version-") as scratch:
        workspace = Path(scratch)
        zip_path = workspace / "upload.zip"
        extracted = workspace / "game"
        _download(claimed, storage, config, rules, zip_path)
        with DirectorySink(extracted) as sink:
            report = validate_archive(zip_path, rules, sink)
        files = list(report.files)
        engine = detect_engine(files, _read_text(extracted, files))
        _publish(claimed, files, extracted, storage, config, rules)
        return Processed(report=report, engine=engine, zip_bytes=report.zip_bytes)
