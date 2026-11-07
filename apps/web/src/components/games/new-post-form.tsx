"use client";

import { FilmIcon, XIcon } from "lucide-react";
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
import { localizePath } from "@/i18n/path";
import { formatBytes } from "@/lib/format";
import { submitPost } from "@/lib/games/post-upload";
import { POST_MEDIA_KINDS, POST_MEDIA_MAX_ALT, POST_MEDIA_MAX_FILES, POST_MEDIA_MIMES } from "@/lib/media/post-media";
import { POST_BODY_MAX, POST_ERROR_KEYS, POST_HIGHLIGHT_MAX, POST_KINDS, type PostErrorKey, type PostKindValue } from "@/lib/validation/post";

type OwnGameOption = { id: string; title: string };
type Props = { games: OwnGameOption[]; username: string; initialGameId: string };
type Chosen = { key: string; file: File; alt: string; previewUrl: string | null };

const ACCEPT = POST_MEDIA_MIMES.join(",");

function maxBytesFor(mime: string): number {
  if (mime === "image/gif") return POST_MEDIA_KINDS.gif.maxBytes;
  if (mime.startsWith("video/")) return POST_MEDIA_KINDS.video.maxBytes;
  return POST_MEDIA_KINDS.image.maxBytes;
}

function isErrorKey(value: string): value is PostErrorKey {
  return (POST_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * «Post an update» form: a type, an optional game of the author's, the text and up to four files with a description each.
 * The checks here only save a round trip; the server inspects every file again and the database has the last word.
 */
export function NewPostForm({ games, username, initialGameId }: Props) {
  const t = useTranslations("postForm");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const urls = useRef<string[]>([]);
  const [kind, setKind] = useState<PostKindValue>("avance");
  const [gameId, setGameId] = useState(initialGameId);
  const [body, setBody] = useState("");
  const [highlight, setHighlight] = useState("");
  const [files, setFiles] = useState<Chosen[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const error = (key: PostErrorKey) => t(`errors.${key}`);

  function checkFile(file: File): PostErrorKey | null {
    if (!POST_MEDIA_MIMES.includes(file.type)) return "fileInvalid";
    if (file.size === 0) return "fileInvalid";
    if (file.size > maxBytesFor(file.type)) return "fileTooLarge";
    return null;
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    const next = [...files];
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
      next.push({ key: `${file.name}-${file.size}-${file.lastModified}-${next.length}`, file, alt: "", previewUrl });
    }
    setFiles(next);
    setFieldErrors((current) => ({ ...current, files: problem ? error(problem) : "" }));
  }

  function showErrors(errors: Record<string, string>, general?: string) {
    setFieldErrors(errors);
    setMessage(general);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || done) return;
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
    for (const item of files) {
      data.append("files", item.file);
      data.append("alt", item.alt);
    }

    setMessage(undefined);
    setFieldErrors({});
    setPercent(0);
    setBusy(true);
    const result = await submitPost(data, (fraction) => setPercent(Math.round(fraction * 100)));
    if (result.ok) {
      setDone(true);
      toast.success(t("published"));
      const destination = result.gamePublicId ? `/games/${result.gamePublicId}` : `/u/${username}`;
      router.push(localizePath(locale, destination));
      return;
    }
    setBusy(false);
    const text = isErrorKey(result.error) ? error(result.error) : error("generic");
    const field = result.field && ["body", "highlight", "gameId", "files", "kind"].includes(result.field) ? result.field : undefined;
    if (field) showErrors({ [field]: text });
    else showErrors({}, text);
  }

  const phase = done ? "done" : busy ? (percent >= 100 ? "confirming" : "uploading") : "idle";
  const stepText = phase === "uploading" ? t("publishing", { percent }) : phase === "confirming" || phase === "done" ? t("processing") : "";
  const limits = {
    max: POST_MEDIA_MAX_FILES,
    image: formatBytes(locale, POST_MEDIA_KINDS.image.maxBytes),
    gif: formatBytes(locale, POST_MEDIA_KINDS.gif.maxBytes),
    video: formatBytes(locale, POST_MEDIA_KINDS.video.maxBytes),
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      {message ? <FormMessage>{message}</FormMessage> : null}

      <fieldset disabled={busy || done} className="grid min-w-0 gap-6">
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
                <Input {...control} type="file" accept={ACCEPT} multiple className="py-2.5" onChange={onPick} disabled={files.length >= POST_MEDIA_MAX_FILES} />
              )}
            </Field>
            {files.length > 0 ? (
              <ul aria-label={t("selected")} className="grid gap-4">
                {files.map((item, index) => (
                  <li key={item.key} className="grid gap-3 rounded-2xl border border-white/10 bg-white/3 p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-start">
                    <div className="grid h-20 w-24 place-items-center overflow-hidden rounded-xl bg-black/30">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <FilmIcon aria-hidden="true" className="size-7 text-text-3" />
                      )}
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <p className="truncate text-sm font-semibold">{item.file.name}</p>
                      <p className="text-xs text-text-3">{formatBytes(locale, item.file.size)}</p>
                      <Field id={`alt-${index}`} label={t("fields.alt", { name: item.file.name })} hint={t("fields.altHint")}>
                        {(control) => (
                          <Input
                            {...control}
                            value={item.alt}
                            maxLength={POST_MEDIA_MAX_ALT}
                            autoComplete="off"
                            onChange={(event) => setFiles((current) => current.map((entry) => (entry.key === item.key ? { ...entry, alt: event.target.value } : entry)))}
                          />
                        )}
                      </Field>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("remove", { name: item.file.name })}
                      onClick={() => setFiles((current) => current.filter((entry) => entry.key !== item.key))}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
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
          <Button type="submit" size="lg" disabled={busy || done}>
            {t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
