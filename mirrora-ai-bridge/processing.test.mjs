import assert from "node:assert/strict";
import { test } from "node:test";
import { createAssetAdapter } from "./providers/asset-adapters.mjs";
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

test("OpenAI asset adapter stays disabled until Fase 5B is explicitly approved", async () => {
  const service = createProcessingServiceFromEnv({
    env: { MIRRORA_AI_ASSET_PROVIDER: "openai", OPENAI_API_KEY: "test-key" },
    now: () => Date.UTC(2026, 6, 28),
  });
  const job = await service.start("categorize", fixtureId);
  assert.equal(job.status, "failed");
  assert.equal(job.error.code, "provider_not_enabled");
});
