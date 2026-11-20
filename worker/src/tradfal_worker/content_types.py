from dataclasses import dataclass

from .rules import UploadRules

CONTENT_TYPES = {
    "html": "text/html; charset=utf-8",
    "htm": "text/html; charset=utf-8",
    "js": "text/javascript; charset=utf-8",
    "mjs": "text/javascript; charset=utf-8",
    "cjs": "text/javascript; charset=utf-8",
    "css": "text/css; charset=utf-8",
    "json": "application/json",
    "map": "application/json",
    "wasm": "application/wasm",
    "xml": "application/xml",
    "txt": "text/plain; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "webmanifest": "application/manifest+json",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "avif": "image/avif",
    "bmp": "image/bmp",
    "ico": "image/x-icon",
    "cur": "image/x-icon",
    "ktx2": "image/ktx2",
    "dds": "image/vnd.ms-dds",
    "mp3": "audio/mpeg",
    "ogg": "audio/ogg",
    "opus": "audio/ogg",
    "wav": "audio/wav",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "flac": "audio/flac",
    "mid": "audio/midi",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "ogv": "video/ogg",
    "m4v": "video/mp4",
    "ttf": "font/ttf",
    "otf": "font/otf",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "eot": "application/vnd.ms-fontobject",
    "glb": "model/gltf-binary",
    "gltf": "model/gltf+json",
}
FALLBACK_CONTENT_TYPE = "application/octet-stream"
ENCODINGS = {"br": "br", "gz": "gzip"}


@dataclass(frozen=True)
class FileDelivery:
    """How a stored game file must be served: its content type and, for pre-compressed files, its content encoding."""

    content_type: str
    content_encoding: str | None


def describe_file(target: str, rules: UploadRules) -> FileDelivery:
    """
    Content type and encoding for a file of the game. «game.wasm.br» is served as `application/wasm` with
    `Content-Encoding: br`. Anything without a known type is served as an opaque download (never sniffed as a page).
    """
    parts = target.rsplit("/", 1)[-1].lower().split(".")
    encoding = None
    if len(parts) >= 3 and parts[-1] in rules.compressed_suffixes:
        encoding = ENCODINGS.get(parts[-1])
        parts = parts[:-1]
    extension = parts[-1] if len(parts) >= 2 else ""
    return FileDelivery(CONTENT_TYPES.get(extension, FALLBACK_CONTENT_TYPE), encoding)
