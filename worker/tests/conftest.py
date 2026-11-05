from pathlib import Path

import pytest

from trafal_worker.rules import UploadRules, load_rules

INDEX = b"<!doctype html><title>Juego</title><script src=game.js></script>"


@pytest.fixture(scope="session")
def rules() -> UploadRules:
    return load_rules()


@pytest.fixture
def work(tmp_path: Path) -> Path:
    return tmp_path
