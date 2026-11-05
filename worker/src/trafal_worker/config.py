import os
import socket
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path


class ConfigError(Exception):
    """A required setting is missing: the worker refuses to start instead of failing later in a confusing way."""


@dataclass(frozen=True)
class WorkerConfig:
    """Everything the worker needs from its environment. Credentials only ever come from environment variables."""

    database_url: str
    s3_endpoint: str
    s3_region: str
    s3_access_key_id: str
    s3_secret_access_key: str
    quarantine_bucket: str
    games_bucket: str
    work_dir: Path
    worker_name: str
    poll_interval_seconds: float
    upload_threads: int
    heartbeat_file: Path


REQUIRED = {
    "database_url": "WORKER_DATABASE_URL",
    "s3_endpoint": "S3_ENDPOINT",
    "s3_access_key_id": "S3_ACCESS_KEY_ID",
    "s3_secret_access_key": "S3_SECRET_ACCESS_KEY",
}


def load_config(env: Mapping[str, str] | None = None) -> WorkerConfig:
    """Reads the settings from the environment (or a mapping) and fails listing everything that is missing."""
    source = os.environ if env is None else env
    missing = [name for name in REQUIRED.values() if not source.get(name)]
    if missing:
        raise ConfigError("Missing environment variables: " + ", ".join(sorted(missing)))
    return WorkerConfig(
        database_url=source[REQUIRED["database_url"]],
        s3_endpoint=source[REQUIRED["s3_endpoint"]],
        s3_region=source.get("S3_REGION") or "auto",
        s3_access_key_id=source[REQUIRED["s3_access_key_id"]],
        s3_secret_access_key=source[REQUIRED["s3_secret_access_key"]],
        quarantine_bucket=source.get("S3_BUCKET_QUARANTINE") or "quarantine",
        games_bucket=source.get("S3_BUCKET_GAMES") or "games",
        work_dir=Path(source.get("WORKER_WORK_DIR") or "/work"),
        worker_name=source.get("WORKER_NAME") or f"worker-{socket.gethostname()}-{os.getpid()}",
        poll_interval_seconds=float(source.get("WORKER_POLL_SECONDS") or "2"),
        upload_threads=int(source.get("WORKER_UPLOAD_THREADS") or "8"),
        heartbeat_file=Path(source.get("WORKER_HEARTBEAT_FILE") or "/tmp/worker-heartbeat"),
    )
