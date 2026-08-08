import { createServer, request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createBridge } from "./server.mjs";

const MIME_TYPES = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

export async function createPreviewServer({ token, root = process.cwd() } = {}) {
  if (!token) throw new Error("MIRRORA_AI_BRIDGE_TOKEN requerido");
  const bridge = createBridge({ token });
  bridge.listen(0, "127.0.0.1");
  await once(bridge, "listening");
  const bridgePort = bridge.address().port;
  const rootPath = resolve(root);

  const preview = createServer(async (request, response) => {
    const url = new URL(request.url, "http://preview.local");
    if (url.pathname.startsWith("/api/ai-closet")) return proxyToBridge(request, response, bridgePort, token);
    return serveStatic(response, rootPath, url.pathname);
  });

  return { server: preview, close: async () => {
    preview.close();
    bridge.close();
    await Promise.all([once(preview, "close"), once(bridge, "close")]);
  } };
}

function proxyToBridge(clientRequest, clientResponse, bridgePort, token) {
  const headers = { ...clientRequest.headers, authorization: `Bearer ${token}`, host: `127.0.0.1:${bridgePort}` };
  const upstream = httpRequest({ hostname: "127.0.0.1", port: bridgePort, path: clientRequest.url, method: clientRequest.method, headers }, bridgeResponse => {
    clientResponse.writeHead(bridgeResponse.statusCode, bridgeResponse.headers);
    bridgeResponse.pipe(clientResponse);
  });
  upstream.on("error", () => clientResponse.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ error: "bridge_unavailable" })));
  clientRequest.pipe(upstream);
}

async function serveStatic(response, rootPath, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = resolve(rootPath, relative);
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) return notFound(response);
  try {
    if (!(await stat(candidate)).isFile()) return notFound(response);
    response.writeHead(200, { "content-type": `${MIME_TYPES[extname(candidate)] || "application/octet-stream"}; charset=utf-8`, "cache-control": "no-store" });
    response.end(await readFile(candidate));
  } catch { return notFound(response); }
}

function notFound(response) { response.writeHead(404, { "content-type": "text/plain" }).end("Not found"); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = await createPreviewServer({ token: process.env.MIRRORA_AI_BRIDGE_TOKEN });
  const port = Number(process.env.PORT || 4181);
  server.listen(port, "127.0.0.1", () => console.log(`MIRRORA preview listening on http://127.0.0.1:${port}`));
}
