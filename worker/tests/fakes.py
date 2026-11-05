from pathlib import Path

from trafal_worker.errors import ErrorParams
from trafal_worker.version_queue import ClaimedVersion


class FakeStorage:
    """In-memory object storage that records what the worker does to it."""

    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.metadata: dict[tuple[str, str], dict[str, str | None]] = {}
        self.fail_uploads_after: int | None = None
        self.fail_download = False
        self.deleted: list[tuple[str, str]] = []
        self.uploads = 0

    def put(self, bucket: str, key: str, data: bytes) -> None:
        self.objects[(bucket, key)] = data

    def keys(self, bucket: str) -> list[str]:
        return sorted(key for (name, key) in self.objects if name == bucket)

    def object_size(self, bucket: str, key: str) -> int | None:
        data = self.objects.get((bucket, key))
        return None if data is None else len(data)

    def download(self, bucket: str, key: str, destination: Path) -> None:
        if self.fail_download:
            raise OSError("storage is down")
        destination.write_bytes(self.objects[(bucket, key)])

    def upload(
        self, bucket: str, key: str, source: Path, content_type: str, content_encoding: str | None, cache_control: str
    ) -> None:
        self.uploads += 1
        if self.fail_uploads_after is not None and self.uploads > self.fail_uploads_after:
            raise OSError("storage is down")
        self.objects[(bucket, key)] = source.read_bytes()
        self.metadata[(bucket, key)] = {"type": content_type, "encoding": content_encoding, "cache": cache_control}

    def delete(self, bucket: str, key: str) -> None:
        self.deleted.append((bucket, key))
        self.objects.pop((bucket, key), None)

    def delete_prefix(self, bucket: str, prefix: str) -> None:
        for name, key in [item for item in self.objects if item[0] == bucket and item[1].startswith(prefix)]:
            del self.objects[(name, key)]


class FakeQueue:
    """In-memory queue that records the verdicts the worker reports."""

    def __init__(self, versions: list[ClaimedVersion] | None = None) -> None:
        self.pending = list(versions or [])
        self.completed: list[dict[str, object]] = []
        self.failed: list[dict[str, object]] = []
        self.released: list[str] = []
        self.resets = 0

    def claim(self, worker_name: str) -> ClaimedVersion | None:
        return self.pending.pop(0) if self.pending else None

    def complete(
        self,
        version_id: str,
        file_count: int,
        unpacked_bytes: int,
        size_bytes: int,
        engine: str,
        needs_isolation: bool,
        scan_flags: list[str],
    ) -> None:
        self.completed.append(
            {
                "version_id": version_id,
                "file_count": file_count,
                "unpacked_bytes": unpacked_bytes,
                "size_bytes": size_bytes,
                "engine": engine,
                "needs_isolation": needs_isolation,
                "scan_flags": scan_flags,
            }
        )

    def fail(self, version_id: str, error_code: str, error_params: ErrorParams, scan_flags: list[str]) -> None:
        self.failed.append(
            {"version_id": version_id, "code": error_code, "params": error_params, "scan_flags": scan_flags}
        )

    def release(self, version_id: str) -> None:
        self.released.append(version_id)

    def reset(self) -> None:
        self.resets += 1
