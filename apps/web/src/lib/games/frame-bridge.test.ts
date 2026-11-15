import { describe, expect, it } from "vitest";
import { helloMessage, isBridgeReady, LOCKED_KEYS, muteMessage, readMutedPreference, saveMutedPreference } from "./frame-bridge";

describe("the messages of the platform bridge", () => {
  it("builds the two messages the player sends", () => {
    expect(muteMessage(true)).toEqual({ trafal: 1, type: "mute", muted: true });
    expect(muteMessage(false)).toEqual({ trafal: 1, type: "mute", muted: false });
    expect(helloMessage()).toEqual({ trafal: 1, type: "hello" });
  });

  it("trusts only the exact «ready» message", () => {
    expect(isBridgeReady({ trafal: 1, type: "ready" })).toBe(true);
    for (const other of [null, undefined, "ready", 1, [], {}, { trafal: 2, type: "ready" }, { trafal: 1, type: "mute" }, { type: "ready" }, { trafal: "1", type: "ready" }]) {
      expect(isBridgeReady(other)).toBe(false);
    }
  });
});

describe("the keys handed to the game in fullscreen", () => {
  it("covers letters, digits, the arrows and the function keys a game uses", () => {
    for (const key of ["KeyA", "KeyW", "KeyZ", "Digit0", "Digit9", "Space", "Tab", "ArrowLeft", "Backquote", "F5"]) expect(LOCKED_KEYS).toContain(key);
  });

  it("leaves Escape and F11 to the browser so there is always a way out", () => {
    for (const key of ["Escape", "F11", "F12", "ControlLeft", "MetaLeft"]) expect(LOCKED_KEYS).not.toContain(key);
    expect(new Set(LOCKED_KEYS).size).toBe(LOCKED_KEYS.length);
  });
});

describe("the sound preference", () => {
  function fakeStorage(initial?: string) {
    const data = new Map<string, string>(initial === undefined ? [] : [["trafal:muted", initial]]);
    return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
  }

  it("is on by default and remembers a mute", () => {
    const storage = fakeStorage();
    expect(readMutedPreference(storage)).toBe(false);
    saveMutedPreference(true, storage);
    expect(storage.data.get("trafal:muted")).toBe("1");
    expect(readMutedPreference(storage)).toBe(true);
    saveMutedPreference(false, storage);
    expect(readMutedPreference(storage)).toBe(false);
  });

  it("does not break when storage is missing or refuses", () => {
    expect(readMutedPreference(null)).toBe(false);
    expect(() => saveMutedPreference(true, null)).not.toThrow();
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readMutedPreference(hostile)).toBe(false);
    expect(() => saveMutedPreference(true, hostile)).not.toThrow();
  });
});
