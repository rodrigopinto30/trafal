/**
 * The platform bridge: a few lines of script the gateway puts at the top of every game page served inside Tradfal's frame, so the player
 * can offer controls that belong to the platform and work for any game: a mute button, which a page of another origin cannot otherwise
 * reach, and a way out for the keyboard (holding Escape for `LEAVE_HOLD_MS` asks the player to take the focus back, so a game that keeps
 * the Tab key cannot trap anyone; a short press still goes to the game). Its key listener is the first one the page registers, in the
 * capture phase of the window, so no game code runs before it or can stop it. It only listens to its parent window, announces itself with
 * a `ready` message and never reads anything from the game.
 */
export const BRIDGE_VERSION = 2;

export const LEAVE_HOLD_MS = 1000;

export const BRIDGE_SCRIPT = `(function () {
  var w = window;
  if (w.__tradfalBridge) return;
  w.__tradfalBridge = 1;
  var muted = false;
  var masters = [];
  var tracked = [];
  var mediaGet = null;
  var mediaSet = null;
  var later = w.setTimeout;
  var cancel = w.clearTimeout;
  var leaving = null;

  function ramp(gain) {
    try {
      var now = gain.context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(muted ? 0 : 1, now, 0.02);
    } catch (e) {}
  }

  try {
    var AudioNodeType = w.AudioNode;
    var DestinationType = w.AudioDestinationNode;
    var OfflineType = w.OfflineAudioContext || w.webkitOfflineAudioContext;
    if (AudioNodeType && DestinationType) {
      var byContext = new WeakMap();
      var connect = AudioNodeType.prototype.connect;
      var disconnect = AudioNodeType.prototype.disconnect;
      var live = function (target) {
        return target instanceof DestinationType && !(OfflineType && target.context instanceof OfflineType);
      };
      var masterOf = function (context) {
        var gain = byContext.get(context);
        if (!gain) {
          gain = context.createGain();
          gain.gain.value = muted ? 0 : 1;
          connect.call(gain, context.destination);
          byContext.set(context, gain);
          masters.push(gain);
        }
        return gain;
      };
      AudioNodeType.prototype.connect = function (target) {
        if (live(target)) {
          var args = Array.prototype.slice.call(arguments);
          args[0] = masterOf(target.context);
          connect.apply(this, args);
          return target;
        }
        return connect.apply(this, arguments);
      };
      AudioNodeType.prototype.disconnect = function (target) {
        if (live(target)) {
          var master = byContext.get(target.context);
          if (master) {
            var args = Array.prototype.slice.call(arguments);
            args[0] = master;
            return disconnect.apply(this, args);
          }
        }
        return disconnect.apply(this, arguments);
      };
    }
  } catch (e) {}

  try {
    var MediaType = w.HTMLMediaElement;
    var original = MediaType && Object.getOwnPropertyDescriptor(MediaType.prototype, "muted");
    if (original && original.get && original.set) {
      mediaGet = original.get;
      mediaSet = original.set;
      var track = function (element) {
        if (tracked.indexOf(element) < 0 && tracked.length < 400) tracked.push(element);
      };
      Object.defineProperty(MediaType.prototype, "muted", {
        configurable: true,
        enumerable: original.enumerable,
        get: function () {
          return this.__tradfalMuted !== undefined ? this.__tradfalMuted : mediaGet.call(this);
        },
        set: function (value) {
          this.__tradfalMuted = !!value;
          track(this);
          mediaSet.call(this, muted || !!value);
        },
      });
      var play = MediaType.prototype.play;
      MediaType.prototype.play = function () {
        track(this);
        if (this.__tradfalMuted === undefined) this.__tradfalMuted = mediaGet.call(this);
        if (muted) mediaSet.call(this, true);
        return play.apply(this, arguments);
      };
    }
  } catch (e) {}

  function apply() {
    for (var i = 0; i < masters.length; i++) ramp(masters[i]);
    if (!mediaSet) return;
    try {
      var found = document.querySelectorAll("audio,video");
      for (var j = 0; j < found.length; j++) if (tracked.indexOf(found[j]) < 0) tracked.push(found[j]);
      for (var k = 0; k < tracked.length; k++) {
        var element = tracked[k];
        if (element.__tradfalMuted === undefined) element.__tradfalMuted = mediaGet.call(element);
        mediaSet.call(element, muted || element.__tradfalMuted);
      }
    } catch (e) {}
  }

  function announce() {
    try {
      w.parent.postMessage({ tradfal: 1, type: "ready" }, "*");
    } catch (e) {}
  }

  function stayInGame() {
    if (leaving === null) return;
    cancel.call(w, leaving);
    leaving = null;
  }

  try {
    w.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || event.repeat || leaving !== null) return;
      leaving = later.call(w, function () {
        leaving = null;
        try {
          w.parent.postMessage({ tradfal: 1, type: "leave" }, "*");
        } catch (e) {}
      }, ${LEAVE_HOLD_MS});
    }, true);
    w.addEventListener("keyup", function (event) {
      if (event.key === "Escape") stayInGame();
    }, true);
    w.addEventListener("blur", stayInGame, true);
  } catch (e) {}

  w.addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== w.parent || !data || data.tradfal !== 1) return;
    if (data.type === "mute") {
      muted = data.muted === true;
      apply();
    } else if (data.type === "hello") announce();
  });
  announce();
})();`;

