import { ImageResponse } from "next/og";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getMessagesFor } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function ogLocale(value: string): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** The texts of the cards, in the language of the page. */
export function ogTexts(locale: Locale) {
  return createTranslator(getMessagesFor(locale), locale, "og");
}

type Card = {
  kicker?: string;
  title: string;
  subtitle?: string;
  footer: string;
  footerTone?: "play" | "plain";
};

const MAX_TITLE = 84;

function fit(text: string, max: number): string {
  const characters = Array.from(text.replace(/\s+/g, " ").trim());
  return characters.length <= max ? characters.join("") : `${characters.slice(0, max - 1).join("").trimEnd()}…`;
}

/**
 * The picture that shows when a page is shared: Trafal's colors, the name of the page big and who or what it is about, and one
 * line at the bottom. It only has plain text (what a person wrote is never drawn as anything but text), cut to fit.
 */
export function renderCard({ kicker, title, subtitle, footer, footerTone = "plain" }: Card): ImageResponse {
  const long = Array.from(title).length > 40;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0b0818 0%, #1c1040 55%, #0a2c3d 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#2ee6ff" }}>trafal.</div>
          {kicker ? (
            <div style={{ display: "flex", fontSize: 26, color: "#c9c3e6", textTransform: "uppercase", letterSpacing: 2 }}>{fit(kicker, 40)}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: long ? 64 : 82, fontWeight: 700, lineHeight: 1.08 }}>{fit(title, MAX_TITLE)}</div>
          {subtitle ? <div style={{ display: "flex", fontSize: 36, color: "#c9c3e6" }}>{fit(subtitle, 90)}</div> : null}
        </div>
        <div style={{ display: "flex" }}>
          {footerTone === "play" ? (
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#12101f", background: "#c6ff3d", borderRadius: 999, padding: "14px 34px" }}>{`▶ ${footer}`}</div>
          ) : (
            <div style={{ display: "flex", fontSize: 32, color: "#c9c3e6" }}>{footer}</div>
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
