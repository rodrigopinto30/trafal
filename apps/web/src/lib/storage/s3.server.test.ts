import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  assertStorageEnv: () => ({
    endpoint: "http://s3.test",
    publicEndpoint: "http://s3.test",
    region: "auto",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "media-bucket",
    hiddenBucket: "hidden-bucket",
    quarantineBucket: "quarantine-bucket",
    gamesBucket: "games-bucket",
  }),
}));
vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      send = send;
    },
    ListObjectsV2Command: class extends Command {},
    DeleteObjectsCommand: class extends Command {},
    DeleteObjectCommand: class extends Command {},
    CopyObjectCommand: class extends Command {},
    PutObjectCommand: class extends Command {},
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

import { deleteMediaObject, deleteStoragePrefix, moveMediaObject } from "./s3.server";

const sent = () => send.mock.calls.map(([command]) => ({ name: command.constructor.name, ...command.input }));

beforeEach(() => send.mockReset());

describe("deleteStoragePrefix", () => {
  it("refuses anything that is not a folder, without touching storage", async () => {
    for (const prefix of ["", "/", "../", "avatars", "a b/", "*/"]) {
      await expect(deleteStoragePrefix("media", prefix), prefix).rejects.toThrow("Refusing");
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("lists the folder and deletes what it finds in the right bucket, following the pages", async () => {
    send
      .mockResolvedValueOnce({ Contents: [{ Key: "k3x9a2/v1/a.js" }, { Key: "k3x9a2/v1/b.js" }], IsTruncated: true, NextContinuationToken: "next" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Contents: [{ Key: "k3x9a2/v2/c.js" }], IsTruncated: false })
      .mockResolvedValueOnce({});
    expect(await deleteStoragePrefix("games", "k3x9a2/")).toBe(3);
    const calls = sent();
    expect(calls[0]).toMatchObject({ name: "ListObjectsV2Command", Bucket: "games-bucket", Prefix: "k3x9a2/" });
    expect(calls[1]).toMatchObject({ name: "DeleteObjectsCommand", Bucket: "games-bucket", Delete: { Objects: [{ Key: "k3x9a2/v1/a.js" }, { Key: "k3x9a2/v1/b.js" }] } });
    expect(calls[2]).toMatchObject({ name: "ListObjectsV2Command", ContinuationToken: "next" });
    expect(calls[3]).toMatchObject({ name: "DeleteObjectsCommand", Delete: { Objects: [{ Key: "k3x9a2/v2/c.js" }] } });
  });

  it("uses the bucket of each kind (media also looks where moderation keeps what it hid), and an empty folder deletes nothing", async () => {
    send.mockResolvedValue({ Contents: [] });
    expect(await deleteStoragePrefix("media", "avatars/x/")).toBe(0);
    expect(await deleteStoragePrefix("quarantine", "x/")).toBe(0);
    expect(sent().map((call) => call.Bucket)).toEqual(["media-bucket", "hidden-bucket", "quarantine-bucket"]);
    expect(sent().every((call) => call.name === "ListObjectsV2Command")).toBe(true);
  });

  it("never deletes a key outside the folder, even if storage returned one", async () => {
    send.mockResolvedValueOnce({ Contents: [{ Key: "avatars/other/a.webp" }, { Key: "avatars/x/a.webp" }] }).mockResolvedValueOnce({}).mockResolvedValue({ Contents: [] });
    expect(await deleteStoragePrefix("media", "avatars/x/")).toBe(1);
    expect(sent()[1]).toMatchObject({ Delete: { Objects: [{ Key: "avatars/x/a.webp" }] } });
  });

  it("fails loudly when storage refuses to delete some of them", async () => {
    send.mockResolvedValueOnce({ Contents: [{ Key: "avatars/x/a.webp" }] }).mockResolvedValueOnce({ Errors: [{ Key: "avatars/x/a.webp" }] });
    await expect(deleteStoragePrefix("media", "avatars/x/")).rejects.toThrow("Could not delete 1");
  });
});

describe("media of moderated content", () => {
  it("deleting a media file removes it from the public bucket and from the hidden one", async () => {
    send.mockResolvedValue({});
    await deleteMediaObject("posts/p/a.webp");
    expect(sent().map((call) => [call.name, call.Bucket, call.Key])).toEqual([
      ["DeleteObjectCommand", "media-bucket", "posts/p/a.webp"],
      ["DeleteObjectCommand", "hidden-bucket", "posts/p/a.webp"],
    ]);
  });

  it("hiding copies the file to the private bucket with its metadata, then deletes the public one", async () => {
    send.mockResolvedValue({});
    expect(await moveMediaObject("covers/u/abc.gif", "hidden")).toBe(true);
    expect(sent()).toEqual([
      { name: "CopyObjectCommand", Bucket: "hidden-bucket", Key: "covers/u/abc.gif", CopySource: "media-bucket/covers/u/abc.gif", MetadataDirective: "COPY" },
      { name: "DeleteObjectCommand", Bucket: "media-bucket", Key: "covers/u/abc.gif" },
    ]);
  });

  it("restoring goes the other way, and a file that is not there is simply skipped", async () => {
    send.mockRejectedValueOnce(Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" }));
    expect(await moveMediaObject("covers/u/abc.gif", "public")).toBe(false);
    expect(sent()).toEqual([{ name: "CopyObjectCommand", Bucket: "media-bucket", Key: "covers/u/abc.gif", CopySource: "hidden-bucket/covers/u/abc.gif", MetadataDirective: "COPY" }]);
  });
});
