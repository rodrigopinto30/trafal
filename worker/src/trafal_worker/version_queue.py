from dataclasses import dataclass
from typing import Protocol

import psycopg
from psycopg.types.json import Jsonb

from .errors import ErrorParams


@dataclass(frozen=True)
class ClaimedVersion:
    """A version taken from the queue, with what the worker needs to find and publish its zip."""

    version_id: str
    game_id: str
    public_id: str
    version_number: int
    quarantine_key: str
    declared_size_bytes: int | None


class VersionQueue(Protocol):
    """The queue of uploaded versions: in production the `worker` schema of Postgres, reached with a minimal role."""

    def claim(self, worker_name: str) -> ClaimedVersion | None: ...

    def complete(
        self,
        version_id: str,
        file_count: int,
        unpacked_bytes: int,
        size_bytes: int,
        engine: str,
        needs_isolation: bool,
        scan_flags: list[str],
    ) -> None: ...

    def fail(self, version_id: str, error_code: str, error_params: ErrorParams, scan_flags: list[str]) -> None: ...

    def release(self, version_id: str) -> None: ...

    def reset(self) -> None: ...


class PostgresVersionQueue:
    """
    VersionQueue over a direct Postgres connection as the `game_worker` role, which can only call the four functions
    of the `worker` schema. The connection is opened on first use and dropped on `reset()`, so a restarted database
    is picked up again.
    """

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._connection: psycopg.Connection | None = None

    def _connect(self) -> psycopg.Connection:
        if self._connection is None or self._connection.closed:
            self._connection = psycopg.connect(self._database_url, autocommit=True, connect_timeout=10)
        return self._connection

    def reset(self) -> None:
        if self._connection is not None:
            try:
                self._connection.close()
            finally:
                self._connection = None

    def claim(self, worker_name: str) -> ClaimedVersion | None:
        with self._connect().cursor() as cursor:
            cursor.execute("select * from worker.claim_version(%s)", (worker_name,))
            row = cursor.fetchone()
        if row is None:
            return None
        version_id, game_id, public_id, number, key, declared = row
        return ClaimedVersion(
            str(version_id),
            str(game_id),
            str(public_id),
            int(number),
            str(key),
            None if declared is None else int(declared),
        )

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
        with self._connect().cursor() as cursor:
            cursor.execute(
                "select worker.complete_version(%s::uuid, %s, %s, %s, %s, %s, %s)",
                (version_id, file_count, unpacked_bytes, size_bytes, engine, needs_isolation, Jsonb(scan_flags)),
            )

    def fail(self, version_id: str, error_code: str, error_params: ErrorParams, scan_flags: list[str]) -> None:
        with self._connect().cursor() as cursor:
            cursor.execute(
                "select worker.fail_version(%s::uuid, %s, %s, %s)",
                (version_id, error_code, Jsonb(error_params), Jsonb(scan_flags)),
            )

    def release(self, version_id: str) -> None:
        with self._connect().cursor() as cursor:
            cursor.execute("select worker.release_version(%s::uuid)", (version_id,))
