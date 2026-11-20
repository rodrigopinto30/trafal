import {
  CheckIcon,
  ChevronDownIcon,
  FileArchiveIcon,
  FileIcon,
  FolderIcon,
  ImageIcon,
  RocketIcon,
  ShieldCheckIcon,
  UploadIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getLocale, getTranslations } from "@/i18n/server";
import { Link } from "@/i18n/link";
import { formatBytes } from "@/lib/format";
import { ALLOWED_FILE_GROUPS, COMPRESSED_SUFFIXES, type AllowedFileGroup } from "@/lib/games/upload-file-types";
import {
  CONTROLS_MAX,
  DAILY_UPLOAD_LIMIT,
  DESCRIPTION_MAX,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_PATH_LENGTH,
  MAX_QUESTIONS,
  MAX_TAGS,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_BYTES,
  TITLE_MAX,
} from "@/lib/games/upload-rules";
import {
  GAME_GIF_MAX_BYTES,
  GAME_GIF_MAX_FRAMES,
  GAME_GIF_MAX_SIDE,
  GAME_IMAGE_MAX_BYTES,
  GAME_IMAGE_MAX_SIDE,
  GAME_IMAGE_MIN_HEIGHT,
  GAME_IMAGE_MIN_WIDTH,
} from "@/lib/media/game-image";
import { pageMetadata } from "@/lib/seo/metadata";

const PATH = "/help/upload";
const SECTIONS = ["glance", "steps", "limits", "types", "sandbox", "fixes", "faq"] as const;
const FILE_GROUPS = Object.keys(ALLOWED_FILE_GROUPS) as AllowedFileGroup[];
const CODE = { code: (chunks: ReactNode) => <code className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">{chunks}</code> };

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("uploadGuide"), getLocale()]);
  return pageMetadata({ title: t("metaTitle"), description: t("metaDescription"), path: PATH, locale });
}

type TreeNode = { name: string; children?: TreeNode[] };

/** A folder tree drawn as nested lists, so a screen reader reads it as what it is. */
function FileTree({ nodes, label, folderLabel }: { nodes: TreeNode[]; label?: string; folderLabel: string }) {
  return (
    <ul aria-label={label} className={label ? "grid gap-1 font-mono text-sm" : "mt-1 grid gap-1 border-l border-white/15 pl-4"}>
      {nodes.map((node) => (
        <li key={node.name}>
          <span className="inline-flex items-center gap-2">
            {node.children ? <FolderIcon aria-hidden="true" className="size-4 text-cyan" /> : <FileIcon aria-hidden="true" className="size-4 text-text-3" />}
            {node.name}
            {node.children ? <span className="sr-only">({folderLabel})</span> : null}
          </span>
          {node.children ? <FileTree nodes={node.children} folderLabel={folderLabel} /> : null}
        </li>
      ))}
    </ul>
  );
}

function TreeExample({ tone, title, zipName, nodes, why, folderLabel, treeLabel }: { tone: "good" | "bad"; title: string; zipName: string; nodes: TreeNode[]; why?: ReactNode; folderLabel: string; treeLabel: string }) {
  const Icon = tone === "good" ? CheckIcon : XIcon;
  return (
    <figure className={`grid content-start gap-3 rounded-2xl border p-4 ${tone === "good" ? "border-cyan/40" : "border-coral/50"}`}>
      <figcaption className={`inline-flex items-center gap-2 font-semibold ${tone === "good" ? "text-cyan" : "text-coral"}`}>
        <Icon aria-hidden="true" className="size-4" />
        {title}
      </figcaption>
      <p className="inline-flex items-center gap-2 font-mono text-sm">
        <FileArchiveIcon aria-hidden="true" className="size-4 text-text-3" />
        {zipName}
      </p>
      <FileTree nodes={nodes} label={treeLabel} folderLabel={folderLabel} />
      {why ? <p className="text-sm text-text-2">{why}</p> : null}
    </figure>
  );
}

