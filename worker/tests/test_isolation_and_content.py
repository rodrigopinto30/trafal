import pytest

from tests.conftest import INDEX  # noqa: F401
from trafal_worker.content_types import FALLBACK_CONTENT_TYPE, describe_file
from trafal_worker.isolation import needs_cross_origin_isolation
from trafal_worker.rules import UploadRules


def needs_isolation(files: dict[str, str]) -> bool:
    return needs_cross_origin_isolation(list(files), lambda name: files.get(name, ""))


class TestIsolation:
    def test_godot_with_threads_needs_isolation(self) -> None:
        assert needs_isolation({"index.html": "const GODOT_THREADS_ENABLED = true;", "index.pck": ""}) is True
        assert needs_isolation({"index.html": "const GODOT_THREADS_ENABLED = false;", "index.pck": ""}) is False
        assert needs_isolation({"index.html": "", "index.pck": "", "index.worker.js": ""}) is True
        threaded_page = "GODOT_THREADS_ENABLED = true"
        assert needs_isolation({"index.html": threaded_page, "index.js": "this is the Godot export"}) is True

    @pytest.mark.parametrize(
        "files",
        [
            {"index.html": "", "Build/a.loader.js": ""},
            {"index.html": "<canvas></canvas>", "game.js": "plain canvas"},
            {"index.html": "GODOT_THREADS_ENABLED = true", "game.js": "not an export"},
            {"index.html": "", "js/phaser.min.js": "", "sound.worker.js": ""},
        ],
    )
    def test_other_games_never_need_isolation(self, files: dict[str, str]) -> None:
        assert needs_isolation(files) is False


class TestContentTypes:
    @pytest.mark.parametrize(
        ("name", "content_type", "encoding"),
        [
            ("index.html", "text/html; charset=utf-8", None),
            ("a/b/game.js", "text/javascript; charset=utf-8", None),
            ("style.CSS", "text/css; charset=utf-8", None),
            ("Build/game.wasm", "application/wasm", None),
            ("Build/game.wasm.br", "application/wasm", "br"),
            ("Build/game.data.gz", FALLBACK_CONTENT_TYPE, "gzip"),
            ("Build/game.framework.js.br", "text/javascript; charset=utf-8", "br"),
            ("music.ogg", "audio/ogg", None),
            ("font.woff2", "font/woff2", None),
            ("logo.svg", "image/svg+xml", None),
            ("level.tmx", FALLBACK_CONTENT_TYPE, None),
            ("index.pck", FALLBACK_CONTENT_TYPE, None),
        ],
    )
    def test_describes_how_to_serve_a_file(
        self, rules: UploadRules, name: str, content_type: str, encoding: str | None
    ) -> None:
        delivery = describe_file(name, rules)
        assert (delivery.content_type, delivery.content_encoding) == (content_type, encoding)

    def test_every_allowed_extension_has_a_deliberate_type(self, rules: UploadRules) -> None:
        opaque = {
            name
            for name in sorted(rules.allowed_extensions)
            if describe_file(f"x.{name}", rules).content_type == FALLBACK_CONTENT_TYPE
        }
        assert opaque <= {
            "basis",
            "data",
            "dat",
            "pck",
            "unx",
            "mem",
            "bytes",
            "unityweb",
            "unity3d",
            "atlas",
            "fnt",
            "tmx",
            "tsx",
            "obj",
            "mtl",
            "bin",
        }
