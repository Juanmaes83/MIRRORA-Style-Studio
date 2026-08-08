import assert from "node:assert/strict";
import { test } from "node:test";
import { createAiClosetProxy } from "./[...path].mjs";

test("Vercel proxy sends the bridge token server-side and preserves the relative API path", async () => {
  const calls = [];
  const proxy = createAiClosetProxy({
    bridgeOrigin: "https://bridge-staging.example",
    bridgeToken: "server-only-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ ok: true }, { status: 202, headers: { "set-cookie": "blocked", "x-upstream": "bridge" } });
    },
  });
  const response = await proxy.fetch(new Request("https://mirrora.example/api/ai-closet/categorize?campaign=one", {
    method: "POST",
    headers: { authorization: "Bearer browser-token", "content-type": "application/json", "idempotency-key": "request-1" },
    body: JSON.stringify({ assetId: "fixture" }),
  }));
  assert.equal(calls[0].url, "https://bridge-staging.example/api/ai-closet/categorize?campaign=one");
  assert.equal(calls[0].options.headers.get("authorization"), "Bearer server-only-token");
  assert.equal(calls[0].options.headers.get("idempotency-key"), "request-1");
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Vercel proxy trims accidental whitespace around the server token", async () => {
  const calls = [];
  const proxy = createAiClosetProxy({
    bridgeOrigin: "https://bridge-staging.example",
    bridgeToken: "  server-only-token  ",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ ok: true });
    },
  });
  await proxy.fetch(new Request("https://mirrora.example/api/ai-closet/closet"));
  assert.equal(calls[0].options.headers.get("authorization"), "Bearer server-only-token");
});

test("Vercel proxy rejects methods and origins that are outside the bridge contract", async () => {
  const proxy = createAiClosetProxy({ bridgeOrigin: "https://bridge-staging.example", bridgeToken: "token", fetchImpl: async () => Response.json({}) });
  assert.equal((await proxy.fetch(new Request("https://mirrora.example/api/ai-closet/closet", { method: "PUT" }))).status, 405);
  assert.throws(() => createAiClosetProxy({ bridgeOrigin: "http://bridge.example", bridgeToken: "token" }), /HTTPS/);
});
