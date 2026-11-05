import logging
import signal
import sys
import threading

from .config import ConfigError, load_config
from .rules import load_rules
from .runner import Worker
from .storage import S3Storage
from .version_queue import PostgresVersionQueue


def main() -> int:
    """Starts the worker: reads its settings, then processes uploaded games until it receives SIGTERM or SIGINT."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s", stream=sys.stdout)
    try:
        config = load_config()
    except ConfigError as error:
        logging.getLogger("trafal_worker").error("%s", error)
        return 2
    stop = threading.Event()
    for signal_number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signal_number, lambda *_: stop.set())
    worker = Worker(PostgresVersionQueue(config.database_url), S3Storage(config), load_rules(), config)
    logging.getLogger("trafal_worker").info("worker %s ready", config.worker_name)
    worker.run_forever(stop)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
