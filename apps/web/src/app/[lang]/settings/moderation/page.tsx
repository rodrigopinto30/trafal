import { Suspense } from "react";
import { AppealButton } from "@/components/appeals/appeal-button";
import { ExtraMessages } from "@/components/i18n/extra-messages";
import { SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocale, getTranslations } from "@/i18n/server";
import { listMyAppeals, listMyDecisions } from "@/lib/appeals/queries";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("appeals");
  return { title: t("title"), robots: { index: false } };
}

export default async function SettingsModerationPage() {
  const t = await getTranslations("appeals");
  return (
    <div className="grid gap-6">
      <header>
        <h2 className="font-display text-2xl leading-tight font-bold">{t("title")}</h2>
        <p className="mt-1 text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[320px] rounded-[28px]" />}>
        <ModerationContent />
      </Suspense>
    </div>
  );
}

/** Asks for the session and the profile: inside <Suspense>. A suspended person gets here too, since appealing is what they can still do. */
async function ModerationContent() {
  await requireProfile("/settings/moderation", { allowOutdatedTerms: true });
  const [t, locale, decisions, appeals] = await Promise.all([getTranslations("appeals"), getLocale(), listMyDecisions(), listMyAppeals()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });

  return (
    <ExtraMessages namespaces={["appeals"]}>
      <p className="max-w-[720px] text-sm text-text-2">{t("how")}</p>

      <SettingsSection title={t("decisionsTitle")}>
        {decisions.length === 0 ? (
          <p className="text-text-2">{t("decisionsEmpty")}</p>
        ) : (
          <ul className="grid gap-4">
            {decisions.map((decision) => (
              <li key={`${decision.target_type}-${decision.target_id}`}>
                <article className="grid gap-2 rounded-2xl border border-white/8 p-4">
                  <p className="font-semibold break-words text-foreground">{t(`decision.${decision.target_type}`, { label: decision.label })}</p>
                  {decision.decided_at ? <p className="text-xs text-text-3">{t("decidedOn", { date: date.format(new Date(decision.decided_at)) })}</p> : null}
                  {decision.reason ? <p className="text-sm break-words whitespace-pre-line text-text-2">{t("reason", { reason: decision.reason })}</p> : null}
                  <div className="flex flex-wrap items-center gap-3">
                    {decision.appeal_status ? (
                      <Badge variant={decision.appeal_status === "open" ? "cyan" : "violet"}>{t(`appealStatus.${decision.appeal_status}`)}</Badge>
                    ) : (
                      <AppealButton targetType={decision.target_type} targetId={decision.target_id} />
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title={t("appealsTitle")}>
        {appeals.length === 0 ? (
          <p className="text-text-2">{t("appealsEmpty")}</p>
        ) : (
          <ul className="grid gap-4">
            {appeals.map((appeal) => (
              <li key={appeal.id}>
                <article className="grid gap-2 rounded-2xl border border-white/8 p-4">
                  <header className="flex flex-wrap items-center gap-2">
                    <Badge variant={appeal.status === "open" ? "cyan" : "violet"}>{t(`status.${appeal.status}`)}</Badge>
                    <span className="text-xs text-text-3">{t("sentOn", { date: date.format(new Date(appeal.created_at)) })}</span>
                  </header>
                  <p className="font-semibold break-words text-foreground">{t(`target.${appeal.target_type}`, { label: appeal.target_label })}</p>
                  {appeal.decision_reason ? <p className="text-sm break-words whitespace-pre-line text-text-2">{t("reason", { reason: appeal.decision_reason })}</p> : null}
                  <div className="grid gap-1 text-sm">
                    <p className="text-xs font-semibold text-text-3 uppercase">{t("yourMessage")}</p>
                    <p className="break-words whitespace-pre-line text-text-2">{appeal.message}</p>
                  </div>
                  {appeal.resolution_note ? (
                    <div className="grid gap-1 text-sm">
                      <p className="text-xs font-semibold text-text-3 uppercase">{t("answer")}</p>
                      <p className="break-words whitespace-pre-line text-foreground">{appeal.resolution_note}</p>
                    </div>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </ExtraMessages>
  );
}
