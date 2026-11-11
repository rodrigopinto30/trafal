import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc, latestPostIdOf } from "./helpers/supabase";

/**
 * Counter-notices. An update is hidden because of a copyright claim; its author cannot send a plain appeal, answers with a counter-notice
 * (name, email and the two statements), an admin sees it next to the claim and reverses the decision, and the update is published again.
 * The claim is sent as any visitor could and handled through the database functions, as the admin panel does.
 */
test.describe.configure({ mode: "serial" });

const ADMIN = { email: "admin@trafal.test", password: "trafal123" };
const PASSWORD = "Trafal12345";

let person: Page;
let admin: Page;
let email = "";
let username = "";
let postId = "";
let suffix = "";
const bodyText = () => `Un avance con mi arte original ${suffix}`;
const card = (page: Page) => page.getByRole("article", { name: `Apelación de @${username}` });

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  suffix = uniqueSuffix(testInfo.project.name);
  email = `e2e_counter_${suffix}@trafal.test`;
  username = `counter_${lettersOnly(suffix)}`;
  person = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(person, { email, username, displayName: "Persona Contranotificación", password: PASSWORD });

  await gotoReady(person, "/posts/new");
  await person.getByLabel("Qué querés contar").fill(bodyText());
  await person.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(person).not.toHaveURL(/\/posts\/new/);
  postId = await latestPostIdOf(username);

  admin = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(admin, ADMIN.email, ADMIN.password);
  const adminToken = await accessTokenOf(ADMIN.email, ADMIN.password);

  const claim = await callRpc("submit_copyright_claim", {
    p_claimant_name: "Carla Titular",
    p_claimant_email: `e2e_claim_${suffix}@trafal.test`,
    p_claimant_org: null,
    p_work_description: "Una ilustración que publiqué en mi sitio en 2024",
    p_original_url: null,
    p_infringing_urls: [`http://localhost:3000/posts/${postId}`],
    p_statement_good_faith: true,
    p_statement_accuracy: true,
    p_signature: "Carla Titular",
    p_game_id: null,
    p_post_id: postId,
  });
  expect(claim.status).toBeLessThan(300);
  const resolved = await callRpc("resolve_claim", { p_claim_id: claim.body, p_outcome: "hide_content", p_note: "La ilustración es de otra persona" }, adminToken);
  expect(resolved.status).toBeLessThan(300);
});

test.afterAll(async () => {
  await person?.context().close();
  await admin?.context().close();
});

test("lo oculto por un reclamo se responde con una contranotificación, no con una apelación común", async () => {
  await gotoReady(person, "/settings/moderation");
  const main = person.getByRole("main");
  await expect(main.getByText(/Ocultamos tu avance/)).toBeVisible();
  await expect(main.getByText("Esto se ocultó por un reclamo de derechos de autor: se responde con una contranotificación.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Apelar", exact: true })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Enviar contranotificación" })).toBeVisible();

  const plain = await callRpc("submit_appeal", { p_target_type: "post", p_target_id: postId, p_message: "Apelo" }, await accessTokenOf(email, PASSWORD));
  expect(plain.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(plain.body)).toContain("counter_notice_required");
});

test("la contranotificación pide el mensaje, el nombre, un email y las dos declaraciones", async () => {
  await gotoReady(person, "/settings/moderation");
  await person.getByRole("main").getByRole("button", { name: "Enviar contranotificación" }).click();
  const dialog = person.getByRole("dialog", { name: "Contranotificación" });
  const send = dialog.getByRole("button", { name: "Enviar contranotificación" });
  await expect(dialog.getByText(/le pasamos tu nombre y este email a quien hizo el reclamo/)).toBeVisible();
  await expect(send).toBeDisabled();

  await dialog.getByLabel("Por qué creés que fue un error").fill("Es mi propia ilustración, hay un borrador firmado.");
  await dialog.getByLabel("Tu nombre completo").fill("Persona Contranotificación");
  await dialog.getByLabel("Tu email de contacto").fill(email);
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /de buena fe que esto se ocultó/ }).check();
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Lo que escribí es exacto/ }).check();
  await expect(send).toBeEnabled();

  await dialog.getByLabel("Tu email de contacto").fill("esto no es un email");
  await send.click();
  await expect(dialog.getByText("Escribí un email válido.")).toBeVisible();

  await dialog.getByLabel("Tu email de contacto").fill(email);
  await send.click();
  await expect(person.getByRole("dialog")).toHaveCount(0);
  const main = person.getByRole("main");
  await expect(main.getByText("Apelación en revisión")).toBeVisible();
  await expect(main.getByText("Contranotificación", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Enviar contranotificación" })).toHaveCount(0);
});

test("el admin ve la contranotificación junto al reclamo, con los datos de contacto, y pasa la auditoría de accesibilidad", async () => {
  await gotoReady(admin, "/admin/appeals");
  const item = card(admin);
  await expect(item).toBeVisible();
  await expect(item.getByText("Contranotificación", { exact: true })).toBeVisible();
  await expect(item.getByText("Es mi propia ilustración, hay un borrador firmado.")).toBeVisible();
  await expect(item.getByRole("link", { name: email })).toBeVisible();
  await expect(item.getByText(/Carla Titular/)).toBeVisible();
  await expect(item.getByText(/Una ilustración que publiqué en mi sitio en 2024/)).toBeVisible();

  const results = await new AxeBuilder({ page: admin }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }))).toEqual([]);
});

test("el admin revierte la decisión: el avance se publica otra vez y la persona lee la respuesta", async ({ browser }, testInfo) => {
  await gotoReady(admin, "/admin/appeals");
  await card(admin).getByRole("button", { name: "Revertir la decisión" }).click();
  const dialog = admin.getByRole("dialog", { name: "Revertir la decisión" });
  await dialog.getByLabel(/Respuesta/).fill("El borrador firmado alcanza: restauramos el avance.");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByRole("dialog")).toHaveCount(0);

  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await gotoReady(visitor, `/posts/${postId}`);
  await expect(visitor.getByText(bodyText())).toBeVisible();
  await visitor.context().close();

  await gotoReady(person, "/notifications");
  await expect(person.getByText("Revisamos tu contranotificación: volvimos a publicar el contenido")).toBeVisible();
  await expect(person.getByText("Respuesta: El borrador firmado alcanza: restauramos el avance.")).toBeVisible();
});
