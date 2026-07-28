const ALLOWED_METHODS = new Set(["GET", "POST", "DELETE"]);
const FORWARDED_HEADERS = ["content-type", "idempotency-key", "x-client-id"];

export function createAiClosetProxy({ bridgeOrigin, bridgeToken, fetchImpl = globalThis.fetch } = {}) {
  const origin = normalizeBridgeOrigin(bridgeOrigin);
  const token = normalizeSecret(bridgeToken);
  if (!token) throw new Error("MIRRORA_AI_BRIDGE_TOKEN requerido");
  if (typeof fetchImpl !== "function") throw new Error("fetch requerido");

  return {
    async fetch(request) {
      if (!ALLOWED_METHODS.has(request.method)) return Response.json({ error: "method_not_allowed" }, { status: 405 });
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/ai-closet/")) return Response.json({ error: "not_found" }, { status: 404 });

      const headers = new Headers();
      for (const name of FORWARDED_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set("authorization", `Bearer ${token}`);

      const upstream = await fetchImpl(`${origin}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: request.method === "GET" ? undefined : request.body,
        duplex: request.method === "GET" ? undefined : "half",
      });

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete("set-cookie");
      responseHeaders.set("cache-control", "no-store");
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    },
  };
}

function normalizeBridgeOrigin(value) {
  if (!value) throw new Error("MIRRORA_AI_BRIDGE_ORIGIN requerido");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("El bridge debe usar HTTPS fuera de local");
  return url.origin;
}

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default {
  fetch(request) {
    return createAiClosetProxy({
      bridgeOrigin: process.env.MIRRORA_AI_BRIDGE_ORIGIN,
      bridgeToken: process.env.MIRRORA_AI_BRIDGE_TOKEN,
    }).fetch(request);
  },
};
