/**
 * PUTs a file to a presigned URL with progress reporting. fetch() cannot report upload progress, so this uses XMLHttpRequest.
 * The content type has to match the one the URL was signed for.
 */
export function putZip(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", "application/zip");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`upload failed: ${request.status}`)));
    request.onerror = () => reject(new Error("upload failed: network error"));
    request.onabort = () => reject(new Error("upload aborted"));
    request.send(file);
  });
}
