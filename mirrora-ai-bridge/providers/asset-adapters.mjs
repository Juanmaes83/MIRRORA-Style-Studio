import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const SUPPORTED_ASSET_PROVIDERS = new Set(["simulated", "openai"]);
const SUPPORTED_BACKGROUND_PROVIDERS = new Set(["simulated", "rembg"]);

export function createAssetAdapter({
  provider,
  assetProvider,
  backgroundProvider = "simulated",
  env = process.env,
  fetchImpl = globalThis.fetch,
  readFileImpl = readFile,
  rootDir = process.cwd(),
} = {}) {
  const selectedAssetProvider = normalizeProvider(assetProvider || provider || "simulated");
  const selectedBackgroundProvider = normalizeProvider(backgroundProvider || "simulated");
  if (!SUPPORTED_ASSET_PROVIDERS.has(selectedAssetProvider)) {
    throw problem("provider_not_supported", `Proveedor de assets no soportado: ${selectedAssetProvider}`, 400);
  }
  if (!SUPPORTED_BACKGROUND_PROVIDERS.has(selectedBackgroundProvider)) {
    throw problem("provider_not_supported", `Proveedor de fondo no soportado: ${selectedBackgroundProvider}`, 400);
  }
  const categorizationAdapter = selectedAssetProvider === "openai" ? createOpenAiAssetAdapter({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || "gpt-5-mini",
    fetchImpl,
    readFileImpl,
    rootDir,
  }) : createSimulatedAdapter();
  const backgroundAdapter = selectedBackgroundProvider === "rembg" ? createRembgBackgroundAdapter({
    origin: env.MIRRORA_REMBG_ORIGIN,
    token: env.MIRRORA_REMBG_TOKEN,
    timeoutMs: env.MIRRORA_REMBG_TIMEOUT_MS,
    fetchImpl,
  }) : createSimulatedAdapter();

  return {
    async process(request) {
      if (request.operation === "remove-background") return backgroundAdapter.process(request);
      return categorizationAdapter.process(request);
    },
  };
}

export function readAssetProvider(env = process.env) {
  return normalizeProvider(env.MIRRORA_AI_ASSET_PROVIDER || "simulated");
}

