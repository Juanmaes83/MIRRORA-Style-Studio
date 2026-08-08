// AI Closet gateway client.
// Regla dura: MIRRORA no llama proveedores IA directamente ni guarda fotos personales.

const BLOCKED_PROVIDER_HOSTS = [
  "api.openai.com",
  "queue.fal.run",
  "fal.run",
  "api.klingai.com",
];

export const AI_CLOSET_GATEWAY_BASE = "/api/ai-closet";
export const AI_CLOSET_GATEWAY_CONTRACT_VERSION = "ai-closet-gateway/v0.1";

export function createAiClosetGateway({ baseUrl = AI_CLOSET_GATEWAY_BASE, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const safeBaseUrl = normalizeGatewayBaseUrl(baseUrl);
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl requerido");

  async function request(path, options = {}) {
    const { idempotencyKey, ...requestOptions } = options;
    const response = await fetchImpl(`${safeBaseUrl}${path}`, {
      ...requestOptions,
      headers: {
        "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`AI Closet gateway error ${response.status}`);
    }

    return response.json();
  }

  return {
    loadCloset: campaignId => request(`/closet?campaign=${encodeURIComponent(campaignId)}`),
    categorize: (body, idempotencyKey) => request("/categorize", { method: "POST", body, idempotencyKey }),
    removeBackground: (body, idempotencyKey) => request("/remove-background", { method: "POST", body, idempotencyKey }),
    submitTryOn: body => request("/try-on", { method: "POST", body }),
    getTryOnStatus: jobId => request(`/try-on/${encodeURIComponent(jobId)}`, { method: "GET" }),
    getTryOnResult: jobId => request(`/try-on/${encodeURIComponent(jobId)}/result`, { method: "GET" }),
    purgeTryOn: jobId => request(`/try-on/${encodeURIComponent(jobId)}`, { method: "DELETE" })
  };
}

export function normalizeGatewayBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new Error("baseUrl requerido");
  }

  const value = baseUrl.trim().replace(/\/+$/, "");
  const origin = globalThis.location?.origin || "http://localhost";
  const host = new URL(value, origin).host;
  if (BLOCKED_PROVIDER_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) {
    throw new Error("Usar gateway backend, no proveedor IA directo");
  }

  return value;
}

export function buildAssetPayload(assetId, options = {}) {
  if (typeof assetId !== "string" || !assetId.trim()) throw new Error("assetId requerido");
  const payload = {
    schema: "ai-closet-asset-request/v0.1",
    assetId: assetId.trim()
  };
  if (options.upload) {
    payload.upload = {
      fileName: String(options.upload.fileName || "garment").trim(),
      contentType: String(options.upload.contentType || "").trim(),
      size: Number(options.upload.size),
      dataUrl: String(options.upload.dataUrl || "")
    };
  }
  return payload;
}

export function buildTryOnPayload({ session, lookId, itemIds, consentId, personAssetId }) {
  if (typeof lookId !== "string" || !lookId.trim()) throw new Error("lookId requerido para try-on");
  if (!Array.isArray(itemIds) || !itemIds.length || itemIds.some(itemId => typeof itemId !== "string" || !itemId.trim())) {
    throw new Error("itemIds requiere al menos una prenda valida");
  }
  if (new Set(itemIds).size !== itemIds.length) throw new Error("itemIds no puede contener duplicados");
  if (!consentId) throw new Error("consentId requerido para try-on");
  if (!personAssetId) throw new Error("personAssetId requerido para try-on");

  return {
    schema: "mirrora-tryon-request/v0.1",
    brandId: session?.brandId || null,
    campaignId: session?.campaignId || null,
    lookId: lookId.trim(),
    itemIds: itemIds.map(itemId => itemId.trim()),
    consentId,
    personAssetId
  };
}
