import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { createPost, POST_REQUEST_MAX_BYTES } from "@/lib/games/post-service";

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Receives a new update as multipart form data (text fields plus up to four files). It is a route handler and not a Server
 * Action because the files can be large and Server Actions have a small body cap that applies to every action. As a handler
 * it does not get the Origin check that actions have, so it makes it itself: only requests that come from this site's pages.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(publicEnv.siteUrl).origin) return json({ ok: false, error: "generic" }, 403);

  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return json({ ok: false, error: "requestTooLarge" }, 411);
  if (length > POST_REQUEST_MAX_BYTES) return json({ ok: false, error: "requestTooLarge" }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "generic" }, 400);
  }

  const result = await createPost(form);
  if (!result.ok) return json(result, result.error === "unauthenticated" ? 401 : 422);
  revalidatePath("/", "layout");
  return json(result, 201);
}
