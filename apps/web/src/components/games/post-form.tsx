"use client";

import { ArrowDownIcon, ArrowUpIcon, FilmIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { UploadProgress } from "@/components/games/upload-progress";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { formatBytes } from "@/lib/format";
import { submitPost } from "@/lib/games/post-upload";
import { POST_MEDIA_KINDS, POST_MEDIA_MAX_ALT, POST_MEDIA_MAX_FILES, POST_MEDIA_MIMES } from "@/lib/media/post-media";
import { POST_BODY_MAX, POST_ERROR_KEYS, POST_HIGHLIGHT_MAX, POST_KINDS, type PostErrorKey, type PostKindValue } from "@/lib/validation/post";

type GameOption = { id: string; title: string };

/** An update being edited, as the form needs it: its fields and its current files with the address to show them from. */
export type EditingPost = {
  id: string;
  kind: PostKindValue;
  body: string;
  highlight: string;
  gameId: string;
  media: { id: string; kind: "image" | "gif" | "video"; url: string; alt: string }[];
};

type Props = { games: GameOption[]; username: string; initialGameId: string; editing?: EditingPost };

type Item = {
  key: string;
  alt: string;
  name: string;
  size: number | null;
  previewUrl: string | null;
  existingId: string | null;
  file: File | null;
};

const ACCEPT = POST_MEDIA_MIMES.join(",");

function maxBytesFor(mime: string): number {
  if (mime === "image/gif") return POST_MEDIA_KINDS.gif.maxBytes;
  if (mime.startsWith("video/")) return POST_MEDIA_KINDS.video.maxBytes;
  return POST_MEDIA_KINDS.image.maxBytes;
}

function isErrorKey(value: string): value is PostErrorKey {
  return (POST_ERROR_KEYS as readonly string[]).includes(value);
}

function itemsOf(editing: EditingPost | undefined, fileLabel: (number: number) => string): Item[] {
  return (editing?.media ?? []).map((media, index) => ({
    key: `existing-${media.id}`,
    alt: media.alt,
    name: media.alt || fileLabel(index + 1),
    size: null,
    previewUrl: media.kind === "video" ? null : media.url,
    existingId: media.id,
    file: null,
  }));
}

/**
 * Form to publish an update or edit one: a type, an optional game of the author's, the text and up to four files (each with a
 * description) that can be added, removed and put in any order. The checks here only save a round trip; the server inspects
 * every new file again and the database has the last word. Editing sends the final list of files: the ones that stay (by id)
 * and the new ones.
 */
export function PostForm({ games, username, initialGameId, editing }: Props) {
  const t = useTranslations("postForm");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const urls = useRef<string[]>([]);
  const [kind, setKind] = useState<PostKindValue>(editing?.kind ?? "avance");
  const [gameId, setGameId] = useState(editing?.gameId ?? initialGameId);
  const [body, setBody] = useState(editing?.body ?? "");
  const [highlight, setHighlight] = useState(editing?.highlight ?? "");
  const [items, setItems] = useState<Item[]>(() => itemsOf(editing, (number) => t("edit.fileNumber", { number })));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const error = (key: PostErrorKey) => t(`errors.${key}`);

  function checkFile(file: File): PostErrorKey | null {
    if (!POST_MEDIA_MIMES.includes(file.type) || file.size === 0) return "fileInvalid";
    if (file.size > maxBytesFor(file.type)) return "fileTooLarge";
    return null;
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    const next = [...items];
    let problem: PostErrorKey | null = null;
    for (const file of picked) {
      if (next.length >= POST_MEDIA_MAX_FILES) {
        problem = "tooManyFiles";
        break;
      }
      const invalid = checkFile(file);
      if (invalid) {
        problem = invalid;
        continue;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (previewUrl) urls.current.push(previewUrl);
      next.push({ key: `${file.name}-${file.size}-${file.lastModified}-${next.length}`, alt: "", name: file.name, size: file.size, previewUrl, existingId: null, file });
    }
    setItems(next);
    setFieldErrors((current) => ({ ...current, files: problem ? error(problem) : "" }));
  }

  function move(index: number, offset: -1 | 1) {
    setItems((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
  }

  function showErrors(errors: Record<string, string>, general?: string) {
    setFieldErrors(errors);
    setMessage(general);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (body.trim() === "") {
      showErrors({ body: error("bodyRequired") });
      return;
    }
    if (kind === "nuevo_juego" && gameId === "") {
      showErrors({ gameId: error("gameRequired") });
      return;
    }

    const data = new FormData();
    data.set("kind", kind);
    data.set("body", body);
    data.set("gameId", gameId);
    data.set("highlight", kind === "hito" ? highlight : "");
    if (editing) {
      let uploads = 0;
      const plan = items.map((item) => (item.existingId ? { type: "keep", id: item.existingId, alt: item.alt } : { type: "new", index: uploads++, alt: item.alt }));
      data.set("media", JSON.stringify(plan));
      for (const item of items) if (item.file) data.append("files", item.file);
    } else {
      for (const item of items) {
        if (!item.file) continue;
        data.append("files", item.file);
        data.append("alt", item.alt);
      }
    }

    setMessage(undefined);
    setFieldErrors({});
    setPercent(0);
    setBusy(true);
    const target = editing ? { method: "PUT" as const, url: `/api/posts/${editing.id}` } : undefined;
    const result = await submitPost(data, (fraction) => setPercent(Math.round(fraction * 100)), target);
    if (result.ok) {
      toast.success(editing ? t("edit.saved") : t("published"));
      const destination = result.gamePublicId ? `/games/${result.gamePublicId}` : `/u/${username}`;
      router.push(localizePath(locale, destination));
      router.refresh();
      if (!editing) {
        setKind("avance");
        setGameId(initialGameId);
        setBody("");
        setHighlight("");
        setItems([]);
      }
      setBusy(false);
      setPercent(0);
      return;
    }
    setBusy(false);
    const text = isErrorKey(result.error) ? error(result.error) : error("generic");
    const field = result.field && ["body", "highlight", "gameId", "files", "kind"].includes(result.field) ? result.field : undefined;
    if (field) showErrors({ [field]: text });
    else showErrors({}, text);
  }

  const phase = busy ? (percent >= 100 ? "confirming" : "uploading") : "idle";
  const stepText = phase === "uploading" ? t(editing ? "edit.saving" : "publishing", { percent }) : phase === "confirming" ? t("processing") : "";
  const limits = {
    max: POST_MEDIA_MAX_FILES,
    image: formatBytes(locale, POST_MEDIA_KINDS.image.maxBytes),
    gif: formatBytes(locale, POST_MEDIA_KINDS.gif.maxBytes),
    video: formatBytes(locale, POST_MEDIA_KINDS.video.maxBytes),
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      {message ? <FormMessage>{message}</FormMessage> : null}

      <fieldset disabled={busy} className="grid min-w-0 gap-6">
        <SettingsSection title={t("detailsTitle")}>
          <div className="grid gap-6">
            <Field id="kind" label={t("fields.kind")} hint={t(`kindHints.${kind}`)} error={fieldErrors.kind}>
              {(control) => (
                <NativeSelect {...control} value={kind} onChange={(event) => setKind(event.target.value as PostKindValue)}>
                  {POST_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {t(`kinds.${value}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id="gameId" label={t("fields.game")} hint={t("fields.gameHint")} error={fieldErrors.gameId}>
              {(control) => (
                <NativeSelect {...control} value={gameId} onChange={(event) => setGameId(event.target.value)}>
                  <option value="">{t("fields.gamePlaceholder")}</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.title}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            {kind === "hito" ? (
              <Field id="highlight" label={t("fields.highlight")} hint={t("fields.highlightHint")} error={fieldErrors.highlight}>
                {(control) => (
                  <Input {...control} value={highlight} maxLength={POST_HIGHLIGHT_MAX} autoComplete="off" onChange={(event) => setHighlight(event.target.value)} />
                )}
              </Field>
            ) : null}
            <Field id="body" label={t("fields.body")} hint={t("fields.bodyCount", { count: Array.from(body).length, max: POST_BODY_MAX })} error={fieldErrors.body}>
              {(control) => <Textarea {...control} value={body} rows={6} onChange={(event) => setBody(event.target.value)} />}
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title={t("fields.files")} description={t("fields.filesHint", limits)}>
          <div className="grid gap-4">
            <Field id="files" label={t("addFiles")} error={fieldErrors.files}>
              {(control) => (
                <Input {...control} type="file" accept={ACCEPT} multiple className="py-2.5" onChange={onPick} disabled={items.length >= POST_MEDIA_MAX_FILES} />
              )}
            </Field>
            {items.length > 0 ? (
              <ul aria-label={t("selected")} className="grid gap-4">
                {items.map((item, index) => (
                  <li key={item.key} className="grid gap-3 rounded-2xl border border-white/10 bg-white/3 p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-start">
                    <div className="grid h-20 w-24 place-items-center overflow-hidden rounded-xl bg-black/30">
                      {item.previewUrl ? <img src={item.previewUrl} alt="" className="size-full object-cover" /> : <FilmIcon aria-hidden="true" className="size-7 text-text-3" />}
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-text-3">{item.size === null ? t("edit.current") : `${t("edit.new")} · ${formatBytes(locale, item.size)}`}</p>
                      <Field id={`alt-${index}`} label={t("fields.alt", { name: item.name })} hint={t("fields.altHint")}>
                        {(control) => (
                          <Input
                            {...control}
                            value={item.alt}
                            maxLength={POST_MEDIA_MAX_ALT}
                            autoComplete="off"
                            onChange={(event) => setItems((current) => current.map((entry) => (entry.key === item.key ? { ...entry, alt: event.target.value } : entry)))}
                          />
                        )}
                      </Field>
                    </div>
                    <div className="flex gap-2 sm:flex-col">
                      <Button type="button" variant="outline" size="icon" aria-label={t("edit.moveBefore", { name: item.name })} disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUpIcon aria-hidden="true" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" aria-label={t("edit.moveAfter", { name: item.name })} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDownIcon aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("remove", { name: item.name })}
                        onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </SettingsSection>
      </fieldset>

      <div className="grid gap-3">
        <UploadProgress phase={phase} percent={percent} stepText={stepText} progressLabel={t("progressLabel")} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={busy}>
            {editing ? t("edit.submit") : t("submit")}
          </Button>
          {editing ? (
            <Button asChild variant="outline" size="lg">
              <Link href={`/u/${username}`}>{t("edit.cancel")}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
