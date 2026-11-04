"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { AVATAR_FORMATS, AVATAR_SIZE, avatarObjectKey, avatarPathPattern } from "@/lib/media/avatar";
import { inspectImage } from "@/lib/media/image-sniff";
import { deleteMediaObject, putMediaObject } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_ERROR_KEYS, avatarUploadSchema, type AvatarErrorKey } from "@/lib/validation/profile";

export type AvatarResult = { ok: true; avatarPath: string | null } | { ok: false; error: AvatarErrorKey };

const fail = (error: AvatarErrorKey): AvatarResult => ({ ok: false, error });

/** Borra una foto vieja SIN dejar que un fallo del almacenamiento rompa la acción (en el peor caso queda un archivo huérfano). */
async function discardAvatar(userId: string, path: string | null | undefined): Promise<void> {
  // Defensa en profundidad: la base ya garantiza que la ruta está en la carpeta de la persona; igual se comprueba antes de borrar.
  if (!path || !avatarPathPattern(userId).test(path)) return;
  try {
    await deleteMediaObject(path);
  } catch (error) {
    console.error("[avatar] no se pudo borrar un archivo viejo", path, error);
  }
}

/**
 * Sube la foto de perfil. El navegador ya la recortó y la achicó a 256×256, pero el servidor NO se fía de eso: vuelve a
 * comprobar el tamaño del archivo, el tipo real (por la cabecera, no por el nombre ni el tipo declarado), las dimensiones
 * y que no sea animada. Recién entonces la guarda, con un nombre aleatorio dentro de la carpeta de la propia persona.
 */
export async function uploadAvatarAction(formData: FormData): Promise<AvatarResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = avatarUploadSchema.safeParse({ file: formData.get("file") });
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return fail(AVATAR_ERROR_KEYS.find((key) => key === reported) ?? "invalid");
  }
  const { file } = parsed.data;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectImage(bytes);
  if (!info) return fail("invalid");
  if (AVATAR_FORMATS[info.format].mime !== file.type) return fail("invalid"); // el tipo declarado tiene que ser el real
  if (info.animated) return fail("animated");
  if (info.width !== AVATAR_SIZE || info.height !== AVATAR_SIZE) return fail("dimensions");

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
  if (!current) return fail("save"); // sin perfil (todavía no hizo el onboarding)

  const key = avatarObjectKey(user.id, randomBytes(16).toString("hex"), info.format);
  try {
    await putMediaObject(key, bytes, AVATAR_FORMATS[info.format].mime);
  } catch (error) {
    console.error("[avatar] no se pudo subir al almacenamiento", error);
    return fail("storage");
  }

  // RLS + el CHECK de la base: solo la propia fila y solo una ruta dentro de la carpeta propia. El .select() distingue
  // «actualizó» de «RLS filtró la fila» (cuenta suspendida), que no da error pero tampoco cambia nada.
  const { data: updated, error } = await supabase.from("profiles").update({ avatar_path: key }).eq("id", user.id).select("id");
  if (error || !updated?.length) {
    await discardAvatar(user.id, key); // se deshace la subida: no queda un archivo sin dueño
    return fail("save");
  }

  await discardAvatar(user.id, current.avatar_path);
  revalidatePath("/", "layout"); // el avatar también está en la barra de navegación
  return { ok: true, avatarPath: key };
}

/** Quita la foto: el perfil vuelve a mostrar la letra de colores. */
export async function removeAvatarAction(): Promise<AvatarResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
  if (!current) return fail("save");

  const { data: updated, error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id).select("id");
  if (error || !updated?.length) return fail("save");

  await discardAvatar(user.id, current.avatar_path);
  revalidatePath("/", "layout");
  return { ok: true, avatarPath: null };
}
