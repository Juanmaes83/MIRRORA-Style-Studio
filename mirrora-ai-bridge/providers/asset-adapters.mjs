import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const SUPPORTED_PROVIDERS = new Set(["simulated", "openai"]);

export function createAssetAdapter({ provider = "simulated", env = process.env, fetchImpl = globalThis.fetch, readFileImpl = readFile, rootDir = process.cwd() } = {}) {
  const selected = normalizeProvider(provider);
  if (!SUPPORTED_PROVIDERS.has(selected)) {
    throw problem("provider_not_supported", `Proveedor de assets no soportado: ${selected}`, 400);
  }
  if (selected === "simulated") return createSimulatedAdapter();
  return createOpenAiAssetAdapter({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || "gpt-5-mini",
    fetchImpl,
    readFileImpl,
    rootDir,
  });
}

export function readAssetProvider(env = process.env) {
  return normalizeProvider(env.MIRRORA_AI_ASSET_PROVIDER || "simulated");
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
        alphaPreserved: true,
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

function normalizeSecret(value) {
  return typeof value === "string" ? value.trim() : "";
}
