import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createProcessingService, createProcessingServiceFromEnv } from "./processing.mjs";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const ASSET_SCHEMA = "ai-closet-asset-request/v0.1";
const TRY_ON_SCHEMA = "mirrora-tryon-request/v0.1";

export function createBridge({ token, now = () => Date.now(), requestLimit = 30, windowMs = 60_000, processing = createProcessingService({ now }) } = {}) {
  const bridgeToken = normalizeSecret(token);
  if (!bridgeToken) throw new Error("MIRRORA_AI_BRIDGE_TOKEN requerido");

  const requests = new Map();
  const jobs = new Map();
  const idempotency = new Map();

  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://bridge.local");
    const requestId = randomUUID();
    const send = (status, body) => response.writeHead(status, { ...JSON_HEADERS, "x-request-id": requestId }).end(JSON.stringify(body));

    if (request.method === "GET" && url.pathname === "/health") {
      return send(200, { schema: "mirrora-ai-bridge-health/v0.1", status: "ok", providers: "simulated" });
    }

    if (!url.pathname.startsWith("/api/ai-closet")) return send(404, error("not_found", "Ruta no encontrada"));
    if (readBearerToken(request.headers.authorization) !== bridgeToken) return send(401, error("unauthorized", "Token de bridge invalido"));

    const clientKey = request.headers["x-client-id"] || "anonymous";
    const allowed = allowRequest(requests, clientKey, now(), requestLimit, windowMs);
    if (!allowed) return send(429, error("rate_limited", "Limite temporal alcanzado"));

    try {
      if (request.method === "GET" && url.pathname === "/api/ai-closet/closet") {
        return send(200, { schema: "ai-closet-closet-response/v0.1", campaignId: url.searchParams.get("campaign"), items: [] });
      }

      if (request.method === "POST" && ["/api/ai-closet/categorize", "/api/ai-closet/remove-background"].includes(url.pathname)) {
        const body = await readJson(request);
        assertAssetRequest(body, { allowUpload: url.pathname.endsWith("remove-background") });
        const operation = url.pathname.endsWith("categorize") ? "categorize" : "remove-background";
        const key = request.headers["idempotency-key"];
        if (key && idempotency.has(key)) return send(202, idempotency.get(key));
        const job = await processing.start(operation, body.assetId, body.upload ? localUploadFixture(body.upload) : null);
        if (key) idempotency.set(key, job);
        return send(202, job);
      }

      const processingMatch = url.pathname.match(/^\/api\/ai-closet\/processing\/([^/]+)(?:\/(retry))?$/);
      if (processingMatch && request.method === "GET") return send(200, processing.get(processingMatch[1]));
      if (processingMatch && processingMatch[2] === "retry" && request.method === "POST") return send(202, await processing.retry(processingMatch[1]));
      if (processingMatch && request.method === "DELETE") return send(200, processing.purge(processingMatch[1]));

      if (request.method === "POST" && url.pathname === "/api/ai-closet/try-on") {
        const body = await readJson(request);
        assertTryOnRequest(body);
        const job = idempotentJob({ request, idempotency, operation: "try-on", assetId: body.personAssetId, now });
        jobs.set(job.jobId, { ...job, lookId: body.lookId, itemIds: body.itemIds, consentId: body.consentId, status: "queued" });
        return send(202, job);
      }

      const jobId = url.pathname.match(/^\/api\/ai-closet\/try-on\/([^/]+)(?:\/result)?$/)?.[1];
      if (jobId && request.method === "GET" && url.pathname.endsWith("/result")) {
        const job = jobs.get(jobId);
        return job ? send(409, error("result_pending", "El resultado simulado aun no esta disponible")) : send(404, error("job_not_found", "Job no encontrado"));
      }
      if (jobId && request.method === "GET") {
        const job = jobs.get(jobId);
        return job ? send(200, job) : send(404, error("job_not_found", "Job no encontrado"));
      }
      if (jobId && request.method === "DELETE") {
        if (!jobs.delete(jobId)) return send(404, error("job_not_found", "Job no encontrado"));
        return send(200, { schema: "mirrora-tryon-purge-response/v0.1", jobId, purged: true, purgedAt: new Date(now()).toISOString() });
      }
      return send(404, error("not_found", "Ruta no encontrada"));
    } catch (caught) {
      return send(caught.status || 400, error(caught.code || "invalid_request", caught.message));
    }
  });
}

function error(code, message) { return { schema: "mirrora-ai-bridge-error/v0.1", error: { code, message } }; }

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readBearerToken(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? normalizeSecret(match[1]) : "";
}

function allowRequest(requests, clientKey, current, limit, windowMs) {
  const recent = (requests.get(clientKey) || []).filter(time => current - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(current);
  requests.set(clientKey, recent);
  return true;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("JSON invalido"), { code: "invalid_json" }); }
}

function assertAssetRequest(body, { allowUpload = false } = {}) {
  if (body?.schema !== ASSET_SCHEMA || typeof body.assetId !== "string" || !body.assetId.trim()) {
    throw Object.assign(new Error("assetId y schema de asset requeridos"), { code: "invalid_asset_request" });
  }
  if (!body.upload) return;
  if (!allowUpload) throw Object.assign(new Error("Upload solo permitido para eliminacion de fondo"), { code: "upload_not_allowed" });
  const supported = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!supported.has(body.upload.contentType) || !Number.isFinite(Number(body.upload.size)) || Number(body.upload.size) > 8 * 1024 * 1024 || typeof body.upload.dataUrl !== "string" || !body.upload.dataUrl.startsWith(`data:${body.upload.contentType};base64,`)) {
    throw Object.assign(new Error("Upload de prenda invalido"), { code: "invalid_asset_upload" });
  }
}

function localUploadFixture(upload) {
  return {
    source: upload.fileName || "uploaded-garment",
    dataUrl: upload.dataUrl,
    contentType: upload.contentType,
    sourceSize: Number(upload.size),
    category: "uploads",
    garmentType: "uploaded-garment",
    material: "unknown",
    color: "unknown",
  };
}

function assertTryOnRequest(body) {
  const validItems = Array.isArray(body?.itemIds) && body.itemIds.length && body.itemIds.every(item => typeof item === "string" && item.trim());
  if (body?.schema !== TRY_ON_SCHEMA || !validItems || !body.lookId || !body.consentId || !body.personAssetId) {
    throw Object.assign(new Error("Consentimiento, persona, look y prendas validas requeridos"), { code: "invalid_try_on_request" });
  }
}

function idempotentJob({ request, idempotency, operation, assetId, now }) {
  const key = request.headers["idempotency-key"];
  if (key && idempotency.has(key)) return idempotency.get(key);
  const job = { schema: "ai-closet-job-response/v0.1", jobId: `sim-${randomUUID()}`, operation, assetId, status: "queued", simulated: true, createdAt: new Date(now()).toISOString() };
  if (key) idempotency.set(key, job);
  return job;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "0.0.0.0";
  const bridge = createBridge({
    token: process.env.MIRRORA_AI_BRIDGE_TOKEN,
    processing: createProcessingServiceFromEnv(),
  });
  bridge.listen(port, host, () => {
    const address = bridge.address();
    const activePort = typeof address === "object" && address ? address.port : port;
    console.log(`mirrora-ai-bridge listening on http://${host}:${activePort}`);
  });
}
