const STORAGE_KEY = "tradfal:gifs-paused";
const CHANGE_EVENT = "tradfal:gifs-paused";

let pausedWithoutStorage = false;

/** Whether the person paused the games' GIFs. One choice for the whole site, remembered in this browser (or, without storage, on this page). */
export function readGifsPaused(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return pausedWithoutStorage;
  }
}

export function setGifsPaused(paused: boolean): void {
  try {
    if (paused) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    pausedWithoutStorage = paused;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls back when the choice changes, here or in another tab. */
export function subscribeGifsPaused(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
