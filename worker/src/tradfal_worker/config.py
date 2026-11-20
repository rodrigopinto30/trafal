import ipaddress
import os
import socket
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


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


def _is_local_host(host: str) -> bool:
    """A database on this machine or its Docker network: a name without dots, a loopback address or the Docker host."""
    if host in ("localhost", "host.docker.internal") or ("." not in host and ":" not in host):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def require_verified_tls(database_url: str) -> None:
    """
    A database elsewhere (production) is only reached over TLS that checks the server's certificate: libpq's default
    would fall back to plain text and accept any certificate, so someone in the middle could pose as the database.
    """
    parts = urlsplit(database_url)
    if _is_local_host(parts.hostname or ""):
        return
    if parse_qs(parts.query).get("sslmode", [""])[0] != "verify-full":
        raise ConfigError(
            "WORKER_DATABASE_URL points to a remote database: "
            "add sslmode=verify-full and sslrootcert=<the provider's CA file>"
        )


def load_config(env: Mapping[str, str] | None = None) -> WorkerConfig:
    """Reads the settings from the environment (or a mapping) and fails listing everything that is missing."""
    source = os.environ if env is None else env
    missing = [name for name in REQUIRED.values() if not source.get(name)]
    if missing:
        raise ConfigError("Missing environment variables: " + ", ".join(sorted(missing)))
    require_verified_tls(source[REQUIRED["database_url"]])
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
