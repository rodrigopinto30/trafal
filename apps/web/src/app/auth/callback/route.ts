import { NextResponse, type NextRequest } from "next/server";
import { syncLocaleFromAccount } from "@/lib/auth/locale";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { oauthCallbackQuerySchema } from "@/lib/validation/auth";
import { parseNextPath } from "@/lib/validation/common";

/** Destino del login con Google (OAuth con PKCE): canjea el código por una sesión. Redirige a la URL pública (SITE_URL), no a la interna. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = oauthCallbackQuerySchema.safeParse({ code: searchParams.get("code") });
  const safeNext = parseNextPath(searchParams.get("next")) ?? "/";

  if (query.success) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(query.data.code);
    if (!error) {
      if (data.user) await syncLocaleFromAccount(data.user.id);
      return NextResponse.redirect(new URL(safeNext, publicEnv.siteUrl));
    }
  }
  return NextResponse.redirect(new URL("/login?error=oauthFailed", publicEnv.siteUrl));
}
