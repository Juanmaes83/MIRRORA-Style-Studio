// Handoff QR — schema mirrora-handoff/v0.1.
// Regla dura: el payload transporta identidad de campaña/look, NUNCA datos personales ni faciales.

import { BRAND } from "./data/brand.js";
import { state, save } from "./store.js";
import { track } from "./analytics.js";

export function buildHandoffURL(look) {
  const url = new URL(window.location.href.split("?")[0]);
  url.searchParams.set("schema", "mirrora-handoff/v0.1");
  url.searchParams.set("brand", BRAND.brandId);
  url.searchParams.set("campaign", BRAND.campaignId);
  url.searchParams.set("look", look.id);
  url.searchParams.set("source", "pwa");
  return url.toString();
}

// El QR se genera con la librería vendorizada (js/lib/qrcode.js, MIT, global `qrcode`).
export function renderQR(container, text) {
  const qr = window.qrcode(0, "M"); // typeNumber auto, corrección M
  qr.addData(text);
  qr.make();
  container.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 8, scalable: true });
}

// Intake: si la PWA se abre desde un QR de escaparate/Gesture Lab, arranca la sesión de campaña.
export function readIncomingHandoff() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("schema")?.startsWith("mirrora-handoff/")) return null;

  const session = {
    brandId: params.get("brand") || BRAND.brandId,
    campaignId: params.get("campaign") || BRAND.campaignId,
    lookId: params.get("look") || null,
    source: params.get("source") || "qr",
    startedAt: new Date().toISOString()
  };
  state.session = session;
  save();
  track("sesion_iniciada", { lookId: session.lookId });

  // Limpiar la URL para no re-disparar la sesión al recargar
  history.replaceState(null, "", window.location.pathname);
  return session;
}
