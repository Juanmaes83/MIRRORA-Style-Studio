import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createBridge } from "./server.mjs";

async function withBridge(run, options = {}) {
  const server = createBridge({ token: "test-token", now: () => Date.UTC(2026, 6, 28), ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { server.close(); await once(server, "close"); }
}

const auth = { authorization: "Bearer test-token", "x-client-id": "test-client" };
const asset = { schema: "ai-closet-asset-request/v0.1", assetId: "asset-1" };

test("healthcheck is public and declares the simulated bridge", async () => {
  await withBridge(async base => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { schema: "mirrora-ai-bridge-health/v0.1", status: "ok", providers: "simulated" });
  });
});

test("bridge requires authentication and validates versioned asset requests", async () => {
  await withBridge(async base => {
    assert.equal((await fetch(`${base}/api/ai-closet/categorize`, { method: "POST" })).status, 401);
    const invalid = await fetch(`${base}/api/ai-closet/categorize`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ assetId: "asset-1" }) });
    assert.equal(invalid.status, 400);
    const valid = await fetch(`${base}/api/ai-closet/categorize`, { method: "POST", headers: { ...auth, "content-type": "application/json", "idempotency-key": "same-request" }, body: JSON.stringify(asset) });
    assert.equal(valid.status, 202);
    const repeated = await fetch(`${base}/api/ai-closet/categorize`, { method: "POST", headers: { ...auth, "content-type": "application/json", "idempotency-key": "same-request" }, body: JSON.stringify(asset) });
    assert.equal((await valid.json()).jobId, (await repeated.json()).jobId);
  });
});

test("try-on simulation requires consent and supports status and purge", async () => {
  await withBridge(async base => {
    const body = { schema: "mirrora-tryon-request/v0.1", lookId: "look-1", itemIds: ["garment-1"], consentId: "consent-1", personAssetId: "person-1" };
    const submitted = await fetch(`${base}/api/ai-closet/try-on`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(submitted.status, 202);
    const job = await submitted.json();
    assert.equal(job.simulated, true);
    assert.equal((await fetch(`${base}/api/ai-closet/try-on/${job.jobId}`, { headers: auth })).status, 200);
    const purge = await fetch(`${base}/api/ai-closet/try-on/${job.jobId}`, { method: "DELETE", headers: auth });
    assert.deepEqual((await purge.json()).purged, true);
    assert.equal((await fetch(`${base}/api/ai-closet/try-on/${job.jobId}`, { headers: auth })).status, 404);
  });
});

test("rate limiting rejects excess authenticated requests", async () => {
  await withBridge(async base => {
    assert.equal((await fetch(`${base}/api/ai-closet/closet`, { headers: auth })).status, 200);
    assert.equal((await fetch(`${base}/api/ai-closet/closet`, { headers: auth })).status, 429);
  }, { requestLimit: 1 });
});
