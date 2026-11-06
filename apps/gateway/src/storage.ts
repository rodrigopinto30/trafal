import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { GatewayConfig } from "./config.ts";

export type ObjectMeta = {
  contentType: string;
  contentEncoding: string | null;
  contentLength: number;
  etag: string | null;
};

export type ObjectBody = ObjectMeta & {
  status: 200 | 206;
  contentRange: string | null;
  body: ReadableStream<Uint8Array>;
};

export type RangeNotSatisfiable = { rangeNotSatisfiable: true };

/** Read access to the published files of games. In production it is the R2 bucket; locally, the S3 API of Supabase Storage. */
export interface GameStorage {
  head(key: string): Promise<ObjectMeta | null>;
  get(key: string, range: string | null): Promise<ObjectBody | RangeNotSatisfiable | null>;
}

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

function statusOf(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

export class S3GameStorage implements GameStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: GatewayConfig["s3"]) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async head(key: string): Promise<ObjectMeta | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        contentType: result.ContentType ?? DEFAULT_CONTENT_TYPE,
        contentEncoding: result.ContentEncoding ?? null,
        contentLength: result.ContentLength ?? 0,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  async get(key: string, range: string | null): Promise<ObjectBody | RangeNotSatisfiable | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, ...(range ? { Range: range } : {}) }));
      if (!result.Body) return null;
      return {
        status: result.ContentRange ? 206 : 200,
        contentType: result.ContentType ?? DEFAULT_CONTENT_TYPE,
        contentEncoding: result.ContentEncoding ?? null,
        contentLength: result.ContentLength ?? 0,
        etag: result.ETag ?? null,
        contentRange: result.ContentRange ?? null,
        body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      };
    } catch (error) {
      const status = statusOf(error);
      if (status === 404) return null;
      if (status === 416) return { rangeNotSatisfiable: true };
      throw error;
    }
  }
}
