import "server-only";
import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertStorageEnv } from "@/lib/env.server";

/**
 * Cliente del almacenamiento de objetos (S3 compatible: Cloudflare R2 en producción, S3 de Supabase Storage en local).
 * Solo corre en el servidor. Se crea la primera vez que se usa y se reutiliza.
 *
 * Ojo con dos opciones, que valen para R2 y para el emulador local:
 *   · forcePathStyle: la URL lleva el bucket en la ruta (endpoint/bucket/clave), no como subdominio.
 *   · requestChecksumCalculation «WHEN_REQUIRED»: el SDK nuevo agrega por defecto sumas de verificación que varios
 *     servicios compatibles con S3 no entienden.
 */
let client: S3Client | undefined;

function s3(): { client: S3Client; bucket: string } {
  const env = assertStorageEnv();
  client ??= new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: env.bucket };
}

/** Sube un objeto al bucket de medios. Las imágenes llevan caché largo e inmutable: cada subida usa una clave nueva. */
export async function putMediaObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { client, bucket } = s3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/** Borra un objeto. Es idempotente: borrar algo que no existe no es un error. */
export async function deleteMediaObject(key: string): Promise<void> {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export type StorageBucket = "media" | "quarantine" | "games";

const PREFIX_SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]*(\/[A-Za-z0-9][A-Za-z0-9_-]*)*\/$/;

/**
 * Deletes every object under a folder of one of the buckets and returns how many went. The folder must be a real one (letters,
 * digits, dashes and a trailing slash): an empty or malformed prefix would reach the whole bucket, so it is refused. Deleting
 * an empty or missing folder is not an error.
 */
export async function deleteStoragePrefix(bucket: StorageBucket, prefix: string): Promise<number> {
  if (!PREFIX_SHAPE.test(prefix)) throw new Error(`Refusing to delete the folder «${prefix}»`);
  const { client } = s3();
  const env = assertStorageEnv();
  const name = bucket === "media" ? env.bucket : bucket === "quarantine" ? env.quarantineBucket : env.gamesBucket;

  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: name, Prefix: prefix, ContinuationToken: token }));
    const keys = (page.Contents ?? []).flatMap((object) => (object.Key?.startsWith(prefix) ? [{ Key: object.Key }] : []));
    if (keys.length > 0) {
      const result = await client.send(new DeleteObjectsCommand({ Bucket: name, Delete: { Objects: keys, Quiet: true } }));
      if (result.Errors?.length) throw new Error(`Could not delete ${result.Errors.length} objects under «${prefix}»`);
      deleted += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

let signingClient: S3Client | undefined;

/**
 * Creates a presigned PUT URL so the browser can upload a game zip straight to the quarantine bucket, never through the
 * app server. The signature pins the content type and the exact size, and expires quickly. It is signed against the
 * address the BROWSER uses (S3_PUBLIC_ENDPOINT): the signature covers the host, so the server-side address would not work.
 */
export async function createQuarantineUploadUrl(key: string, sizeBytes: number, expiresInSeconds: number): Promise<string> {
  const env = assertStorageEnv();
  signingClient ??= new S3Client({
    endpoint: env.publicEndpoint,
    region: env.region,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  const command = new PutObjectCommand({
    Bucket: env.quarantineBucket,
    Key: key,
    ContentType: "application/zip",
    ContentLength: sizeBytes,
  });
  return getSignedUrl(signingClient, command, {
    expiresIn: expiresInSeconds,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}
