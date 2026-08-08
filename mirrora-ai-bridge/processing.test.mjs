import assert from "node:assert/strict";
import { test } from "node:test";
import { createAssetAdapter, createOpenAiAssetAdapter, createRembgBackgroundAdapter } from "./providers/asset-adapters.mjs";
import { AUTHORIZED_FIXTURES, createProcessingService, createProcessingServiceFromEnv } from "./processing.mjs";

const fixtureId = "import-e3ea0305-1680-4ec7-85e0-1bbb7d58d827";

test("processing fixture returns deterministic catalog metadata and transparent asset result", async () => {
  const service = createProcessingService({ now: () => Date.UTC(2026, 6, 28) });
  const categorized = await service.start("categorize", fixtureId);
  assert.equal(categorized.result.garmentType, "shirt");
  const background = await service.start("remove-background", fixtureId);
  assert.equal(background.result.processedAssetId, `${fixtureId}:transparent`);
  assert.equal(AUTHORIZED_FIXTURES.size, 1);
});

test("failed provider jobs retain state and can be retried", async () => {
  let calls = 0;
  const service = createProcessingService({ adapter: { async process() { calls += 1; if (calls === 1) throw new Error("temporal"); return { simulated: true, recovered: true }; } } });
  const failed = await service.start("categorize", fixtureId);
  assert.equal(failed.status, "failed");
  const recovered = await service.retry(failed.jobId);
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.attempts, 2);
  assert.deepEqual(service.purge(failed.jobId).purged, true);
});

test("asset provider selection defaults to simulated and rejects unknown providers", async () => {
  const service = createProcessingServiceFromEnv({ env: {}, now: () => Date.UTC(2026, 6, 28) });
  const categorized = await service.start("categorize", fixtureId);
  assert.equal(categorized.status, "completed");
  assert.equal(categorized.simulated, true);
  assert.throws(() => createAssetAdapter({ provider: "direct-browser-key" }), /Proveedor de assets no soportado/);
});

test("OpenAI asset adapter categorizes authorized fixtures through Responses API", async () => {
  const calls = [];
  const adapter = createOpenAiAssetAdapter({
    apiKey: "test-key",
    model: "gpt-test",
    readFileImpl: async () => Buffer.from("fake-png"),
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          category: "Tops",
          garmentType: "Shirt",
          material: "Poplin",
          color: "White",
          confidence: 0.91,
        }),
      }), { status: 200 });
    },
  });
  const result = await adapter.process({ operation: "categorize", assetId: fixtureId, fixture: AUTHORIZED_FIXTURES.get(fixtureId) });
  assert.equal(result.provider, "openai");
  assert.equal(result.model, "gpt-test");
  assert.equal(result.category, "tops");
  assert.equal(result.garmentType, "shirt");
  assert.equal(result.confidence, 0.91);
  assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
  assert.equal(calls[0].options.headers.authorization, "Bearer test-key");
  assert.equal(calls[0].body.input[0].content[1].type, "input_image");
  assert.match(calls[0].body.input[0].content[1].image_url, /^data:image\/png;base64,/);
});

test("OpenAI asset adapter reports missing keys and blocks background removal in Fase 5B", async () => {
  await assert.rejects(
    () => createOpenAiAssetAdapter({ apiKey: "" }).process({ operation: "categorize", assetId: fixtureId, fixture: AUTHORIZED_FIXTURES.get(fixtureId) }),
    /OPENAI_API_KEY requerido/,
  );
  await assert.rejects(
    () => createOpenAiAssetAdapter({ apiKey: "test-key", fetchImpl: async () => Response.json({}) }).process({ operation: "remove-background", assetId: fixtureId, fixture: AUTHORIZED_FIXTURES.get(fixtureId) }),
    /solo esta habilitado para categorizacion/,
  );
});

