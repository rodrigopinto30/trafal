import logging
import threading
from pathlib import Path

from .config import WorkerConfig
from .errors import UploadRejected
from .processor import process_version
from .rules import UploadRules
from .storage import ObjectStorage
from .version_queue import ClaimedVersion, VersionQueue

LOGGER = logging.getLogger("trafal_worker")
ERROR_BACKOFF_SECONDS = 5.0


class Worker:
    """Takes versions from the queue one at a time, processes them and reports the result."""

    def __init__(self, queue: VersionQueue, storage: ObjectStorage, rules: UploadRules, config: WorkerConfig) -> None:
        self._queue = queue
        self._storage = storage
        self._rules = rules
        self._config = config

    def _discard_upload(self, claimed: ClaimedVersion) -> None:
        try:
            self._storage.delete(self._config.quarantine_bucket, claimed.quarantine_key)
        except Exception:
            LOGGER.warning("could not delete %s from quarantine", claimed.quarantine_key, exc_info=True)

    def run_once(self) -> bool:
        """Processes one version if there is one. Returns True when it reached a verdict (accepted or rejected)."""
        claimed = self._queue.claim(self._config.worker_name)
        if claimed is None:
            return False
        LOGGER.info("processing version %s of game %s", claimed.version_number, claimed.public_id)
        try:
            processed = process_version(claimed, self._storage, self._rules, self._config)
        except UploadRejected as rejection:
            LOGGER.info("rejected %s v%s: %s", claimed.public_id, claimed.version_number, rejection.code.value)
            self._queue.fail(claimed.version_id, rejection.code.value, rejection.params, [])
            self._discard_upload(claimed)
            return True
        except Exception:
            LOGGER.exception(
                "could not process %s v%s; it goes back to the queue", claimed.public_id, claimed.version_number
            )
            self._queue.release(claimed.version_id)
            return False
        report = processed.report
        self._queue.complete(
            claimed.version_id,
            report.file_count,
            report.unpacked_bytes,
            processed.zip_bytes,
            processed.needs_isolation,
            list(report.scan_flags),
        )
        self._discard_upload(claimed)
        LOGGER.info(
            "published %s v%s (%d files)",
            claimed.public_id,
            claimed.version_number,
            report.file_count,
        )
        return True

    def run_forever(self, stop: threading.Event) -> None:
        """Polls the queue until `stop` is set. A database or network failure is logged and retried, never fatal."""
        while not stop.is_set():
            self._beat()
            try:
                worked = self.run_once()
            except Exception:
                LOGGER.exception("queue error; reconnecting in %.0f s", ERROR_BACKOFF_SECONDS)
                self._queue.reset()
                stop.wait(ERROR_BACKOFF_SECONDS)
                continue
            if not worked:
                stop.wait(self._config.poll_interval_seconds)

    def _beat(self) -> None:
        try:
            Path(self._config.heartbeat_file).touch()
        except OSError:
            LOGGER.debug("could not write the heartbeat file", exc_info=True)
