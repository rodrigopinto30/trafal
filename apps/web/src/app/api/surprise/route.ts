import { NextResponse, type NextRequest } from "next/server";
import { localizePath } from "@/i18n/path";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { parseSurpriseParams } from "@/lib/validation/surprise";

/**
 * «Sorprendeme»: sends the person to a published game chosen at random, leaving out the one they are on. It is a plain redirect
 * (temporary and never cached: every visit picks again). With no published game it sends them to Explore.
 */
export async function GET(request: NextRequest) {
  const { locale, exclude } = parseSurpriseParams({ lang: request.nextUrl.searchParams.get("lang"), exclude: request.nextUrl.searchParams.get("exclude") });
  const supabase = await createClient();
  const { data } = await supabase.rpc("random_game", { p_exclude: exclude ?? undefined });
  const path = data ? `/games/${data}` : "/explore";
  const response = NextResponse.redirect(new URL(localizePath(locale, path), publicEnv.siteUrl), 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
