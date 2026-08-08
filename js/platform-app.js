const params = new URLSearchParams(location.search);
const API = (params.get("api") || "http://127.0.0.1:8787").replace(/\/$/, "");
const PROJECT = params.get("project") || "sol-store";
const $ = (selector) => document.querySelector(selector);
const state = { catalog: null, selected: new Set(), outfitId: null };

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const assetOf = (entity, order = ["modeled", "garment", "reconstruction", "thumbnail", "editorial"]) => order.map((kind) => entity.assets?.find((asset) => asset.kind === kind)).find(Boolean) || entity.assets?.[0] || null;
const assetUrl = (asset) => asset?.url ? `${API}${asset.url}` : "";

function productCard(garment) {
  const asset = assetOf(garment);
  const selected = state.selected.has(garment.id);
  return `<article class="live-card ${selected ? "selected" : ""}">
    <div class="live-visual">${asset ? `<img src="${esc(assetUrl(asset))}" alt="${esc(garment.name)}">` : `<span>Sin imagen</span>`}</div>
    <div class="live-copy"><span>${esc(garment.category || garment.part)}</span><h3>${esc(garment.name)}</h3><p>${esc(garment.description || "")}</p><button data-garment="${esc(garment.id)}">${selected ? "Quitar del look" : "Añadir al look"}</button></div>
  </article>`;
}

function outfitCard(outfit) {
  const asset = assetOf(outfit, ["editorial"]);
  return `<article class="live-card"><div class="live-visual">${asset ? `<img src="${esc(assetUrl(asset))}" alt="${esc(outfit.name)}">` : `<span>Sin editorial</span>`}</div><div class="live-copy"><span>${esc(outfit.status)}</span><h3>${esc(outfit.name)}</h3><p>${outfit.garmentIds.map((id) => esc(id)).join(" · ")}</p><button data-outfit="${esc(outfit.id)}">Componer este look</button></div></article>`;
}

function render() {
  const catalog = state.catalog;
  if (!catalog) return;
  $("#catalog-metrics").innerHTML = `<div><strong>${catalog.garments.length}</strong><span>Prendas</span></div><div><strong>${catalog.outfits.length}</strong><span>Outfits</span></div><div><strong>${catalog.assets?.length || 0}</strong><span>Assets públicos</span></div>`;
  $("#catalog-grid").innerHTML = catalog.garments.map(productCard).join("");
  $("#outfits-grid").innerHTML = catalog.outfits.length ? catalog.outfits.map(outfitCard).join("") : `<p class="empty">Todavía no hay outfits publicados.</p>`;
  const selectedGarments = catalog.garments.filter((garment) => state.selected.has(garment.id));
  $("#selection-grid").innerHTML = selectedGarments.length ? selectedGarments.map(productCard).join("") : `<p class="empty">Tu look está vacío.</p>`;
  $("#selection-count").textContent = state.selected.size;
  $("#save-look").disabled = !state.selected.size;
}

async function loadCatalog() {
  try {
    const savedToken = params.get("savedLook");
    if (savedToken) {
      const savedResponse = await fetch(`${API}/public/saved-looks/${encodeURIComponent(savedToken)}`, { cache: "no-store" });
      const saved = await savedResponse.json();
      if (!savedResponse.ok) throw new Error(saved.error?.message || "SavedLook no disponible");
      state.selected = new Set(saved.garmentIds || []);
      state.outfitId = saved.outfitId || null;
    }
    const response = await fetch(`${API}/public/projects/${encodeURIComponent(PROJECT)}/catalog`, { cache: "no-store" });
    const catalog = await response.json();
    if (!response.ok) throw new Error(catalog.error?.message || "No existe un catálogo publicado.");
    if (!catalog.schemaVersion?.startsWith("catalog/")) throw new Error("Contrato de catálogo no compatible.");
    state.catalog = catalog;
    $("#connection").textContent = `Conectado · ${catalog.generatedAt ? new Date(catalog.generatedAt).toLocaleString() : "catálogo activo"}`;
    render();
    if (savedToken) showView("look");
  } catch (error) {
    $("#connection").textContent = error.message;
    $("#connection").classList.add("error");
  }
}

function showView(view) {
  $("#catalog-view").hidden = view !== "catalog";
  $("#look-view").hidden = view !== "look";
  $("#show-catalog").classList.toggle("active", view === "catalog");
  $("#show-look").classList.toggle("active", view === "look");
  render();
}

function renderQR(text) {
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  $("#qr-holder").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 8, scalable: true });
}

async function saveLook() {
  const response = await fetch(`${API}/public/projects/${encodeURIComponent(PROJECT)}/saved-looks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ garmentIds: [...state.selected], outfitId: state.outfitId || null }),
  });
  const saved = await response.json();
  if (!response.ok) throw new Error(saved.error?.message || "No se pudo guardar el look.");
  const url = new URL(location.href.split("?")[0]);
  url.searchParams.set("api", API);
  url.searchParams.set("project", PROJECT);
  url.searchParams.set("savedLook", saved.token);
  renderQR(url.toString());
  $("#qr-url").textContent = url.toString();
  $("#saved-result").innerHTML = `<strong>SavedLook persistente</strong><small>ID ${esc(saved.id)}</small>`;
  $("#qr-modal").hidden = false;
}

document.addEventListener("click", async (event) => {
  const garmentButton = event.target.closest("[data-garment]");
  if (garmentButton) {
    const id = garmentButton.dataset.garment;
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
    state.outfitId = null;
    render();
    return;
  }
  const outfitButton = event.target.closest("[data-outfit]");
  if (outfitButton) {
    const outfit = state.catalog.outfits.find((item) => item.id === outfitButton.dataset.outfit);
    state.selected = new Set(outfit?.garmentIds || []);
    state.outfitId = outfit?.id || null;
    showView("look");
  }
});

$("#show-catalog").onclick = () => showView("catalog");
$("#show-look").onclick = () => showView("look");
$("#clear-look").onclick = () => { state.selected.clear(); state.outfitId = null; render(); };
$("#save-look").onclick = () => saveLook().catch((error) => { $("#saved-result").textContent = error.message; });
$("#close-qr").onclick = () => { $("#qr-modal").hidden = true; };
$("#qr-modal").onclick = (event) => { if (event.target.id === "qr-modal") event.currentTarget.hidden = true; };

loadCatalog();
