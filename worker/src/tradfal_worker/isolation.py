import re
from collections.abc import Callable, Sequence

READ_LIMIT_BYTES = 512 * 1024
GODOT_THREADS_ON = re.compile(r"GODOT_THREADS_ENABLED\s*=\s*true")
WorkerScriptName = re.compile(r"(^|/)[^/]+\.worker\.js$")

ReadText = Callable[[str], str]


def _is_godot_export(files: Sequence[str], read: ReadText) -> bool:
    names = [name.lower() for name in files]
    if any(name.endswith(".pck") for name in names):
        return True
    return "index.js" in names and "godot" in read("index.js").lower()


def needs_cross_origin_isolation(files: Sequence[str], read: ReadText) -> bool:
    """
    Whether the game has to be served with cross-origin isolation (COOP/COEP): only exports with threads that use
    shared memory do. `read(name)` returns the beginning of a file as text. It is a delivery detail, never a security
    decision: a game that does not need it simply gets the standard headers.
    """
    if not _is_godot_export(files, read):
        return False
    index = read("index.html") if "index.html" in files else ""
    return any(WorkerScriptName.search(name) for name in files) or bool(GODOT_THREADS_ON.search(index))
