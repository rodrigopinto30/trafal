import { getLocale, getTranslations } from "@/i18n/server";
import { getLegalDocument } from "@/lib/legal/documents";
import { LEGAL_UPDATED } from "@/lib/legal/status";
import type { LegalDocumentId } from "@/lib/legal/types";

/** A legal document: title, date, a table of contents and its sections. */
export async function LegalDocument({ id }: { id: LegalDocumentId }) {
  const [t, locale] = await Promise.all([getTranslations("legal"), getLocale()]);
  const document = getLegalDocument(id, locale);
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(LEGAL_UPDATED));

  return (
    <article className="mx-auto max-w-[760px] px-5 pt-[clamp(32px,5vw,64px)] pb-8">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,42px)] leading-[1.1] font-bold text-glow-violet">{document.title}</h1>
        <p className="mt-3 text-lg text-text-2">{document.summary}</p>
        <p className="mt-2 text-sm text-text-3">{t("updated", { date: updated })}</p>
      </header>

      <nav aria-label={t("contents")} className="mt-8 rounded-[24px] border border-white/8 bg-card p-5">
        <h2 className="font-display text-lg font-bold">{t("contents")}</h2>
        <ol className="mt-3 grid list-decimal gap-1 pl-5 text-text-2">
          {document.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="inline-flex min-h-11 items-center text-cyan underline-offset-2 hover:underline focus-visible:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 grid gap-10">
        {document.sections.map((section, index) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
            <h2 id={`${section.id}-title`} className="font-display text-2xl leading-tight font-bold">
              {index + 1}. {section.title}
            </h2>
            <div className="mt-3 grid gap-3 leading-relaxed text-text-2 [overflow-wrap:anywhere]">
              {section.blocks.map((block, position) =>
                typeof block === "string" ? (
                  <p key={position}>{block}</p>
                ) : (
                  <ul key={position} className="grid list-disc gap-2 pl-5">
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
