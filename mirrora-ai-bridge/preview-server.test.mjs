import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { createPreviewServer } from "./preview-server.mjs";

test("preview serves the PWA and proxies AI Closet without exposing a browser token", async () => {
  const preview = await createPreviewServer({ token: "server-only-token", root: process.cwd() });
  preview.server.listen(0, "127.0.0.1");
  await once(preview.server, "listening");
  const base = `http://127.0.0.1:${preview.server.address().port}`;
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /MIRRORA/);
    const response = await fetch(`${base}/api/ai-closet/closet?campaign=campaign-1`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { schema: "ai-closet-closet-response/v0.1", campaignId: "campaign-1", items: [] });
  } finally {
    await preview.close();
  }
});

test("preview entrypoint stays running when invoked by Node on Windows paths", async () => {
  const child = spawn(process.execPath, ["mirrora-ai-bridge/preview-server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, MIRRORA_AI_BRIDGE_TOKEN: "entrypoint-token", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const [output] = await once(child.stdout, "data");
    assert.match(output.toString(), /MIRRORA preview listening/);
    assert.equal(child.exitCode, null);
  } finally {
    child.kill();
    await once(child, "exit");
  }
});
