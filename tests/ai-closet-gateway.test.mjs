import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_CLOSET_GATEWAY_CONTRACT_VERSION,
  buildAssetPayload,
  buildTryOnPayload,
  createAiClosetGateway,
  normalizeGatewayBaseUrl,
} from "../js/ai-closet-gateway.js";

test("declares the shared gateway contract version and rejects provider hosts", () => {
  assert.equal(AI_CLOSET_GATEWAY_CONTRACT_VERSION, "ai-closet-gateway/v0.1");
  assert.equal(normalizeGatewayBaseUrl("/api/ai-closet"), "/api/ai-closet");
  assert.throws(() => normalizeGatewayBaseUrl("https://api.openai.com/v1"), /gateway backend/);
  assert.throws(() => normalizeGatewayBaseUrl("https://queue.fal.run/model"), /gateway backend/);
});

test("builds only versioned and complete AI Closet request payloads", () => {
  assert.deepEqual(buildAssetPayload("asset-1"), {
    schema: "ai-closet-asset-request/v0.1",
    assetId: "asset-1",
  });
  assert.deepEqual(buildAssetPayload("asset-1", {
    upload: { fileName: "shirt.png", contentType: "image/png", size: 123, dataUrl: "data:image/png;base64,AAAA" },
  }), {
    schema: "ai-closet-asset-request/v0.1",
    assetId: "asset-1",
    upload: { fileName: "shirt.png", contentType: "image/png", size: 123, dataUrl: "data:image/png;base64,AAAA" },
  });
  assert.deepEqual(buildTryOnPayload({
    session: { brandId: "brand-1", campaignId: "campaign-1" },
    lookId: "look-1",
    itemIds: ["garment-1"],
    consentId: "consent-1",
    personAssetId: "person-asset-1",
  }), {
    schema: "mirrora-tryon-request/v0.1",
    brandId: "brand-1",
    campaignId: "campaign-1",
    lookId: "look-1",
    itemIds: ["garment-1"],
    consentId: "consent-1",
    personAssetId: "person-asset-1",
  });
  assert.throws(() => buildTryOnPayload({ lookId: "", itemIds: ["garment-1"], consentId: "c", personAssetId: "p" }), /lookId/);
  assert.throws(() => buildTryOnPayload({ lookId: "look-1", itemIds: [], consentId: "c", personAssetId: "p" }), /itemIds/);
  assert.throws(() => buildTryOnPayload({ lookId: "look-1", itemIds: ["garment-1", "garment-1"], consentId: "c", personAssetId: "p" }), /duplicados/);
});

test("uses the documented gateway paths and idempotency header", async () => {
  const calls = [];
  const gateway = createAiClosetGateway({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ schema: "ai-closet-job-response/v0.1" }) };
    },
  });

  await gateway.categorize(buildAssetPayload("asset-1"), "request-1");
  await gateway.removeBackground(buildAssetPayload("asset-1"), "request-2");

  assert.equal(calls[0].url, "/api/ai-closet/categorize");
  assert.equal(calls[0].options.headers["idempotency-key"], "request-1");
  assert.equal(calls[1].url, "/api/ai-closet/remove-background");
  assert.equal(calls[1].options.headers["idempotency-key"], "request-2");
});
