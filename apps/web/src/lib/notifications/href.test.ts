import { describe, expect, it } from "vitest";
import { notificationHref } from "./href";

const base = { data: {}, actor: null, game: null, post: null, comment: null } as const;

describe("notificationHref", () => {
  it("leads follows to the profile of who followed", () => {
    expect(notificationHref({ ...base, type: "follow", actor: { username: "mateo_g", display_name: "Mateo" } })).toBe("/u/mateo_g");
    expect(notificationHref({ ...base, type: "follow" })).toBeNull();
  });

  it("leads comments, replies, likes and helpful to the game or the update", () => {
    for (const type of ["comment", "reply", "like", "helpful"] as const) {
      expect(notificationHref({ ...base, type, game: { public_id: "orbita", title: "Órbita" } })).toBe("/games/orbita");
      expect(notificationHref({ ...base, type, post: { id: "p1", body: "x" } })).toBe("/posts/p1");
    }
    expect(notificationHref({ ...base, type: "like" })).toBeNull();
  });

  it("lands on the comment itself when the notification is about one", () => {
    const comment = { id: "c1", body: "x", post_id: null, game: null };
    for (const type of ["comment", "reply", "helpful"] as const) {
      expect(notificationHref({ ...base, type, game: { public_id: "orbita", title: "Órbita" }, comment })).toBe("/games/orbita#comment-c1");
      expect(notificationHref({ ...base, type, post: { id: "p1", body: "x" }, comment })).toBe("/posts/p1#comment-c1");
    }
    expect(notificationHref({ ...base, type: "comment", game: { public_id: "orbita", title: "Órbita" } })).toBe("/games/orbita");
    expect(notificationHref({ ...base, type: "like", game: { public_id: "orbita", title: "Órbita" }, comment })).toBe("/games/orbita");
  });

  it("leads the upload results to the management of the game", () => {
    for (const type of ["version_ready", "version_error"] as const) {
      expect(notificationHref({ ...base, type, game: { public_id: "orbita", title: "Órbita" } })).toBe("/games/orbita/manage");
    }
  });

  it("leads a moderated comment to where it lives, and account notices nowhere", () => {
    expect(notificationHref({ ...base, type: "moderation", data: { target_type: "comment" }, comment: { id: "c1", body: "x", post_id: null, game: { public_id: "orbita" } } })).toBe("/games/orbita#comment-c1");
    expect(notificationHref({ ...base, type: "moderation", data: { target_type: "comment" }, comment: { id: "c1", body: "x", post_id: "p1", game: null } })).toBe("/posts/p1#comment-c1");
    expect(notificationHref({ ...base, type: "moderation", data: { target_type: "game" }, game: { public_id: "orbita", title: "Órbita" } })).toBe("/games/orbita");
    expect(notificationHref({ ...base, type: "moderation", data: { action: "suspend", target_type: "profile" } })).toBeNull();
  });

  it("leads the answer to an appeal to the moderation screen, whatever it was about", () => {
    for (const target_type of ["profile", "game", "post", "comment"]) {
      for (const action of ["appeal_upheld", "appeal_overturned"]) {
        expect(notificationHref({ ...base, type: "moderation", data: { action, target_type }, game: { public_id: "orbita", title: "Órbita" } })).toBe("/settings/moderation");
      }
    }
  });
});
