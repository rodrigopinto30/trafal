// Corre Lighthouse contra la web de producción y resume los resultados (lo llama tools/lighthouse.sh dentro de un contenedor).
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire("/tmp/lighthouse/");
const { chromium } = createRequire("/app/e2e/package.json")("@playwright/test");
const lighthouse = (await import(require.resolve("lighthouse"))).default;
const { launch } = await import(require.resolve("chrome-launcher"));

const pages = process.env.PAGES.split(/\s+/).filter(Boolean);
const runs = Number(process.env.RUNS ?? 3);
const siteHost = process.env.SITE_HOST ?? "localhost";
const base = `http://${siteHost}:${process.env.PORT ?? 3100}`;
const minPerformance = Number(process.env.MIN_PERFORMANCE ?? 85);
const gated = new Set((process.env.GATED ?? "/ /games/orbita").split(/\s+/).filter(Boolean));
const FORM_FACTORS = (process.env.FORM_FACTORS ?? "mobile desktop").split(/\s+/).filter(Boolean);
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const pct = (score) => Math.round((score ?? 0) * 100);

async function measure(url, formFactor, chromePath) {
  const chrome = await launch({ chromePath, chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", `--host-resolver-rules=MAP ${siteHost} 127.0.0.1`] });
  try {
    const flags = { port: chrome.port, output: "json", logLevel: "error", onlyCategories: CATEGORIES };
    const config = formFactor === "desktop" ? { extends: "lighthouse:default", settings: { formFactor: "desktop", screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } } : undefined;
    const result = await lighthouse(url, flags, config);
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

mkdirSync("/app/lighthouse-reports", { recursive: true });
const chromePath = chromium.executablePath();
const rows = [];
for (const formFactor of FORM_FACTORS) {
  for (const path of pages) {
    const reports = [];
    const count = formFactor === "mobile" ? runs : 1;
    for (let attempt = 0; attempt < count; attempt++) reports.push(await measure(`${base}${path}`, formFactor, chromePath));
    const byPerformance = [...reports].sort((a, b) => a.categories.performance.score - b.categories.performance.score);
    const middle = byPerformance[Math.floor(byPerformance.length / 2)];
    writeFileSync(`/app/lighthouse-reports/${formFactor}-${path.replace(/[^a-z0-9]+/gi, "_") || "home"}.json`, JSON.stringify(middle));
    const metric = (id) => median(reports.map((report) => report.audits[id]?.numericValue ?? 0));
    rows.push({
      formFactor,
      path,
      performance: median(reports.map((report) => pct(report.categories.performance.score))),
      accessibility: median(reports.map((report) => pct(report.categories.accessibility.score))),
      bestPractices: median(reports.map((report) => pct(report.categories["best-practices"].score))),
      seo: median(reports.map((report) => pct(report.categories.seo.score))),
      lcp: metric("largest-contentful-paint") / 1000,
      tbt: metric("total-blocking-time"),
      cls: metric("cumulative-layout-shift"),
      fcp: metric("first-contentful-paint") / 1000,
    });
  }
}

const pad = (value, width) => String(value).padEnd(width);
console.log(`\n${pad("", 9)}${pad("página", 20)}${pad("rend.", 7)}${pad("acces.", 8)}${pad("prácticas", 11)}${pad("SEO", 6)}${pad("FCP s", 8)}${pad("LCP s", 8)}${pad("TBT ms", 8)}CLS`);
for (const row of rows) {
  console.log(`${pad(row.formFactor, 9)}${pad(row.path, 20)}${pad(row.performance, 7)}${pad(row.accessibility, 8)}${pad(row.bestPractices, 11)}${pad(row.seo, 6)}${pad(row.fcp.toFixed(1), 8)}${pad(row.lcp.toFixed(1), 8)}${pad(Math.round(row.tbt), 8)}${row.cls.toFixed(3)}`);
}
const mobile = rows.filter((row) => row.formFactor === "mobile");
const failing = mobile.filter((row) => gated.has(row.path) && row.performance < minPerformance);
const below = mobile.filter((row) => !gated.has(row.path) && row.performance < minPerformance);
if (below.length > 0) console.log(`\nⓘ Informativas por debajo de ${minPerformance}: ${below.map((row) => `${row.path} (${row.performance})`).join(", ")}`);
console.log(failing.length === 0 ? `\n✔ Rendimiento en celular ≥ ${minPerformance} en las páginas exigidas (${[...gated].join(", ")}).` : `\n✘ Rendimiento en celular por debajo de ${minPerformance}: ${failing.map((row) => `${row.path} (${row.performance})`).join(", ")}`);
process.exit(failing.length === 0 ? 0 : 1);
