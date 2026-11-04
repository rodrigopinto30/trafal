"use client";

import { CameraIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/brand/user-avatar";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "@/i18n/client";
import { AVATAR_SIZE, MAX_AVATAR_SOURCE_BYTES } from "@/lib/media/avatar";
import { CENTERED, MAX_ZOOM, MIN_ZOOM, clampCrop, drawRect, zoomTo, type Crop } from "@/lib/media/avatar-crop";
import { removeAvatarAction, uploadAvatarAction } from "@/lib/profile/avatar-actions";

type Props = {
  username: string;
  displayName: string;
  /** Ruta de la foto actual (`profiles.avatar_path`), o null si usa la letra de colores. */
  avatarPath: string | null;
};

/** Imagen ya decodificada en memoria, lista para dibujarse en un canvas. */
type Decoded = { image: CanvasImageSource; width: number; height: number; release: () => void };

/** Por encima de esto el navegador reservaría demasiada memoria solo para recortar un avatar. */
const MAX_SOURCE_PIXELS = 48_000_000;
/** Fondo con el que se rellena la foto (el color de fondo del sitio): así nunca queda transparente. */
const BACKGROUND = "#07060e";
const KEY_STEP = 8;

async function decodeImage(file: File): Promise<Decoded> {
  let decoded: Decoded | null = null;
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image": respeta la orientación EXIF (las fotos del celular vienen "acostadas" con una marca de rotación).
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      decoded = { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Algunos navegadores no decodifican todos los formatos por esta vía: se prueba con un <img>.
    }
  }
  if (!decoded) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      decoded = { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
  if (decoded.width < 1 || decoded.height < 1 || decoded.width * decoded.height > MAX_SOURCE_PIXELS) {
    decoded.release();
    throw new Error("image-size");
  }
  return decoded;
}

function paint(ctx: CanvasRenderingContext2D, decoded: Decoded, crop: Crop) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = "high";
  const r = drawRect(crop, decoded.width, decoded.height, AVATAR_SIZE);
  ctx.drawImage(decoded.image, r.dx, r.dy, r.dw, r.dh);
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Genera la imagen final de 256×256. WebP si el navegador sabe codificarlo; si no (Safari), JPEG. */
async function exportAvatar(decoded: Decoded, crop: Crop): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paint(ctx, decoded, crop);
  const webp = await toBlob(canvas, "image/webp", 0.86);
  if (webp && webp.type === "image/webp") return webp;
  return toBlob(canvas, "image/jpeg", 0.9);
}