export function createRembgBackgroundAdapter({
  origin,
  token,
  timeoutMs = 20_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = normalizeOrigin(origin);
  const bridgeToken = normalizeSecret(token);
  const timeout = normalizeTimeout(timeoutMs);
  if (!endpoint || !bridgeToken) {
    return {
      async process() {
        throw problem("provider_not_configured", "MIRRORA_REMBG_ORIGIN y MIRRORA_REMBG_TOKEN requeridos para MIRRORA_AI_BACKGROUND_PROVIDER=rembg", 503);
      },
    };
  }
  if (typeof fetchImpl !== "function") throw problem("provider_not_configured", "fetch requerido para rembg", 503);

  return {
    async process({ operation, assetId, fixture }) {
      if (operation !== "remove-background") {
        throw problem("unsupported_operation", "rembg solo esta habilitado para eliminacion de fondo en Fase 5C", 400);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetchImpl(`${endpoint}/remove-background`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${bridgeToken}`,
            "content-type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            schema: "mirrora-background-removal-request/v0.1",
            assetId,
            source: fixture.source,
            dataUrl: fixture.dataUrl,
            sourceSize: fixture.sourceSize,
            expectedContentType: fixture.contentType || mimeForPath(fixture.source || ""),
          }),
        });
        const payload = await readJsonResponse(response, "rembg");
        return normalizeRembgResult(payload, assetId);
      } catch (caught) {
        if (caught?.name === "AbortError") throw problem("provider_timeout", "rembg supero el timeout configurado", 504);
        throw caught;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function normalizeRembgResult(payload, assetId) {
  if (payload?.schema !== "mirrora-background-removal-result/v0.1") {
    throw problem("provider_bad_response", "rembg devolvio un schema inesperado", 502);
  }
  if (!payload.alphaPreserved || !payload.cropped || typeof payload.processedAssetId !== "string") {
    throw problem("provider_bad_response", "rembg no devolvio un PNG transparente recortado valido", 502);
  }
  const imageDataUrl = normalizePngDataUrl(payload.imageDataUrl);
  return {
    schema: "mirrora-background-removal-result/v0.1",
    provider: "rembg",
    model: normalizeMetadataValue(payload.model || "u2net_cloth_seg"),
    simulated: false,
    assetId,
    processedAssetId: payload.processedAssetId,
    imageDataUrl,
    alphaPreserved: true,
    cropped: true,
    outputBytes: Number.isFinite(Number(payload.outputBytes)) ? Number(payload.outputBytes) : 0,
    durationMs: Number.isFinite(Number(payload.durationMs)) ? Number(payload.durationMs) : 0,
  };
}

async function readJsonResponse(response, providerName) {
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; }
  catch { throw problem("provider_bad_response", `${providerName} devolvio JSON invalido`, 502); }
  if (!response.ok) {
    const message = payload?.error?.message || `${providerName} respondio ${response.status}`;
    throw problem(payload?.error?.code || "provider_failed", message, response.status);
  }
  return payload;
}

function normalizeOrigin(value) {
  const origin = normalizeSecret(value);
  return origin ? origin.replace(/\/+$/, "") : "";
}

function normalizeTimeout(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 20_000;
  return Math.min(Math.max(numeric, 1_000), 120_000);
}

export function createLegacyProviderAdapter({ provider = "simulated", env = process.env, fetchImpl = globalThis.fetch, readFileImpl = readFile, rootDir = process.cwd() } = {}) {
  return createAssetAdapter({
    assetProvider: provider,
    backgroundProvider: provider === "rembg" ? "rembg" : "simulated",
    env,
    fetchImpl,
    readFileImpl,
    rootDir,
  });
}

export function createOpenAiAssetAdapter({ apiKey, model = "gpt-5-mini", fetchImpl = globalThis.fetch, readFileImpl = readFile, rootDir = process.cwd() } = {}) {
  const token = normalizeSecret(apiKey);
  if (!token) {
    return {
      async process() {
        throw problem("provider_not_configured", "OPENAI_API_KEY requerido para MIRRORA_AI_ASSET_PROVIDER=openai", 503);
      },
    };
  }
  if (typeof fetchImpl !== "function") throw problem("provider_not_configured", "fetch requerido para OpenAI", 503);

  return {
    async process({ operation, assetId, fixture }) {
      if (operation !== "categorize") {
        throw problem("provider_not_enabled", "OpenAI solo esta habilitado para categorizacion en Fase 5B", 503);
      }
      const started = Date.now();
      const imageUrl = await fixtureToDataUrl(fixture, { readFileImpl, rootDir });
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [{
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Categoriza esta prenda de catalogo para MIRRORA. Devuelve solo JSON valido con category, garmentType, material, color y confidence entre 0 y 1.",
              },
              { type: "input_image", image_url: imageUrl },
            ],
          }],
          text: {
            format: {
              type: "json_schema",
              name: "mirrora_garment_metadata",
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["category", "garmentType", "material", "color", "confidence"],
                properties: {
                  category: { type: "string" },
                  garmentType: { type: "string" },
                  material: { type: "string" },
                  color: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
              },
              strict: true,
            },
          },
        }),
      });
      const payload = await readOpenAiPayload(response);
      const metadata = extractJsonPayload(payload);
      return {
        schema: "mirrora-garment-metadata/v0.1",
        provider: "openai",
        model,
        simulated: false,
        assetId,
        category: normalizeMetadataValue(metadata.category),
        garmentType: normalizeMetadataValue(metadata.garmentType),
        material: normalizeMetadataValue(metadata.material),
        color: normalizeMetadataValue(metadata.color),
        confidence: normalizeConfidence(metadata.confidence),
        durationMs: Date.now() - started,
      };
    },
  };
}

function normalizeProvider(value) {
  return String(value || "simulated").trim().toLowerCase();
}

export function createSimulatedAdapter() {
  return {
    async process({ operation, assetId, fixture }) {
      if (operation === "categorize") return {
        schema: "mirrora-garment-metadata/v0.1",
        simulated: true,
        assetId,
        category: fixture.category,
        garmentType: fixture.garmentType,
        material: fixture.material,
        color: fixture.color,
        confidence: 1,
      };
      if (operation === "remove-background") return {
        schema: "mirrora-background-removal-result/v0.1",
        simulated: true,
        assetId,
        processedAssetId: `${assetId}:transparent`,
        source: fixture.source,
        imageDataUrl: fixture.dataUrl || null,
        alphaPreserved: !fixture.dataUrl,
        cropped: !fixture.dataUrl,
      };
      throw problem("unsupported_operation", "Operacion de procesado no soportada", 400);
    },
  };
}

function problem(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

async function fixtureToDataUrl(fixture, { readFileImpl, rootDir }) {
  if (fixture.imageUrl) return fixture.imageUrl;
  if (!fixture.source) throw problem("asset_source_missing", "El fixture autorizado no tiene imagen fuente", 400);
  const absolutePath = resolve(rootDir, fixture.source);
  const data = await readFileImpl(absolutePath);
  return `data:${mimeForPath(absolutePath)};base64,${Buffer.from(data).toString("base64")}`;
}

function mimeForPath(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

async function readOpenAiPayload(response) {
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; }
  catch { throw problem("provider_bad_response", "OpenAI devolvio JSON invalido", 502); }
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI respondio ${response.status}`;
    throw problem(payload?.error?.code || "provider_failed", message, response.status);
  }
  return payload;
}

function extractJsonPayload(payload) {
  const text = payload.output_text || payload.output?.flatMap(item => item.content || [])
    .find(content => content.type === "output_text" && typeof content.text === "string")?.text;
  if (!text) throw problem("provider_bad_response", "OpenAI no devolvio texto estructurado", 502);
  try { return JSON.parse(text); }
  catch { throw problem("provider_bad_response", "OpenAI no devolvio metadata JSON valida", 502); }
}

function normalizeMetadataValue(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "unknown";
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizePngDataUrl(value) {
  if (typeof value !== "string" || !value) return null;
  if (!value.startsWith("data:image/png;base64,")) {
    throw problem("provider_bad_response", "rembg no devolvio imageDataUrl PNG valido", 502);
  }
  return value;
}

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}
