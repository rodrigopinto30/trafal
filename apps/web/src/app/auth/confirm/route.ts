import { NextResponse, type NextRequest } from "next/server";
import { syncLocaleFromAccount } from "@/lib/auth/locale";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { confirmQuerySchema } from "@/lib/validation/auth";
import { parseNextPath } from "@/lib/validation/common";

/**
 * La base es la URL pública configurada (SITE_URL), NO `request.nextUrl.origin`: dentro de Docker o detrás de un
 * proxy ese valor puede ser la dirección interna del servidor (p. ej. 0.0.0.0:3000), y redirigir a otro host haría
 * que el navegador no envíe la cookie de sesión recién creada.
 * Sin prefijo de idioma a propósito: el proxy aplica la cookie / Accept-Language al llegar.
 */
function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, publicEnv.siteUrl));
}

/**
 * Destino de los links de los mails (confirmar cuenta, recuperar contraseña). Usa token_hash en vez de PKCE
 * para que el link funcione aunque se abra en otro dispositivo o navegador que el que pidió el mail.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = confirmQuerySchema.safeParse({ token_hash: searchParams.get("token_hash"), type: searchParams.get("type") });
  const safeNext = parseNextPath(searchParams.get("next")) ?? "/";

  if (query.success) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type: query.data.type, token_hash: query.data.token_hash });
    if (!error) {
      // Si la cuenta ya tiene perfil, su idioma guardado pasa a ser el de este dispositivo.
      if (data.user) await syncLocaleFromAccount(data.user.id);
      return redirectTo(safeNext);
    }
  }
  return redirectTo("/login?error=linkExpired");
}
