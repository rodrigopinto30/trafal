/**
 * The kinds of files a game's zip may contain, grouped for people (the upload guide). A test keeps the groups equal to the
 * allowed extensions of packages/shared/upload-rules.json, which the worker enforces.
 */
export const ALLOWED_FILE_GROUPS = {
  web: ["html", "htm", "js", "mjs", "cjs", "css", "json", "map", "wasm", "xml", "txt", "csv", "webmanifest"],
  images: ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "ico", "cur", "ktx2", "basis", "dds"],
  audio: ["mp3", "ogg", "opus", "wav", "m4a", "aac", "flac", "mid"],
  video: ["mp4", "webm", "ogv", "m4v"],
  fonts: ["ttf", "otf", "woff", "woff2", "eot"],
  models: ["glb", "gltf", "obj", "mtl", "bin"],
  engineData: ["data", "dat", "pck", "unx", "mem", "bytes", "unityweb", "unity3d", "atlas", "fnt", "tmx", "tsx"],
} as const;

export type AllowedFileGroup = keyof typeof ALLOWED_FILE_GROUPS;

/** Suffixes of pre-compressed files the site accepts on top of an allowed extension (for example game.wasm.br). */
export const COMPRESSED_SUFFIXES = ["br", "gz"] as const;
