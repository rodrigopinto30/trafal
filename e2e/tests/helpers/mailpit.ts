import { expect } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:54324";

type MessageSummary = { ID: string; To: { Address: string }[]; Subject: string };

/** Espera el mail que recibió `address` y devuelve su HTML (Mailpit es el buzón de pruebas de Supabase local). */
export async function waitForEmailHtml(address: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
    if (response.ok) {
      const { messages } = (await response.json()) as { messages: MessageSummary[] };
      const first = messages[0];
      if (first) {
        const detail = await fetch(`${MAILPIT}/api/v1/message/${first.ID}`);
        const body = (await detail.json()) as { HTML: string };
        return body.HTML;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No llegó ningún mail a ${address} en ${timeoutMs} ms`);
}

/** Saca el link de confirmación (/auth/confirm?...) del HTML del mail. */
export function confirmationLink(html: string): string {
  const match = /href="([^"]*\/auth\/confirm\?[^"]+)"/.exec(html);
  expect(match, "el mail debería traer un link a /auth/confirm").not.toBeNull();
  return (match?.[1] as string).replaceAll("&amp;", "&");
}
