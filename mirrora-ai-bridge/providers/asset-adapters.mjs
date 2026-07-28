const SUPPORTED_PROVIDERS = new Set(["simulated", "openai"]);

export function createAssetAdapter({ provider = "simulated", env = process.env } = {}) {
  const selected = normalizeProvider(provider);
  if (!SUPPORTED_PROVIDERS.has(selected)) {
    throw problem("provider_not_supported", `Proveedor de assets no soportado: ${selected}`, 400);
  }
  if (selected === "simulated") return createSimulatedAdapter();
  return createUnavailableOpenAiAdapter({ apiKey: env.OPENAI_API_KEY });
}

export function readAssetProvider(env = process.env) {
  return normalizeProvider(env.MIRRORA_AI_ASSET_PROVIDER || "simulated");
}

function normalizeProvider(value) {
  return String(value || "simulated").trim().toLowerCase();
}

function createUnavailableOpenAiAdapter({ apiKey }) {
  return {
    async process() {
      if (!apiKey || !String(apiKey).trim()) {
        throw problem("provider_not_configured", "OPENAI_API_KEY requerido para MIRRORA_AI_ASSET_PROVIDER=openai", 503);
      }
      throw problem("provider_not_enabled", "Adaptador OpenAI real pendiente de aprobacion de Fase 5B", 503);
    },
  };
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
