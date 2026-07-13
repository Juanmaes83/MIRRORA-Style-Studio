// Consola de marca — configura la experiencia white-label y emite el handoff de campaña.
// Escribe el override en localStorage (mismo origen que la PWA); la vista previa se recarga al aplicar.

import { BRAND_DEFAULTS, loadBrandOverride, saveBrandOverride, clearBrandOverride } from "./data/brand.js";
import { PRODUCTS } from "./data/catalog.js";

const $ = sel => document.querySelector(sel);

let cfg = {
  ...BRAND_DEFAULTS,
  ...(loadBrandOverride() || {}),
  theme: { ...BRAND_DEFAULTS.theme, ...((loadBrandOverride() || {}).theme || {}) }
};

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

/* ---------------- Form ---------------- */

function fillForm() {
  $("#f-name").value = cfg.name;
  $("#f-brandId").value = cfg.brandId;
  $("#f-campaignId").value = cfg.campaignId;
  $("#f-ink").value = cfg.theme.ink;
  $("#f-brass").value = cfg.theme.brass;
  $("#f-ivory").value = cfg.theme.ivory;
  $("#f-reward").value = cfg.reward;
  $("#f-cart").value = cfg.cartUrlTemplate;
  $("#f-retention").value = cfg.retentionDays;
  renderCatalogToggle();
}

function renderCatalogToggle() {
  const enabled = cfg.enabledProducts; // null = todos
  $("#catalog-toggle").innerHTML = PRODUCTS.map(p => {
    const on = !enabled || enabled.includes(p.id);
    return `<label class="toggle-item ${on ? "" : "is-off"}">
      <input type="checkbox" data-prod="${p.id}" ${on ? "checked" : ""} /> ${p.name}
    </label>`;
  }).join("");
}

$("#catalog-toggle").addEventListener("change", () => {
  const boxes = [...document.querySelectorAll("[data-prod]")];
  const on = boxes.filter(b => b.checked).map(b => b.dataset.prod);
  cfg.enabledProducts = on.length === PRODUCTS.length ? null : on;
  renderCatalogToggle();
});

function readForm() {
  cfg.name = $("#f-name").value.trim() || BRAND_DEFAULTS.name;
  cfg.brandId = ($("#f-brandId").value.trim() || BRAND_DEFAULTS.brandId).toLowerCase();
  cfg.campaignId = ($("#f-campaignId").value.trim() || BRAND_DEFAULTS.campaignId).toLowerCase();
  cfg.theme = { ink: $("#f-ink").value, brass: $("#f-brass").value, ivory: $("#f-ivory").value };
  cfg.reward = $("#f-reward").value.trim();
  cfg.cartUrlTemplate = $("#f-cart").value.trim() || BRAND_DEFAULTS.cartUrlTemplate;
  cfg.retentionDays = Math.max(1, parseInt($("#f-retention").value, 10) || BRAND_DEFAULTS.retentionDays);
}

/* ---------------- Handoff QR ---------------- */

function handoffURL() {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("schema", "mirrora-handoff/v0.1");
  url.searchParams.set("brand", cfg.brandId);
  url.searchParams.set("campaign", cfg.campaignId);
  url.searchParams.set("source", "escaparate");
  return url.toString();
}

function renderCampaignQR() {
  const text = handoffURL();
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  $("#campaign-qr").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 8, scalable: true });
  $("#handoff-url").value = text;
}

$("#btn-copy-url").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#handoff-url").value);
  toast("URL de handoff copiada");
});

$("#btn-download-qr").addEventListener("click", () => {
  const svg = $("#campaign-qr").innerHTML;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mirrora-qr-${cfg.brandId}-${cfg.campaignId}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------------- Aplicar / exportar / importar ---------------- */

function apply() {
  readForm();
  saveBrandOverride(cfg);
  renderCampaignQR();
  $("#preview-frame").contentWindow.location.reload();
  $("#preview-note").textContent = `aplicado ${new Date().toLocaleTimeString("es-ES")}`;
  toast("Configuración aplicada a la experiencia");
}

$("#btn-apply").addEventListener("click", apply);

$("#btn-export").addEventListener("click", () => {
  readForm();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mirrora-brand-${cfg.brandId}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#input-import").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    cfg = { ...BRAND_DEFAULTS, ...data, theme: { ...BRAND_DEFAULTS.theme, ...(data.theme || {}) } };
    fillForm();
    apply();
  } catch {
    toast("Archivo de configuración no válido");
  }
  e.target.value = "";
});

$("#btn-reset").addEventListener("click", () => {
  clearBrandOverride();
  cfg = structuredClone(BRAND_DEFAULTS);
  fillForm();
  renderCampaignQR();
  $("#preview-frame").contentWindow.location.reload();
  toast("Configuración de demo restaurada");
});

/* ---------------- Init ---------------- */

fillForm();
renderCampaignQR();
