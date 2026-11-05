import json
import sys
from dataclasses import asdict
from pathlib import Path

from .errors import UploadRejected
from .rules import load_rules
from .validator import validate_archive


def main(argv: list[str]) -> int:
    """Valida un zip desde la terminal e imprime el resultado como JSON. Sale con 0 si es válido y 1 si se rechaza."""
    if len(argv) != 2:
        print("Uso: python -m trafal_worker.cli <archivo.zip>", file=sys.stderr)
        return 2
    try:
        report = validate_archive(Path(argv[1]), load_rules())
    except UploadRejected as rejection:
        print(json.dumps({"ok": False, "code": rejection.code.value, "params": rejection.params}, ensure_ascii=False))
        return 1
    print(json.dumps({"ok": True, **asdict(report)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
