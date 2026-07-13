// Funnel: seleccion → qr_generado → sesion_iniciada → look_guardado → carrito_click → compra.
// Cada evento lleva brand/campaign/look/source para que la campaña sea medible de punta a punta.
// ENDPOINT null = solo registro local; en Fase 6 se apunta al backend de eventos.

import { state, save } from "./store.js";
import { BRAND } from "./data/brand.js";

const ENDPOINT = null; // p.ej. "https://api.mirrora.app/v1/events"

export function track(name, data = {}) {
  const event = {
    name,
    ts: new Date().toISOString(),
    deviceId: state.deviceId,
    brandId: state.session?.brandId || BRAND.brandId,
    campaignId: state.session?.campaignId || BRAND.campaignId,
    source: state.session?.source || "pwa",
    ...data
  };
  state.events.push(event);
  if (state.events.length > 500) state.events.splice(0, state.events.length - 500);
  save();
  console.info("[mirrora:event]", event.name, event);

  if (ENDPOINT) {
    try {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(event));
    } catch { /* best-effort */ }
  }
  return event;
}