const encoder = new TextEncoder();
const BRIDGE_TAG = encoder.encode(`<script data-tradfal-bridge>${BRIDGE_SCRIPT}</script>`);

/** The bytes the page must have read before a charset declaration stops counting (HTML spec), so the bridge goes after it when it sits that early. */
const CHARSET_WINDOW = 1100;
const SCAN_LIMIT = 32 * 1024;

type Decision = { at: number } | "more" | null;

function latin1(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 8192) text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return text;
}

/**
 * Where the bridge goes in the first bytes of an HTML page: after its charset declaration if that comes before the end of the head, else
 * right after `<head>`, `<html>` or the doctype, else at the very start. «more» asks for more bytes; null means «do not inject» (UTF-16
 * pages, or nothing recognisable within the scan limit).
 */
export function findInsertionPoint(bytes: Uint8Array, final: boolean): Decision {
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return null;
  const complete = final || bytes.length >= SCAN_LIMIT;
  if (!complete && bytes.length < CHARSET_WINDOW) return "more";
  const raw = latin1(bytes.subarray(0, SCAN_LIMIT));
  const text = raw.replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => " ".repeat(comment.length));
  if (!complete && text.lastIndexOf("<") > text.lastIndexOf(">")) return "more";
  const headEnd = Math.min(...[text.search(/<\/head/i), text.search(/<body/i), text.length].filter((position) => position >= 0));
  const meta = /<meta\b[^>]*?(?:charset\s*=|http-equiv\s*=\s*["']?content-type)[^>]*>/i.exec(text);
  if (meta && meta.index < headEnd) return { at: meta.index + meta[0].length };
  for (const pattern of [/<head(?:\s[^>]*)?>/i, /<html(?:\s[^>]*)?>/i, /<!doctype[^>]*>/i]) {
    const found = pattern.exec(text);
    if (found) return { at: found.index + found[0].length };
  }
  if (!complete) return "more";
  return { at: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0 };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  return joined;
}

/** Streams an HTML body with the bridge inserted where `findInsertionPoint` says; the rest of the page passes through untouched and unbuffered. */
export function injectBridge(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let buffered: Uint8Array = new Uint8Array(0);
  let scanning = true;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!scanning) {
          const { done, value } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value);
          return;
        }
        for (;;) {
          const { done, value } = await reader.read();
          if (value) buffered = concat(buffered, value);
          const decision = findInsertionPoint(buffered, Boolean(done));
          if (decision === "more" && !done) continue;
          scanning = false;
          if (decision === null || decision === "more") controller.enqueue(buffered);
          else controller.enqueue(concat(concat(buffered.subarray(0, decision.at), BRIDGE_TAG), buffered.subarray(decision.at)));
          buffered = new Uint8Array(0);
          if (done) controller.close();
          return;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
