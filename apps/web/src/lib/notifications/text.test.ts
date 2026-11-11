import { describe, expect, it } from "vitest";
import { getMessagesFor } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";
import { notificationDetail, notificationSentence } from "./text";
import type { NotificationItem } from "./queries";

const t = createTranslator(getMessagesFor("es"), "es", "notifications");
const base: NotificationItem = { id: "1", type: "like", read_at: null, created_at: "2026-11-11T10:00:00Z", data: {}, actor: null, game: null, post: null, comment: null, version: null };
const date = (value: Date) => value.toISOString().slice(0, 10);

describe("notificationSentence", () => {
  it("says who did what and where", () => {
    const item = { ...base, type: "comment", actor: { username: "ana", display_name: "Ana" }, game: { public_id: "orbita", title: "Órbita" } } as const;
    expect(notificationSentence(item, t)).toBe("Ana comentó en Órbita");
  });

  it("does not need an author or a game", () => {
    expect(notificationSentence({ ...base, type: "follow" }, t)).toBe("Alguien empezó a seguirte");
  });

  it("tells moderation notices, and the answers to appeals and counter-notices", () => {
    expect(notificationSentence({ ...base, type: "moderation", data: { action: "suspend" } }, t)).toBe("Suspendimos tu cuenta");
    expect(notificationSentence({ ...base, type: "moderation", data: { action: "appeal_upheld" } }, t)).toBe("Revisamos tu apelación: se mantuvo la decisión");
    expect(notificationSentence({ ...base, type: "moderation", data: { action: "appeal_overturned", kind: "counter_notice" } }, t)).toBe("Revisamos tu contranotificación: volvimos a publicar el contenido");
  });
});

describe("notificationDetail", () => {
  it("shows the reason and the answer of a moderation notice", () => {
    const item = { ...base, type: "moderation", data: { action: "hide", target_type: "game", reason: "Spam", note: "Revisado" } } as const;
    expect(notificationDetail(item, t, date)).toBe("Motivo: Spam · Respuesta: Revisado");
  });

  it("shows the start of a comment, shortened", () => {
    const long = "x".repeat(200);
    const item = { ...base, type: "comment", comment: { id: "c", body: long, post_id: null, game: null } } as const;
    const detail = notificationDetail(item, t, date) ?? "";
    expect(detail.startsWith("“")).toBe(true);
    expect(detail.endsWith("…”")).toBe(true);
    expect(Array.from(detail).length).toBeLessThan(150);
  });

  it("is null when there is nothing more to say", () => {
    expect(notificationDetail({ ...base, type: "follow" }, t, date)).toBeNull();
  });
});
