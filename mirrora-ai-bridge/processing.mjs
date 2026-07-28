import { randomUUID } from "node:crypto";
import { createAssetAdapter, createSimulatedAdapter, readAssetProvider } from "./providers/asset-adapters.mjs";

export const AUTHORIZED_FIXTURES = new Map([
  ["import-e3ea0305-1680-4ec7-85e0-1bbb7d58d827", {
    source: "catalog/images/import-e3ea0305-1680-4ec7-85e0-1bbb7d58d827-garment.png",
    category: "tops", garmentType: "shirt", material: "poplin", color: "white",
  }],
]);

export function createProcessingService({ adapter = createSimulatedAdapter(), authorizedFixtures = AUTHORIZED_FIXTURES, now = () => Date.now() } = {}) {
  const jobs = new Map();

  async function start(operation, assetId) {
    const fixture = authorizedFixtures.get(assetId);
    if (!fixture) throw problem("asset_not_authorized", "El asset no pertenece al set de prueba autorizado", 403);
    const job = { schema: "mirrora-processing-job/v0.1", jobId: `process-${randomUUID()}`, operation, assetId, attempts: 1, status: "running", createdAt: new Date(now()).toISOString() };
    jobs.set(job.jobId, job);
    return run(job, fixture);
  }

  async function retry(jobId) {
    const job = get(jobId);
    if (job.status !== "failed") throw problem("job_not_retryable", "Solo se reintentan jobs fallidos", 409);
    job.attempts += 1;
    job.status = "running";
    delete job.error;
    return run(job, authorizedFixtures.get(job.assetId));
  }

  function get(jobId) {
    const job = jobs.get(jobId);
    if (!job) throw problem("job_not_found", "Job de procesado no encontrado", 404);
    return job;
  }

  function purge(jobId) {
    get(jobId);
    jobs.delete(jobId);
    return { schema: "mirrora-processing-purge-response/v0.1", jobId, purged: true, purgedAt: new Date(now()).toISOString() };
  }

  async function run(job, fixture) {
    const started = now();
    try {
      const result = await adapter.process({ operation: job.operation, assetId: job.assetId, fixture });
      Object.assign(job, { status: "completed", provider: result.provider || "simulated", simulated: result.simulated === true, durationMs: now() - started, result, completedAt: new Date(now()).toISOString() });
    } catch (caught) {
      Object.assign(job, { status: "failed", durationMs: now() - started, error: { code: caught.code || "provider_failed", message: caught.message } });
    }
    return job;
  }

  return { start, retry, get, purge };
}

export function createProcessingServiceFromEnv({ env = process.env, now = () => Date.now(), fetchImpl = globalThis.fetch } = {}) {
  return createProcessingService({
    adapter: createAssetAdapter({ provider: readAssetProvider(env), env, fetchImpl }),
    now,
  });
}

function problem(code, message, status) { return Object.assign(new Error(message), { code, status }); }
