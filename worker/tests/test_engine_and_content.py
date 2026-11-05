import pytest

from tests.conftest import INDEX  # noqa: F401
from trafal_worker.content_types import FALLBACK_CONTENT_TYPE, describe_file
from trafal_worker.engine import EngineDetection, detect_engine
from trafal_worker.rules import UploadRules


def detect(files: dict[str, str]) -> EngineDetection:
    names = list(files)
    return detect_engine(names, lambda name: files.get(name, ""))


class TestEngineDetection:
    @pytest.mark.parametrize(
        ("files", "engine"),
        [
            ({"index.html": "", "Build/game.loader.js": "", "Build/game.data.unityweb": ""}, "unity"),
            ({"index.html": "", "UnityLoader.js": ""}, "unity"),
            ({"index.html": "", "index.js": "Godot engine", "index.pck": "", "index.wasm": ""}, "godot"),
            ({"index.html": "", "index.js": "this is the Godot export template"}, "godot"),
            ({"index.html": "", "scripts/c3runtime.js": ""}, "construct"),
            ({"index.html": "", "html5game/game.js": ""}, "gamemaker"),
            ({"index.html": "<tw-storydata name='x'>", "story.js": ""}, "twine"),
            ({"index.html": "<script>var pico8_state = []</script>"}, "pico8"),
            ({"index.html": "<script src='scratch-vm.js'></script>"}, "scratch"),
            ({"index.html": "<script src='lib/phaser.min.js'></script>", "game.js": ""}, "phaser"),
            ({"index.html": "", "js/phaser.min.js": ""}, "phaser"),
            ({"index.html": "<canvas></canvas>", "game.js": "plain canvas"}, "other"),
        ],
    )
    def test_recognizes_common_engines(self, files: dict[str, str], engine: str) -> None:
        assert detect(files).engine == engine

    def test_godot_with_threads_needs_isolation(self) -> None:
        assert detect({"index.html": "const GODOT_THREADS_ENABLED = true;", "index.pck": ""}).needs_isolation is True
        assert detect({"index.html": "const GODOT_THREADS_ENABLED = false;", "index.pck": ""}).needs_isolation is False
        assert detect({"index.html": "", "index.pck": "", "index.worker.js": ""}).needs_isolation is True

    def test_other_engines_never_need_isolation(self) -> None:
        assert detect({"index.html": "", "Build/a.loader.js": ""}).needs_isolation is False


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
