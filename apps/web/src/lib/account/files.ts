import "server-only";
import { deleteStoragePrefix } from "@/lib/storage/s3.server";
import type { AccountFile } from "@/lib/validation/account";

const PARALLEL_FOLDERS = 6;

/**
 * Empties the storage folders of a deleted account. It never throws: the account is already gone, so a folder that could not be
 * emptied is logged (with the folder, to clean it by hand) and the rest go on. Returns how many folders failed.
 */
export async function removeAccountFiles(files: readonly AccountFile[]): Promise<number> {
  let failed = 0;
  for (let start = 0; start < files.length; start += PARALLEL_FOLDERS) {
    const batch = files.slice(start, start + PARALLEL_FOLDERS);
    const results = await Promise.allSettled(batch.map((file) => deleteStoragePrefix(file.bucket, file.prefix)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failed += 1;
        console.error(`account deletion: could not empty ${batch[index]?.bucket}/${batch[index]?.prefix}`, result.reason);
      }
    });
  }
  return failed;
}
