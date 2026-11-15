/**
 * What the player and the gateway's platform bridge say to each other (see apps/gateway/src/bridge.ts). The player only ever sends
 * `hello` and `mute`, and only ever trusts one message from the game's frame: `ready`.
 */
export const BRIDGE_PROTOCOL = 1;

export type MuteMessage = { trafal: typeof BRIDGE_PROTOCOL; type: "mute"; muted: boolean };
export type HelloMessage = { trafal: typeof BRIDGE_PROTOCOL; type: "hello" };

export function muteMessage(muted: boolean): MuteMessage {
  return { trafal: BRIDGE_PROTOCOL, type: "mute", muted };
}

export function helloMessage(): HelloMessage {
  return { trafal: BRIDGE_PROTOCOL, type: "hello" };
}

/** True only for the bridge's own «ready» message: anything else a game posts is ignored. */
export function isBridgeReady(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Record<string, unknown>;
  return message.trafal === BRIDGE_PROTOCOL && message.type === "ready";
}

/** Keys the player asks the browser to hand to the game in fullscreen (Keyboard Lock API), so combinations like Ctrl+W or Ctrl+R reach the game instead of closing or reloading the tab. Escape and F11 stay with the browser, as the way out. */
export const LOCKED_KEYS: readonly string[] = [
  ...Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`),
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
  ...Array.from({ length: 10 }, (_, index) => `F${index + 1}`),
  "Space",
  "Tab",
  "Enter",
  "Backspace",
  "Backquote",
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Semicolon",
  "Quote",
  "Comma",
  "Period",
  "Slash",
  "Backslash",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

type KeyboardLockApi = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };

function keyboardApi(): KeyboardLockApi | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard ?? null;
}

/** Asks for the game's keys while in fullscreen; browsers without the API (Firefox, Safari) just keep their shortcuts. */
export async function lockGameKeys(): Promise<void> {
  try {
    await keyboardApi()?.lock?.([...LOCKED_KEYS]);
  } catch {
    // The browser may refuse (not fullscreen anymore, or no API): the game still plays, only the shortcuts stay.
  }
}

export function unlockGameKeys(): void {
  try {
    keyboardApi()?.unlock?.();
  } catch {
    // Nothing to give back.
  }
}

const MUTED_KEY = "trafal:muted";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

/** The sound preference of this browser (a mute button that remembers across games); false when storage is not available. */
export function readMutedPreference(storage: Storage | null = safeStorage()): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMutedPreference(muted: boolean, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Private windows may refuse storage: the preference just lasts until the page closes.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