function Step({ number, label, title, children }: { number: number; label: string; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-action font-display text-lg font-bold text-white">
        {number}
      </span>
      <div className="grid min-w-0 gap-3">
        <h3 className="pt-1.5 font-display text-xl leading-tight font-bold">
          <span className="sr-only">{label}: </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 gap-5">
      <h2 id={`${id}-title`} className="font-display text-2xl leading-tight font-bold sm:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Glance({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note: ReactNode }) {
  return (
    <li className="grid content-start gap-2 rounded-2xl border border-white/8 bg-card p-5">
      <Icon aria-hidden="true" className="size-6 text-cyan" />
      <p className="font-display text-lg leading-snug font-bold">{title}</p>
      <p className="text-sm text-text-2">{note}</p>
    </li>
  );
}

/** The upload guide: what a game needs, the limits that apply today (read from the same rules the site enforces) and how to fix a rejection. */
export default async function UploadGuidePage() {
  const [t, locale] = await Promise.all([getTranslations("uploadGuide"), getLocale()]);
  const bytes = (value: number) => formatBytes(locale, value);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const minSide = `${GAME_IMAGE_MIN_WIDTH}×${GAME_IMAGE_MIN_HEIGHT}`;
  const folder = t("steps.zip.folder");
  const zipName = `${t("steps.zip.example")}.zip`;
  const treeLabel = t("steps.zip.treeLabel", { name: zipName });

  const sectionTitle: Record<(typeof SECTIONS)[number], string> = {
    glance: t("glance.title"),
    steps: t("steps.title"),
    limits: t("limits.title"),
    types: t("types.title"),
    sandbox: t("sandbox.title"),
    fixes: t("fixes.title"),
    faq: t("faq.title"),
  };

  const limits: [string, string][] = [
    [t("limits.zip"), bytes(MAX_ZIP_BYTES)],
    [t("limits.uncompressed"), bytes(MAX_UNCOMPRESSED_BYTES)],
    [t("limits.files"), count(MAX_FILES)],
    [t("limits.file"), bytes(MAX_FILE_BYTES)],
    [t("limits.path"), t("limits.pathValue", { count: count(MAX_PATH_LENGTH) })],
    [t("limits.daily"), count(DAILY_UPLOAD_LIMIT)],
    [t("limits.cover"), bytes(GAME_IMAGE_MAX_BYTES)],
    [t("limits.gif"), bytes(GAME_GIF_MAX_BYTES)],
  ];

  const fixes = (["noIndex", "tooLarge", "type", "nested", "path", "duplicate"] as const).map((key) => [t(`fixes.${key}`), t(`fixes.${key}Fix`)] as const);
  const faq = (["reviewTime", "draft", "mobile", "rename"] as const).map((key) => [t(`faq.${key}Q`), t(`faq.${key}A`)] as const);

  return (
    <article className="mx-auto grid max-w-[880px] grid-cols-[minmax(0,1fr)] gap-14 px-5 pt-[clamp(32px,5vw,64px)] pb-8">
      <header className="grid justify-items-start gap-4">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <p className="text-lg text-text-2">{t("intro")}</p>
        <Button asChild size="lg">
          <Link href="/games/new">
            <UploadIcon aria-hidden="true" />
            {t("cta")}
          </Link>
        </Button>
        <nav aria-label={t("contents")} className="mt-4 w-full rounded-[24px] border border-white/8 bg-card p-5">
          <h2 className="font-display text-lg font-bold">{t("contents")}</h2>
          <ol className="mt-3 grid list-decimal gap-1 pl-5 text-text-2 sm:grid-cols-2">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex min-h-11 items-center text-cyan underline-offset-2 hover:underline focus-visible:underline">
                  {sectionTitle[id]}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <Section id="glance" title={sectionTitle.glance}>
        <ul className="grid gap-4 sm:grid-cols-2">
          <Glance icon={FileArchiveIcon} title={t("glance.zip", { size: bytes(MAX_ZIP_BYTES) })} note={t.rich("glance.zipNote", {}, CODE)} />
          <Glance icon={ImageIcon} title={t("glance.pictures")} note={t("glance.picturesNote")} />
          <Glance icon={UploadIcon} title={t("glance.daily", { count: count(DAILY_UPLOAD_LIMIT) })} note={t("glance.dailyNote")} />
          <Glance icon={ShieldCheckIcon} title={t("glance.review")} note={t("glance.reviewNote")} />
        </ul>
      </Section>

      <Section id="steps" title={sectionTitle.steps}>
        <ol className="grid gap-10">
          <Step number={1} label={t("steps.step", { number: 1 })} title={t("steps.export.title")}>
            <p className="text-text-2">{t.rich("steps.export.text", {}, CODE)}</p>
            <ul className="grid list-disc gap-1.5 pl-5 text-text-2">
              <li>{t("steps.export.godot")}</li>
              <li>{t("steps.export.unity")}</li>
              <li>{t("steps.export.others")}</li>
              <li>{t("steps.export.javascript")}</li>
            </ul>
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-text-2">{t.rich("steps.export.tip", {}, CODE)}</p>
          </Step>

          <Step number={2} label={t("steps.step", { number: 2 })} title={t("steps.zip.title")}>
            <p className="text-text-2">{t.rich("steps.zip.text", {}, CODE)}</p>
            <div className="grid gap-4 md:grid-cols-3">
              <TreeExample
                tone="good"
                title={t("steps.zip.good")}
                zipName={zipName}
                treeLabel={treeLabel}
                folderLabel={folder}
                nodes={[{ name: "index.html" }, { name: "game.js" }, { name: "assets", children: [{ name: "sprites.png" }, { name: "music.ogg" }] }]}
              />
              <TreeExample
                tone="good"
                title={t("steps.zip.goodAlso")}
                zipName={zipName}
                treeLabel={treeLabel}
                folderLabel={folder}
                nodes={[{ name: t("steps.zip.example"), children: [{ name: "index.html" }, { name: "game.js" }, { name: "assets", children: [{ name: "…" }] }] }]}
              />
              <TreeExample
                tone="bad"
                title={t("steps.zip.bad")}
                zipName={zipName}
                treeLabel={treeLabel}
                folderLabel={folder}
                nodes={[{ name: "proyecto", children: [{ name: "build", children: [{ name: "index.html" }, { name: "game.js" }] }] }]}
                why={t.rich("steps.zip.badWhy", {}, CODE)}
              />
            </div>
            <ul className="grid list-disc gap-1.5 pl-5 text-text-2">
              <li>{t("steps.zip.windows")}</li>
              <li>{t("steps.zip.mac")}</li>
              <li>{t.rich("steps.zip.linux", {}, CODE)}</li>
            </ul>
          </Step>

          <Step number={3} label={t("steps.step", { number: 3 })} title={t("steps.details.title")}>
            <p className="text-text-2">
              {t("steps.details.text", { title: TITLE_MAX, description: DESCRIPTION_MAX, tags: MAX_TAGS, questions: MAX_QUESTIONS, controls: CONTROLS_MAX })}
            </p>
          </Step>

          <Step number={4} label={t("steps.step", { number: 4 })} title={t("steps.pictures.title")}>
            <p className="text-text-2">{t("steps.pictures.text")}</p>
            <ul className="grid list-disc gap-1.5 pl-5 text-text-2">
              <li>{t("steps.pictures.cover", { min: minSide, max: `${GAME_IMAGE_MAX_SIDE}×${GAME_IMAGE_MAX_SIDE}`, size: bytes(GAME_IMAGE_MAX_BYTES) })}</li>
              <li>
                {t("steps.pictures.gif", { min: minSide, max: `${GAME_GIF_MAX_SIDE}×${GAME_GIF_MAX_SIDE}`, frames: count(GAME_GIF_MAX_FRAMES), size: bytes(GAME_GIF_MAX_BYTES) })}
              </li>
            </ul>
          </Step>

          <Step number={5} label={t("steps.step", { number: 5 })} title={t("steps.upload.title")}>
            <p className="text-text-2">{t("steps.upload.text")}</p>
            <p className="text-text-2">{t("steps.upload.rejected")}</p>
          </Step>

          <Step number={6} label={t("steps.step", { number: 6 })} title={t("steps.publish.title")}>
            <p className="text-text-2">{t("steps.publish.text")}</p>
          </Step>

          <Step number={7} label={t("steps.step", { number: 7 })} title={t("steps.update.title")}>
            <p className="text-text-2">{t("steps.update.text")}</p>
          </Step>
        </ol>
      </Section>

      <Section id="limits" title={sectionTitle.limits}>
        <div className="overflow-hidden rounded-2xl border border-white/8">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-sm text-text-3">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t("limits.what")}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  {t("limits.max")}
                </th>
              </tr>
            </thead>
            <tbody>
              {limits.map(([what, max]) => (
                <tr key={what} className="border-t border-white/8">
                  <th scope="row" className="px-4 py-3 font-normal text-text-2">
                    {what}
                  </th>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-text-3">{t("limits.note")}</p>
      </Section>

      <Section id="types" title={sectionTitle.types}>
        <dl className="grid gap-4 sm:grid-cols-2">
          {FILE_GROUPS.map((group) => (
            <div key={group} className="grid content-start gap-2 rounded-2xl border border-white/8 bg-card p-4">
              <dt className="font-semibold">{t(`types.${group}`)}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {ALLOWED_FILE_GROUPS[group].map((extension) => (
                  <code key={extension} className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-sm">
                    .{extension}
                  </code>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-text-2">{t.rich("types.compressed", { suffixes: COMPRESSED_SUFFIXES.map((suffix) => `.${suffix}`).join(", ") }, CODE)}</p>
        <p className="rounded-2xl border border-coral/40 p-4 text-text-2">{t("types.forbidden")}</p>
      </Section>

      <Section id="sandbox" title={sectionTitle.sandbox}>
        <p className="text-text-2">{t("sandbox.text")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-3 rounded-2xl border border-cyan/30 p-5">
            <h3 className="font-display text-lg font-bold">{t("sandbox.canTitle")}</h3>
            <ul className="grid gap-2 text-text-2">
              {(["canSave", "canInput", "canPlatform"] as const).map((key) => (
                <li key={key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                  <CheckIcon aria-hidden="true" className="mt-1 size-4 text-cyan" />
                  {t(`sandbox.${key}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-3 rounded-2xl border border-coral/40 p-5">
            <h3 className="font-display text-lg font-bold">{t("sandbox.cannotTitle")}</h3>
            <ul className="grid gap-2 text-text-2">
              {(["cannotWindows", "cannotForms", "cannotData"] as const).map((key) => (
                <li key={key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                  <XIcon aria-hidden="true" className="mt-1 size-4 text-coral" />
                  {t(`sandbox.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-text-2">{t("sandbox.keyboard")}</p>
        <p className="text-sm text-text-3">{t("sandbox.flags")}</p>
      </Section>

      <Section id="fixes" title={sectionTitle.fixes}>
        <div className="overflow-hidden rounded-2xl border border-white/8">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-sm text-text-3">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t("fixes.problem")}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t("fixes.fix")}
                </th>
              </tr>
            </thead>
            <tbody>
              {fixes.map(([problem, fix]) => (
                <tr key={problem} className="border-t border-white/8 align-top">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {problem}
                  </th>
                  <td className="px-4 py-3 text-text-2">{fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="faq" title={sectionTitle.faq}>
        <div className="grid gap-3">
          {faq.map(([question, answer]) => (
            <details key={question} className="group rounded-2xl border border-white/8 bg-card px-5">
              <summary className="flex min-h-14 list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDownIcon aria-hidden="true" className="size-5 shrink-0 text-text-3 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="pb-5 text-text-2">{answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <aside aria-labelledby="ready-title" className="grid justify-items-start gap-3 rounded-[28px] border border-violet/30 bg-card p-6 sm:p-8">
        <h2 id="ready-title" className="font-display text-2xl font-bold">
          {t("readyTitle")}
        </h2>
        <p className="text-text-2">{t("readyText")}</p>
        <Button asChild size="lg">
          <Link href="/games/new">
            <RocketIcon aria-hidden="true" />
            {t("cta")}
          </Link>
        </Button>
      </aside>
    </article>
  );
}
