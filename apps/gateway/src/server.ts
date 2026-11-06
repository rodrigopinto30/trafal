import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { CachedDeliveryLookup, SupabaseDeliveryLookup } from "./delivery.ts";
import { loadGatewayConfig, ConfigError } from "./config.ts";
import { createGatewayHandler } from "./handler.ts";
import { securityHeaders } from "./headers.ts";
import { S3GameStorage } from "./storage.ts";

/** Node adapter: turns each incoming HTTP request into a standard Request and streams the Response back. */
function toRequest(incoming: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const host = incoming.headers.host ?? "localhost";
  return new Request(`http://${host}${incoming.url ?? "/"}`, { method: incoming.method ?? "GET", headers });
}

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
    handle(toRequest(incoming))
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
