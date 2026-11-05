import sys
import time

from .config import load_config

MAX_SILENCE_SECONDS = 60


def main() -> int:
    """Exit code 0 if the worker loop touched its heartbeat file recently, 1 otherwise (container healthcheck)."""
    try:
        heartbeat = load_config().heartbeat_file
        return 0 if time.time() - heartbeat.stat().st_mtime < MAX_SILENCE_SECONDS else 1
    except Exception:
        return 1


if __name__ == "__main__":
    sys.exit(main())