test("OpenAI provider is available from environment for Fase 5B categorization", async () => {
  const service = createProcessingServiceFromEnv({
    env: { MIRRORA_AI_ASSET_PROVIDER: "openai", OPENAI_API_KEY: "test-key" },
    fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify({ category: "tops", garmentType: "shirt", material: "poplin", color: "white", confidence: 0.9 }) }), { status: 200 }),
    now: () => Date.UTC(2026, 6, 28),
  });
  const job = await service.start("categorize", fixtureId);
  assert.equal(job.status, "completed");
  assert.equal(job.provider, "openai");
});

test("rembg background adapter calls only the isolated service for Fase 5C", async () => {
  const calls = [];
  const adapter = createRembgBackgroundAdapter({
    origin: " https://rembg.internal/ ",
    token: " rembg-token ",
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({
        schema: "mirrora-background-removal-result/v0.1",
        provider: "rembg",
        model: "u2net_cloth_seg",
        processedAssetId: `${fixtureId}:transparent`,
        alphaPreserved: true,
        cropped: true,
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
        outputBytes: 8,
        durationMs: 88,
      }), { status: 200 });
    },
  });
  const result = await adapter.process({ operation: "remove-background", assetId: fixtureId, fixture: AUTHORIZED_FIXTURES.get(fixtureId) });
  assert.equal(result.provider, "rembg");
  assert.equal(result.simulated, false);
  assert.equal(result.processedAssetId, `${fixtureId}:transparent`);
  assert.equal(result.cropped, true);
  assert.equal(result.imageDataUrl, "data:image/png;base64,ZmFrZS1wbmc=");
  assert.equal(result.outputBytes, 8);
  assert.equal(calls[0].url, "https://rembg.internal/remove-background");
  assert.equal(calls[0].options.headers.authorization, "Bearer rembg-token");
  assert.equal(calls[0].body.schema, "mirrora-background-removal-request/v0.1");
  assert.equal(calls[0].body.source, AUTHORIZED_FIXTURES.get(fixtureId).source);
});

test("background provider selection does not affect OpenAI categorization", async () => {
  const calls = [];
  const service = createProcessingServiceFromEnv({
    env: {
      MIRRORA_AI_ASSET_PROVIDER: "openai",
      MIRRORA_AI_BACKGROUND_PROVIDER: "rembg",
      OPENAI_API_KEY: "test-key",
      MIRRORA_REMBG_ORIGIN: "https://rembg.internal",
      MIRRORA_REMBG_TOKEN: "rembg-token",
    },
    fetchImpl: async (url, options) => {
      calls.push(url);
      if (url.includes("openai.com")) {
        return new Response(JSON.stringify({ output_text: JSON.stringify({ category: "tops", garmentType: "shirt", material: "poplin", color: "white", confidence: 0.9 }) }), { status: 200 });
      }
      return new Response(JSON.stringify({
        schema: "mirrora-background-removal-result/v0.1",
        processedAssetId: `${fixtureId}:transparent`,
        alphaPreserved: true,
        cropped: true,
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
        outputBytes: 8,
        durationMs: 90,
      }), { status: 200 });
    },
    now: () => Date.UTC(2026, 6, 28),
  });
  const categorized = await service.start("categorize", fixtureId);
  const background = await service.start("remove-background", fixtureId);
  assert.equal(categorized.provider, "openai");
  assert.equal(background.provider, "rembg");
  assert.equal(calls[0], "https://api.openai.com/v1/responses");
  assert.equal(calls[1], "https://rembg.internal/remove-background");
});

test("rembg provider fails closed when service credentials are missing", async () => {
  const service = createProcessingServiceFromEnv({
    env: { MIRRORA_AI_BACKGROUND_PROVIDER: "rembg" },
    now: () => Date.UTC(2026, 6, 28),
  });
  const job = await service.start("remove-background", fixtureId);
  assert.equal(job.status, "failed");
  assert.equal(job.error.code, "provider_not_configured");
});