export function AvatarEditor({ username, displayName, avatarPath: initialPath }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [avatarPath, setAvatarPath] = useState(initialPath);
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [crop, setCrop] = useState<Crop>(CENTERED);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ startX: number; startY: number; crop: Crop } | null>(null);

  // El canvas está dentro del diálogo (un portal que se monta después): por eso se guarda el elemento en el estado y
  // se vuelve a dibujar cuando aparece, no solo cuando cambia el recorte.
  useEffect(() => {
    if (!canvas || !decoded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = canvas.width / AVATAR_SIZE;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(ctx, decoded, crop);
  }, [canvas, decoded, crop]);

  function closeEditor() {
    decoded?.release();
    setDecoded(null);
    setCrop(CENTERED);
    drag.current = null;
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setError(t("avatar.errors.sourceTooBig"));
      return;
    }
    try {
      setDecoded(await decodeImage(file));
      setCrop(CENTERED);
    } catch {
      setError(t("avatar.errors.unreadable"));
    }
  }

  function save() {
    if (!decoded) return;
    setError(null);
    startTransition(async () => {
      const blob = await exportAvatar(decoded, clampCrop(crop, decoded.width, decoded.height, AVATAR_SIZE));
      if (!blob) {
        setError(t("avatar.errors.unreadable"));
        return;
      }
      const form = new FormData();
      form.append("file", new File([blob], blob.type === "image/webp" ? "avatar.webp" : "avatar.jpg", { type: blob.type }));
      const result = await uploadAvatarAction(form);
      if (result.ok) {
        setAvatarPath(result.avatarPath);
        closeEditor();
        toast.success(t("avatar.saved"));
      } else {
        setError(t(`avatar.errors.${result.error}`));
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.ok) {
        setAvatarPath(null);
        toast.success(t("avatar.removed"));
      } else {
        setError(t(`avatar.errors.${result.error}`));
      }
    });
  }

  /* ---- Mover la imagen: arrastrando (mouse, dedo) o con las flechas ---- */

  function update(next: Crop) {
    if (decoded) setCrop(clampCrop(next, decoded.width, decoded.height, AVATAR_SIZE));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, crop };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    // Los píxeles de pantalla se pasan a «unidades de vista» (el cuadrado de 256 que se recorta).
    const unit = AVATAR_SIZE / event.currentTarget.getBoundingClientRect().width;
    update({ ...start.crop, x: start.crop.x + (event.clientX - start.startX) * unit, y: start.crop.y + (event.clientY - start.startY) * unit });
  }

  function endDrag() {
    drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!decoded) return;
    const step = event.shiftKey ? KEY_STEP * 3 : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      update({ ...crop, x: crop.x + move[0], y: crop.y + move[1] });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setCrop(zoomTo(crop, crop.zoom + 0.1, decoded.width, decoded.height, AVATAR_SIZE));
    } else if (event.key === "-") {
      event.preventDefault();
      setCrop(zoomTo(crop, crop.zoom - 0.1, decoded.width, decoded.height, AVATAR_SIZE));
    }
  }

  return (
    <SettingsSection title={t("avatar.title")} description={t("avatar.text")}>
      <div className="flex flex-wrap items-center gap-5 sm:gap-7">
        <UserAvatar username={username} displayName={displayName} avatarPath={avatarPath} size="xl" alt="" />

        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm text-text-3">{t("avatar.hint")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => fileInput.current?.click()} disabled={pending}>
              <CameraIcon aria-hidden="true" />
              {avatarPath ? t("avatar.change") : t("avatar.upload")}
            </Button>
            {avatarPath ? (
              <Button type="button" variant="outline" onClick={remove} disabled={pending}>
                <Trash2Icon aria-hidden="true" />
                {pending && !decoded ? t("avatar.removing") : t("avatar.remove")}
              </Button>
            ) : null}
          </div>
          {error && !decoded ? (
            <p role="alert" className="mt-3 text-sm font-medium text-[#ff8fa5]">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* El selector de archivos real queda oculto; el botón de arriba lo abre. Se vacía al elegir para poder repetir el mismo archivo. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("avatar.upload")}
        data-testid="avatar-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFileChosen(file);
        }}
      />

      <Dialog
        open={decoded !== null}
        onOpenChange={(open) => {
          // Mientras se sube la foto no se puede cerrar el diálogo (se perdería el resultado).
          if (!open && !pending) closeEditor();
        }}
      >
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("avatar.editorTitle")}</DialogTitle>
            <DialogDescription id="avatar-editor-help">{t("avatar.editorHelp")}</DialogDescription>
          </DialogHeader>

          {/* touch-action: none → arrastrar con el dedo mueve la foto en vez de desplazar la página. */}
          <div
            role="group"
            tabIndex={0}
            aria-label={t("avatar.cropArea")}
            aria-describedby="avatar-editor-help"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="mx-auto aspect-square w-full max-w-[288px] cursor-grab touch-none overflow-hidden rounded-[30px] border border-white/15 bg-ink outline-none select-none focus-visible:ring-2 focus-visible:ring-cyan active:cursor-grabbing"
          >
            <canvas ref={setCanvas} width={AVATAR_SIZE * 2} height={AVATAR_SIZE * 2} className="size-full" />
          </div>

          <div className="grid gap-1">
            <label htmlFor="avatar-zoom" className="text-sm font-semibold text-text-2">
              {t("avatar.zoom")}
            </label>
            <input
              id="avatar-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={crop.zoom}
              onChange={(event) => decoded && setCrop(zoomTo(crop, Number(event.target.value), decoded.width, decoded.height, AVATAR_SIZE))}
              className="h-11 w-full accent-violet"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-[#ff8fa5]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeEditor} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? t("avatar.saving") : t("avatar.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
