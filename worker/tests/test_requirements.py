import re
from pathlib import Path

WORKER = Path(__file__).resolve().parent.parent


def pins(text: str) -> dict[str, str]:
    """Package (without extras, lowercased) and version of each «name==version» line."""
    found = re.findall(r"^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?==([^\s\\;]+)", text, flags=re.MULTILINE)
    return {name.lower(): version for name, version in found}


def test_the_hashed_lock_installs_exactly_the_versions_requirements_asks_for() -> None:
    wanted = pins((WORKER / "requirements.txt").read_text())
    locked = pins((WORKER / "requirements.lock").read_text())
    assert wanted
    for name, version in wanted.items():
        assert locked.get(name) == version, name


def test_every_locked_package_has_a_hash() -> None:
    blocks = re.split(r"\n(?=[A-Za-z0-9_.-]+==)", (WORKER / "requirements.lock").read_text())
    packages = [block for block in blocks if re.match(r"[A-Za-z0-9_.-]+==", block)]
    assert packages
    assert all("--hash=sha256:" in block for block in packages)
