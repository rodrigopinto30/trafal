import { beforeEach, describe, expect, it, vi } from "vitest";

const moveMediaObject = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/s3.server", () => ({ moveMediaObject: (...args: unknown[]) => moveMediaObject(...args) }));

import { placeModeratedMedia } from "./media.server";

type Rows = Record<string, unknown>;

/** A tiny stand-in of the Supabase client: each table answers with the rows given, whatever the filters. */
function fakeSupabase(tables: Record<string, Rows | Rows[] | null>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? null;
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: Array.isArray(rows) ? (rows[0] ?? null) : rows }),
        then: (resolve: (value: { data: unknown }) => void) => resolve({ data: rows }),
      };
      return query;
    },
  } as never;
}

beforeEach(() => moveMediaObject.mockReset().mockResolvedValue(true));

describe("placeModeratedMedia", () => {
  it("moves the cover and the GIF of a hidden game to the private bucket", async () => {
    const supabase = fakeSupabase({ games: { status: "hidden", cover_path: "covers/u/a.webp", gif_path: "covers/u/b.gif" } });
    await placeModeratedMedia(supabase, [{ type: "game", id: "g" }]);
    expect(moveMediaObject.mock.calls).toEqual([
      ["covers/u/a.webp", "hidden"],
      ["covers/u/b.gif", "hidden"],
    ]);
  });

  it("brings back the files of an update that was restored", async () => {
    const supabase = fakeSupabase({ posts: { status: "published" }, post_media: [{ path: "posts/p/1.webp" }, { path: "posts/p/2.mp4" }] });
    await placeModeratedMedia(supabase, [{ type: "post", id: "p" }]);
    expect(moveMediaObject.mock.calls).toEqual([
      ["posts/p/1.webp", "public"],
      ["posts/p/2.mp4", "public"],
    ]);
  });

  it("never fails the decision: a file that cannot be moved is logged and the rest go on", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    moveMediaObject.mockRejectedValueOnce(new Error("storage down")).mockResolvedValue(true);
    const supabase = fakeSupabase({ games: { status: "removed", cover_path: "covers/u/a.webp", gif_path: "covers/u/b.gif" } });
    await expect(placeModeratedMedia(supabase, [{ type: "game", id: "g" }])).resolves.toBeUndefined();
    expect(moveMediaObject).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("does nothing for content that is not there anymore", async () => {
    await placeModeratedMedia(fakeSupabase({ games: null }), [{ type: "game", id: "gone" }]);
    expect(moveMediaObject).not.toHaveBeenCalled();
  });
});
