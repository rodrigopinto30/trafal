import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { uploadGameZip, unpublishGame } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { maliciousGameZip } from "./helpers/zip";

/**
 * A hostile game, published like any other, runs a battery of attacks while a signed-in person plays it: reading the site's
 * cookies and storage, reaching the page around it, navigating or popping out of the frame, submitting forms, downloading,
 * calling other origins, registering a service worker, using the camera, location or clipboard. The sandbox, the content
 * security policy and the gateway have to stop every one of them. Needs the gateway running (./start.sh).
 */
test.describe.configure({ mode: "serial" });

const TRAP = "stolen=1";
const TITLE = "Totally Fine Game";

let context: BrowserContext;
let player: Page;
let publicId = "";
let report: Record<string, string> = {};
const answeredTrapRequests: string[] = [];
const cookieHeadersToGames: string[] = [];
const failureOfTrapRequest = new Map<string, string>();
const popups: string[] = [];
const downloads: string[] = [];
let framedUrlsAfterRun: string[] = [];

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  context = await browser.newContext({ ...testInfo.project.use });
  player = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(player, { email: `e2e_malicious_${suffix}@trafal.test`, username: `malicious_${lettersOnly(suffix)}`, displayName: "Persona Hostil" });
  await uploadGameZip(player, TITLE, maliciousGameZip());
  await expect(player.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await player.getByRole("button", { name: "Publicar juego" }).click();
  await expect(player.getByText("Tu juego está publicado")).toBeVisible();
  publicId = /\/games\/([a-z0-9]+)\/manage$/.exec(player.url())?.[1] ?? "";
  expect(publicId).not.toBe("");
});

test.afterAll(async () => {
  try {
    if (publicId) await unpublishGame(player, publicId);
  } finally {
    await context?.close();
  }
});

test("the game runs its whole attack battery and the person keeps playing on Trafal", async () => {
  test.setTimeout(120_000);
  await player.goto(`/games/${publicId}`);
  await player.evaluate(() => {
    document.cookie = "trafal_canary=secret; path=/";
    localStorage.setItem("trafal_canary", "secret");
    sessionStorage.setItem("trafal_canary", "secret");
  });
  const cookiesOnTrafal = await context.cookies("http://localhost:3000");
  expect(cookiesOnTrafal.some((cookie) => cookie.name.startsWith("sb-"))).toBe(true);

  context.on("page", (popup) => popups.push(popup.url()));
  player.on("response", (response) => {
    if (response.url().includes(TRAP)) answeredTrapRequests.push(`${response.status()} ${response.url()}`);
  });
  player.on("requestfinished", async (request) => {
    if (request.url().includes(".games.localhost:4000")) cookieHeadersToGames.push((await request.allHeaders()).cookie ?? "");
  });
  player.on("requestfailed", (request) => {
    if (request.url().includes(TRAP)) failureOfTrapRequest.set(request.url(), request.failure()?.errorText ?? "");
  });
  player.on("download", (download) => downloads.push(download.suggestedFilename()));

  await player.getByRole("button", { name: "Jugar gratis" }).click();
  const frame = player.locator(`iframe[title="Juego: ${TITLE}"]`);
  await expect(frame).toHaveAttribute("src", `http://${publicId}.games.localhost:4000/`);
  await expect(player.frameLocator(`iframe[title="Juego: ${TITLE}"]`).locator("#status")).toHaveText("done", { timeout: 60_000 });
  report = JSON.parse((await player.frameLocator(`iframe[title="Juego: ${TITLE}"]`).locator("#report").textContent()) ?? "{}") as Record<string, string>;
  await player.waitForTimeout(1_500);
  framedUrlsAfterRun = player.frames().filter((candidate) => candidate !== player.mainFrame()).map((candidate) => candidate.url());

  expect(Object.keys(report).length).toBeGreaterThan(25);
  await expect(player).toHaveURL(`/games/${publicId}`);
  await expect(player.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
});

test("every attack that can be observed from inside the game was blocked", () => {
  const leaked = Object.entries(report).filter(([, outcome]) => outcome !== "blocked");
  expect(leaked).toEqual([]);
});

test("nothing escaped the frame: no request to another origin, popup, navigation, form, download or nested page", async () => {
  expect(answeredTrapRequests).toEqual([]);
  const notBlockedByPolicy = [...failureOfTrapRequest].filter(([, error]) => !/csp/i.test(error));
  expect(notBlockedByPolicy).toEqual([]);
  expect(popups).toEqual([]);
  expect(downloads).toEqual([]);
  expect(player.url()).toBe(`http://localhost:3000/games/${publicId}`);
  const gameUrl = `http://${publicId}.games.localhost:4000/`;
  expect(framedUrlsAfterRun.filter((url) => url !== gameUrl && !url.startsWith("chrome-error://"))).toEqual([]);
  expect(framedUrlsAfterRun).toContain(gameUrl);
});

test("the game left no service worker behind", () => {
  expect(context.serviceWorkers()).toEqual([]);
});

test("a cookie the game tried to set for the whole games domain does not reach another game", async () => {
  const sibling = await context.newPage();
  await sibling.goto("http://othergame.games.localhost:4000/");
  expect(await sibling.evaluate(() => document.cookie)).not.toContain("tossed");
  await sibling.close();
});

test("the browser sent no cookie at all to the games domain", () => {
  expect(cookieHeadersToGames.length).toBeGreaterThan(0);
  expect(cookieHeadersToGames.filter((cookie) => cookie !== "")).toEqual([]);
});
