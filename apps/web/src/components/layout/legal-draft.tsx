import { Badge } from "@/components/ui/badge";
import { getTranslations } from "@/i18n/server";

type Document = "terms" | "privacy" | "guidelines" | "copyright";

/** Documento legal todavía en redacción (se completan en la Fase 5, con revisión legal antes del lanzamiento). */
export async function LegalDraft({ document }: { document: Document }) {
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto max-w-[760px] px-5 pt-16">
      <Badge variant="coral">{t("draftTitle")}</Badge>
      <h1 className="mt-5 font-display text-[clamp(30px,5vw,42px)] leading-[1.1] font-bold">{t(document)}</h1>
      <p className="mt-4 text-lg text-text-2">{t("draftText")}</p>
    </article>
  );
}
