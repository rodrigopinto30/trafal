import type { PostErrorKey } from "@/lib/validation/post";

export type PostUploadResult =
  | { ok: true; postId: string; gamePublicId: string | null }
  | { ok: false; error: PostErrorKey; field?: string };

/**
 * Sends a new update (text and files) to the server and reports the upload progress of the request body. It uses XMLHttpRequest
 * because `fetch` cannot tell how much of a body has been sent. Anything unexpected in the answer is a generic error.
 */
export function submitPost(form: FormData, onProgress: (fraction: number) => void): Promise<PostUploadResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/posts");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onerror = () => resolve({ ok: false, error: "generic" });
    request.onload = () => {
      const body: unknown = request.response;
      if (body && typeof body === "object" && "ok" in body) resolve(body as PostUploadResult);
      else resolve({ ok: false, error: request.status === 413 ? "requestTooLarge" : "generic" });
    };
    request.send(form);
  });
}
