import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { POST_REQUEST_MAX_BYTES, updatePost } from "@/lib/games/post-service";

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Saves an edited update (multipart form data: the fields, the final list of files and the new files). Like the route that
 * creates updates, it is a route handler because the files can be large, so it checks the request's origin itself.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ postId: string }> }) {
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

  const result = await updatePost((await context.params).postId, form);
  if (!result.ok) return json(result, result.error === "unauthenticated" ? 401 : result.error === "notFound" ? 404 : 422);
  revalidatePath("/", "layout");
  return json(result, 200);
}
