import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
