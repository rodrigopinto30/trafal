import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass

READ_LIMIT_BYTES = 512 * 1024
GODOT_THREADS_ON = re.compile(r"GODOT_THREADS_ENABLED\s*=\s*true")
WorkerScriptName = re.compile(r"(^|/)[^/]+\.worker\.js$")


@dataclass(frozen=True)
class EngineDetection:
    """The engine a game was made with (an id of the `engines` table) and whether it needs cross-origin isolation."""

    engine: str
    needs_isolation: bool


ReadText = Callable[[str], str]


def _names(files: Sequence[str]) -> list[str]:
    return [name.lower() for name in files]


def _has_basename(files: Sequence[str], basename: str) -> bool:
    return any(name == basename or name.endswith("/" + basename) for name in _names(files))


def _unity(files: Sequence[str]) -> bool:
    names = _names(files)
    return any(name.endswith((".unityweb", ".framework.js", ".loader.js")) for name in names) or _has_basename(
        files, "unityloader.js"
    )


def _godot(files: Sequence[str], read: ReadText) -> bool:
    if any(name.endswith(".pck") for name in _names(files)):
        return True
    return "index.js" in _names(files) and "godot" in read("index.js").lower()


def _construct(files: Sequence[str]) -> bool:
    return _has_basename(files, "c3runtime.js") or _has_basename(files, "c2runtime.js")


def _gamemaker(files: Sequence[str]) -> bool:
    names = _names(files)
    return (
        any(name.startswith("html5game/") for name in names)
        or _has_basename(files, "runner.data")
        or _has_basename(files, "runner.wasm")
    )


def _index_html(files: Sequence[str], read: ReadText) -> str:
    return read("index.html").lower() if "index.html" in files else ""


def _phaser(files: Sequence[str], read: ReadText) -> bool:
    if any("phaser" in name.rsplit("/", 1)[-1] and name.endswith(".js") for name in _names(files)):
        return True
    return "phaser" in _index_html(files, read)


def detect_engine(files: Sequence[str], read: ReadText) -> EngineDetection:
    """
    Guesses the engine from the file names and the start of a few files. `read(name)` returns the beginning of a file as
    text. It is a guess to label the game, never a security decision: an «other» result is always acceptable.
    """
    html = _index_html(files, read)
    if _unity(files):
        return EngineDetection("unity", False)
    if _godot(files, read):
        threads = any(WorkerScriptName.search(name) for name in files) or bool(
            GODOT_THREADS_ON.search(read("index.html") if "index.html" in files else "")
        )
        return EngineDetection("godot", threads)
    if _construct(files):
        return EngineDetection("construct", False)
    if _gamemaker(files):
        return EngineDetection("gamemaker", False)
    if "<tw-storydata" in html or "tw-story" in html:
        return EngineDetection("twine", False)
    if "pico8_" in html or any(name.endswith(".p8.png") for name in _names(files)):
        return EngineDetection("pico8", False)
    if any(marker in html for marker in ("scratch-vm", "turbowarp", "forkphorus", ".sb3")):
        return EngineDetection("scratch", False)
    if _phaser(files, read):
        return EngineDetection("phaser", False)
    return EngineDetection("other", False)
