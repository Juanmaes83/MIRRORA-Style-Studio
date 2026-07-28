// AI Closet gateway client.
// Regla dura: MIRRORA no llama proveedores IA directamente ni guarda fotos personales.

const BLOCKED_PROVIDER_HOSTS = [
  "api.openai.com",
  "queue.fal.run",
  "fal.run",
  "api.klingai.com",
];

export const AI_CLOSET_GATEWAY_BASE = "/api/ai-closet";

export function createAiClosetGateway({ baseUrl = AI_CLOSET_GATEWAY_BASE, fetchImpl = window.fetch.bind(window) } = {}) {
  const safeBaseUrl = normalizeGatewayBaseUrl(baseUrl);

  async function request(path, options = {}) {
    const response = await fetchImpl(`${safeBaseUrl}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
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
  const host = new URL(value, window.location.origin).host;
  if (BLOCKED_PROVIDER_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) {
    throw new Error("Usar gateway backend, no proveedor IA directo");
  }

  return value;
}

export function buildTryOnPayload({ session, lookId, itemIds, consentId, personAssetId }) {
  if (!consentId) throw new Error("consentId requerido para try-on");
  if (!personAssetId) throw new Error("personAssetId requerido para try-on");

  return {
    schema: "mirrora-tryon-request/v0.1",
    brandId: session?.brandId || null,
    campaignId: session?.campaignId || null,
    lookId: lookId || null,
    itemIds: Array.isArray(itemIds) ? itemIds : [],
    consentId,
    personAssetId
  };
}

