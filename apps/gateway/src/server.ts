import { createServer, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { CachedDeliveryLookup, SupabaseDeliveryLookup } from "./delivery.ts";
import { loadGatewayConfig, ConfigError } from "./config.ts";
import { createGatewayHandler } from "./handler.ts";
import { securityHeaders } from "./headers.ts";
import { toRequest } from "./node-request.ts";
import { S3GameStorage } from "./storage.ts";

async function send(response: Response, outgoing: ServerResponse): Promise<void> {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    outgoing.end();
    return;
  }
  const stream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  outgoing.on("close", () => stream.destroy());
  stream.on("error", () => outgoing.destroy());
  stream.pipe(outgoing);
}

function main(): void {
  let config;
  try {
    config = loadGatewayConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }
  const delivery = new CachedDeliveryLookup(new SupabaseDeliveryLookup(config.supabaseUrl, config.supabaseKey), config.deliveryCacheSeconds);
  const handle = createGatewayHandler({ config, delivery, storage: new S3GameStorage(config.s3) });

  const server = createServer((incoming, outgoing) => {
    if (incoming.url === "/__health") {
      outgoing.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
      return;
    }
    const request = toRequest(incoming);
    if (!request) {
      outgoing.writeHead(400, Object.fromEntries(securityHeaders(config))).end("Bad request");
      return;
    }
    handle(request)
      .catch((error: unknown) => {
        console.error("gateway error", error);
        return new Response("Internal error", { status: 500, headers: securityHeaders(config) });
      })
      .then((response) => send(response, outgoing))
      .catch(() => outgoing.destroy());
  });
  server.listen(config.port, "0.0.0.0", () => console.log(`gateway listening on :${config.port} for *.${config.gamesDomain}`));
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => server.close(() => process.exit(0)));
}

main();
