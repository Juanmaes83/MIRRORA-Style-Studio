// MIRRORA Style Studio — Outfit Studio (Fase 1 Fashion Studio SOL)
// Vanilla ES modules, sin frameworks ni CDNs.
//
// Honestidad visual: no existe try-on. El estudio es un COMPOSITOR de looks:
// muestra la fotografía editorial real cuando la composición coincide con un
// look de la colección y, si no, un tablero editorial de las piezas. El avatar
// paramétrico solo se usa en el catálogo demo (bolsos SVG), nunca para simular
// que una prenda real está puesta.

import { state, save, subscribe, toggleWishlist, setSlot, removeSlot, loadComposition, clearSelection, selectedIds, saveLook, deleteLook, addClosetItemToCanvas, removeClosetCanvasItem, saveClosetCanvas, setActiveClosetItem, setClosetFilter, updateClosetCanvasItem } from "./store.js";
import { PRODUCTS, COMBOS, OUTFITS, CATALOG_META, findItem, productArt, productSVG, comboSVG, initCatalog, slotOf, slotLabel, SLOT_ORDER } from "./data/catalog.js";
import { AVATAR_OPTIONS, avatarSVG } from "./avatar.js";
import { BRAND, formatPrice } from "./data/brand.js";
import { track } from "./analytics.js";
import { buildHandoffURL, renderQR, readIncomingHandoff } from "./qr-handoff.js";
import { buildAssetPayload, createAiClosetGateway } from "./ai-closet-gateway.js";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const external = () => CATALOG_META.source === "external";
let localMannequinUrl = null;
const aiClosetGateway = createAiClosetGateway();
const LOCAL_GARMENT_MAX_BYTES = 8 * 1024 * 1024;
const LOCAL_GARMENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const localGarments = [];

/* ================= Navegación ================= */

function goto(view) {
  $$(".view").forEach(v => v.classList.toggle("is-active", v.dataset.view === view));
  $$(".navlink").forEach(b => b.classList.toggle("is-active", b.dataset.nav === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "catalog") renderCatalog();
  if (view === "closet") renderCloset();
  if (view === "studio") renderStudio();
  if (view === "looks") renderLooks();
  if (view === "wishlist") renderWishlist();
}

document.addEventListener("click", e => {
  const nav = e.target.closest("[data-nav]");
  if (nav) { e.preventDefault(); goto(nav.dataset.nav); }
});

/* ================= Toast ================= */

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ================= Utilidades de look ================= */

function priceLine(value) {
  return value ? formatPrice(value) : "";
}

function itemsOfLook(look) {
  const ids = look.itemIds || [look.productId, ...(look.comboIds || [])].filter(Boolean);
  return ids.map(findItem).filter(Boolean);
}

function matchOutfit(ids) {
  const set = new Set(ids);
  return OUTFITS.find(o => o.garmentIds.length === set.size && o.garmentIds.every(id => set.has(id))) || null;
}

function lookVisual(items, outfit, size = "") {
  // Editorial real si la composición ES un look de la colección; si no, tablero.
  if (outfit?.image) {
    return `<figure class="editorial ${size}">
      <img src="${outfit.image}" alt="${outfit.name}" />
      <figcaption>Fotografía editorial de la colección</figcaption>
    </figure>`;
  }
  if (!items.length) return "";
  return `<div class="look-board ${size}">
    ${items.map(it => `<figure class="board-cell">
        ${it.image ? `<img src="${it.image}" alt="${it.name}" />` : (it.shape ? productSVG(it) : comboSVG(it))}
        <figcaption>${slotLabel(slotOf(it)).replace(/^combo.*/, "Complemento")}</figcaption>
      </figure>`).join("")}
  </div>`;
}

/* ================= Hero / copys de moda ================= */

function applyCatalogCopy() {
  if (!external()) return;
  $(".hero-eyebrow").textContent = `Colección cápsula · ${CATALOG_META.campaignId || BRAND.campaignId}`;
  $(".hero-lead").textContent =
    "Descubre la colección, compón tu look pieza a pieza o parte de un look editorial completo, guárdalo y llévatelo en el móvil. Composición editorial, sin foto y sin fricción.";
  $("#hero-cta-studio").textContent = "Abrir el estudio";
  const head = $('[data-view="catalog"] .view-head p');
  head.textContent = "Prêt-à-porter procesado en Wardrobe. Añade piezas a tu look o compón un look completo de la colección.";
  $$(".step")[2].querySelector("p").textContent = "Compón el look por categorías en el estudio.";
}

function renderHero() {
  const stage = $("#hero-stage");
  if (external()) {
    const o = OUTFITS[0];
    stage.innerHTML = o?.image
      ? `<figure class="editorial hero-editorial"><img src="${o.image}" alt="${o.name}" /></figure>`
      : "";
    return;
  }
  const pool = enabledProducts();
  const featured = pool.find(p => p.shape) || null;
  stage.innerHTML = avatarSVG(state.avatar, featured, ["panuelo"]);
}

/* ================= Catálogo / Wishlist ================= */

function enabledProducts() {
  return BRAND.enabledProducts
    ? PRODUCTS.filter(p => BRAND.enabledProducts.includes(p.id))
    : PRODUCTS;
}

function productCard(p) {
  const wished = state.wishlist.includes(p.id);
  const inLook = selectedIds().includes(p.id);
  return `
  <article class="product-card">
    <div class="product-art">${productArt(p)}</div>
    <div class="product-meta">
      <span class="product-line">${p.line || slotLabel(slotOf(p))}</span>
      <span class="product-name">${p.name}</span>
      ${p.price ? `<span class="product-price">${formatPrice(p.price)}</span>` : ""}
      <div class="product-actions">
        <button class="btn-try" data-add="${p.id}">${inLook ? "En el look ✓" : "Añadir al look"}</button>
        <button class="btn-wish ${wished ? "is-on" : ""}" data-wish="${p.id}"
                aria-label="${wished ? "Quitar de wishlist" : "Añadir a wishlist"}">♥</button>
      </div>
    </div>
  </article>`;
}

function outfitCard(o) {
  const items = o.garmentIds.map(findItem).filter(Boolean);
  const names = items.map(i => i.name).join(" · ");
  const art = o.image
    ? `<img src="${o.image}" alt="${o.name}" loading="lazy" />`
    : lookVisual(items, null, "thumb"); // outfit sin editorial: tablero de sus prendas
  return `
  <article class="product-card outfit-card">
    <div class="product-art">${art}</div>
    <div class="product-meta">
      <span class="product-line">Look de la colección</span>
      <span class="product-name">${o.name}</span>
      <span class="look-items">${names}</span>
      <div class="product-actions">
        <button class="btn-try" data-compose="${o.id}">Componer este look</button>
      </div>
    </div>
  </article>`;
}

let catalogFilter = "";

function categoryChips(items) {
  const cats = [...new Set(items.map(p => p.category).filter(Boolean))];
  if (cats.length < 2) return "";
  return `<div class="ctrl-row catalog-filters">
    <button class="chip ${!catalogFilter ? "is-on" : ""}" data-filter="">Todo</button>
    ${cats.map(c => `<button class="chip ${catalogFilter === c ? "is-on" : ""}" data-filter="${c}">
      ${items.find(p => p.category === c)?.line || c}</button>`).join("")}
  </div>`;
}

function renderCatalog() {
  const all = enabledProducts();
  const chips = categoryChips(all);
  const items = catalogFilter ? all.filter(p => p.category === catalogFilter) : all;
  const grid = items.length
    ? items.map(productCard).join("")
    : `<p class="empty-note">Esta campaña aún no tiene piezas activas.</p>`;
  const outfitBlock = OUTFITS.length
    ? `<div class="catalog-outfits"><h3 class="catalog-outfits-title">Looks de la colección</h3>
       <div class="catalog-grid">${OUTFITS.map(outfitCard).join("")}</div></div>`
    : "";
  $("#catalog-grid").innerHTML = chips + grid + outfitBlock;
}

document.addEventListener("click", e => {
  const f = e.target.closest("[data-filter]");
  if (f) { catalogFilter = f.dataset.filter; renderCatalog(); }
});

function renderWishlist() {
  const items = PRODUCTS.filter(p => state.wishlist.includes(p.id));
  $("#wishlist-grid").innerHTML = items.length
    ? items.map(productCard).join("")
    : `<div class="empty-note"><p>Tu wishlist está vacía. Marca ♥ en las piezas que te hablen.</p>
       <button class="btn btn-primary" data-nav="catalog">Explorar la colección</button></div>`;
}

document.addEventListener("click", e => {
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) {
    const p = findItem(addBtn.dataset.add);
    setSlot(slotOf(p), p.id);
    track("seleccion", { productId: p.id, slot: slotOf(p) });
    goto("studio");
    toast(`${p.name} en tu look`);
    return;
  }
  const compose = e.target.closest("[data-compose]");
  if (compose) {
    const outfit = OUTFITS.find(o => o.id === compose.dataset.compose);
    if (!outfit) return;
    const slots = {};
    outfit.garmentIds.map(findItem).filter(Boolean).forEach(it => { slots[slotOf(it)] = it.id; });
    loadComposition(slots, outfit.id);
    track("seleccion", { outfitId: outfit.id, items: outfit.garmentIds.join(",") });
    goto("studio");
    toast(`${outfit.name} cargado: ${Object.keys(slots).length} piezas`);
    return;
  }
  const wishBtn = e.target.closest("[data-wish]");
  if (wishBtn) {
    const added = toggleWishlist(wishBtn.dataset.wish);
    if (added) track("wishlist_add", { productId: wishBtn.dataset.wish });
    renderCatalog();
    renderWishlist();
    renderBadges();
  }
});

/* ================= Estudio — modo demo (bolsos SVG + avatar) ================= */

function chipRow(key, options, current, isSwatch = false) {
  const btns = options.map(o => {
    if (isSwatch) {
      return `<button class="swatch ${o === current ? "is-on" : ""}" style="background:${o}"
                data-avatar="${key}" data-value="${o}" aria-label="${key} ${o}"></button>`;
    }
    return `<button class="chip ${o.id === current ? "is-on" : ""}"
              data-avatar="${key}" data-value="${o.id}">${o.label}</button>`;
  }).join("");
  return `<div class="ctrl-row">${btns}</div>`;
}

function renderDemoStudio() {
  $("#left-panel").innerHTML = `
    <h2 class="panel-title">Tu avatar</h2>
    <p class="panel-sub">Editorial, sin foto</p>
    <div class="ctrl-group"><span class="ctrl-label">Silueta</span>
      ${chipRow("silhouette", AVATAR_OPTIONS.silhouette, state.avatar.silhouette)}</div>
    <div class="ctrl-group"><span class="ctrl-label">Tono</span>
      ${chipRow("skin", AVATAR_OPTIONS.skin, state.avatar.skin, true)}</div>
    <div class="ctrl-group"><span class="ctrl-label">Pelo</span>
      ${chipRow("hairStyle", AVATAR_OPTIONS.hairStyle, state.avatar.hairStyle)}</div>
    <div class="ctrl-group"><span class="ctrl-label">Color de pelo</span>
      ${chipRow("hairColor", AVATAR_OPTIONS.hairColor, state.avatar.hairColor, true)}</div>
    <div class="ctrl-group"><span class="ctrl-label">Estilo</span>
      ${chipRow("style", AVATAR_OPTIONS.style, state.avatar.style)}</div>`;

  const bagId = state.selection.slots.bag;
  const bag = bagId ? findItem(bagId) : null;
  const comboIds = selectedIds().filter(id => COMBOS.some(c => c.id === id));
  const n = COMBOS.length;
  const orbit = COMBOS.map((c, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + 44 * Math.cos(angle);
    const y = 50 + 44 * Math.sin(angle);
    const on = comboIds.includes(c.id);
    return `<button class="orbit-item ${on ? "is-on" : ""}" data-combo="${c.id}"
              style="left:calc(${x}% - 38px); top:calc(${y}% - 38px)"
              aria-pressed="${on}" title="${c.name} · ${formatPrice(c.price)}">
              ${comboSVG(c)}<span class="orbit-label">${c.name}</span>
            </button>`;
  }).join("");

  $("#studio-stage-wrap").innerHTML = `
    <div class="orbit-wrap"><div class="orbit-ring">${orbit}</div>
      <div class="avatar-stage">${avatarSVG(state.avatar, bag, comboIds)}</div></div>
    <p class="orbit-hint">Órbita de complementos — el avatar es una ilustración editorial, no una prueba de talla</p>`;
}

/* ================= Estudio — modo colección (compositor honesto) ================= */

function renderCompositionPanel() {
  const slots = state.selection.slots;
  const rows = SLOT_ORDER.filter(s => s !== "bag").map(slot => {
    const item = slots[slot] ? findItem(slots[slot]) : null;
    return `<div class="slot-row ${item ? "is-filled" : ""}">
      <span class="slot-cat">${slotLabel(slot)}</span>
      ${item
        ? `<span class="slot-item">${item.name}</span>
           <button class="sel-remove" data-unslot="${slot}" aria-label="Quitar ${item.name}">×</button>`
        : `<button class="slot-pick" data-nav="catalog">Elegir</button>`}
    </div>`;
  }).join("");
  $("#left-panel").innerHTML = `
    <h2 class="panel-title">Composición</h2>
    <p class="panel-sub">por categorías</p>
    ${rows}
    <p class="studio-note">Composición editorial: muestra las piezas reales de la colección.
    No simula ajuste, talla ni prueba sobre el cuerpo.</p>`;
}

function renderCollectionStage() {
  const items = selectedIds().map(findItem).filter(Boolean);
  const outfit = state.selection.outfitId
    ? OUTFITS.find(o => o.id === state.selection.outfitId)
    : matchOutfit(selectedIds());
  const stage = $("#studio-stage-wrap");
  if (!items.length) {
    stage.innerHTML = `<div class="empty-note stage-empty">
      <p>Tu look está vacío. Empieza por la colección.</p>
      <button class="btn btn-primary" data-nav="catalog">Explorar la colección</button></div>`;
    return;
  }
  stage.innerHTML = `
    ${lookVisual(items, outfit, "stage-visual")}
    ${outfit ? `<p class="orbit-hint">${outfit.name} — look de la colección</p>`
             : `<p class="orbit-hint">Look propio — tablero editorial de tus piezas</p>`}`;
}

/* ================= Estudio común ================= */

function renderSelection() {
  const box = $("#selection-contents");
  const items = selectedIds().map(findItem).filter(Boolean);
  if (!items.length) {
    box.innerHTML = `<p class="sel-empty">Aún no hay piezas en tu look.</p>`;
    $("#btn-save-look").disabled = true;
    return;
  }
  $("#btn-save-look").disabled = false;
  const total = items.reduce((sum, it) => sum + (it.price || 0), 0);
  box.innerHTML = items.map(it => `
    <div class="sel-item">
      ${it.shape || it.part ? productArt(it) : comboSVG(it)}
      <div class="sel-item-body">
        <span class="sel-item-cat">${slotLabel(slotOf(it)).replace(/^combo.*/, "Complemento")}</span>
        <span class="sel-item-name">${it.name}</span>
      </div>
      ${it.price ? `<span class="sel-item-price">${formatPrice(it.price)}</span>` : ""}
      <button class="sel-remove" data-remove="${it.id}" aria-label="Quitar ${it.name}">×</button>
    </div>`).join("")
    + (total ? `<div class="sel-total"><span>Total del look</span><span>${formatPrice(total)}</span></div>` : "");
}

function renderStudio() {
  if (external()) { renderCompositionPanel(); renderCollectionStage(); }
  else renderDemoStudio();
  renderSelection();
}

document.addEventListener("click", e => {
  const av = e.target.closest("[data-avatar]");
  if (av) {
    state.avatar[av.dataset.avatar] = av.dataset.value;
    save();
    renderStudio();
    renderHero();
    return;
  }
  const combo = e.target.closest("[data-combo]");
  if (combo) {
    const c = findItem(combo.dataset.combo);
    setSlot(slotOf(c), c.id);
    track("seleccion", { comboId: c.id });
    renderStudio();
    return;
  }
  const un = e.target.closest("[data-unslot]");
  if (un) { removeSlot(un.dataset.unslot); renderStudio(); return; }
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const it = findItem(rm.dataset.remove);
    if (it) removeSlot(slotOf(it));
    renderStudio();
  }
});

$("#btn-clear-look").addEventListener("click", () => { clearSelection(); renderStudio(); });

$("#btn-save-look").addEventListener("click", () => {
  const ids = selectedIds();
  const outfit = state.selection.outfitId ? OUTFITS.find(o => o.id === state.selection.outfitId) : matchOutfit(ids);
  const name = outfit ? outfit.name : `Mi look ${state.looks.length + 1}`;
  if (outfit) state.selection.outfitId = outfit.id;
  const look = saveLook(name);
  track("look_guardado", { lookId: look.id, itemIds: look.itemIds, outfitId: look.outfitId });
  renderBadges();
  toast(`Look guardado · ${BRAND.reward}`);
  goto("looks");
});

/* ================= Mis looks ================= */

function lookCard(look) {
  const items = itemsOfLook(look);
  const outfit = look.outfitId ? OUTFITS.find(o => o.id === look.outfitId) : matchOutfit(items.map(i => i.id));
  const names = items.map(i => i.name).join(" · ");
  const total = items.reduce((s, i) => s + (i.price || 0), 0);
  return `
  <article class="look-card">
    <div class="look-art">${lookVisual(items, outfit, "thumb") || avatarSVG(look.avatar || state.avatar, null, [])}</div>
    <div class="look-meta">
      <h3 class="look-name">${look.name}</h3>
      <p class="look-items">${names || "Composición"}${total ? " — " + formatPrice(total) : ""}</p>
      <div class="look-actions">
        <button class="btn btn-ghost" data-reopen="${look.id}">Reabrir</button>
        <button class="btn btn-ghost" data-qr="${look.id}">QR a móvil</button>
        <button class="btn btn-primary" data-cart="${look.id}">Al carrito</button>
      </div>
      <button class="look-del" data-del="${look.id}">Eliminar</button>
    </div>
  </article>`;
}

function renderLooks() {
  $("#looks-grid").innerHTML = state.looks.length
    ? state.looks.map(lookCard).join("")
    : `<div class="empty-note"><p>Todavía no has guardado ningún look.</p>
       <button class="btn btn-primary" data-nav="catalog">Explorar la colección</button>
       <button class="btn btn-ghost" data-nav="studio">Abrir el estudio</button></div>`;
}

document.addEventListener("click", e => {
  const reopen = e.target.closest("[data-reopen]");
  if (reopen) {
    const look = state.looks.find(l => l.id === reopen.dataset.reopen);
    const slots = look.slots || {};
    if (!Object.keys(slots).length) itemsOfLook(look).forEach(it => { slots[slotOf(it)] = it.id; });
    loadComposition(slots, look.outfitId || null);
    goto("studio");
    toast(`${look.name} reabierto en el estudio`);
    return;
  }
  const qrBtn = e.target.closest("[data-qr]");
  if (qrBtn) {
    const look = state.looks.find(l => l.id === qrBtn.dataset.qr);
    const url = buildHandoffURL(look);
    renderQR($("#qr-holder"), url);
    $("#qr-caption").textContent = `${look.name} · ${BRAND.name} · escanéalo para abrirlo en tu móvil`;
    $("#qr-modal").hidden = false;
    track("qr_generado", { lookId: look.id });
    return;
  }
  const cartBtn = e.target.closest("[data-cart]");
  if (cartBtn) {
    const look = state.looks.find(l => l.id === cartBtn.dataset.cart);
    const ids = itemsOfLook(look).map(i => i.id).join(",");
    const url = BRAND.cartUrlTemplate
      .replace("{items}", encodeURIComponent(ids))
      .replace("{campaign}", encodeURIComponent(BRAND.campaignId))
      .replace("{look}", encodeURIComponent(look.id));
    track("carrito_click", { lookId: look.id, items: ids });
    toast("Abriendo el carrito de la marca…");
    window.open(url, "_blank", "noopener");
    return;
  }
  const delBtn = e.target.closest("[data-del]");
  if (delBtn) {
    deleteLook(delBtn.dataset.del);
    renderLooks(); renderBadges();
  }
});

$("#qr-modal-close").addEventListener("click", () => { $("#qr-modal").hidden = true; });
$("#qr-modal").addEventListener("click", e => { if (e.target.id === "qr-modal") e.target.hidden = true; });

/* ================= Badges / sesión / tema ================= */

const PLACEMENT_PRESETS = {
  upperbody: { x: 50, y: 36, scale: 0.92, zIndex: 30, width: 42 },
  wholebody_up: { x: 50, y: 42, scale: 1.06, zIndex: 40, width: 48 },
  lowerbody: { x: 50, y: 64, scale: 0.94, zIndex: 20, width: 36 },
  shoes: { x: 50, y: 85, scale: 0.72, zIndex: 50, width: 42 },
  accessories_up: { x: 62, y: 43, scale: 0.42, zIndex: 60, width: 20 },
};

function placementFor(item) {
  return PLACEMENT_PRESETS[item.part] || { x: 50, y: 50, scale: 0.7, zIndex: 35, width: 30 };
}

function allClosetItems() {
  return [...localGarments, ...PRODUCTS];
}

function findClosetItem(id) {
  return localGarments.find(item => item.id === id) || findItem(id);
}

function localCategoryLabel(category) {
  if (category === "uploads") return "Subidas";
  return PRODUCTS.find(item => item.category === category)?.line || category;
}

function readFileAsDataUrl(file) {
  return new Promise((resolveFile, rejectFile) => {
    const reader = new FileReader();
    reader.onload = () => resolveFile(String(reader.result || ""));
    reader.onerror = () => rejectFile(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function validateLocalGarment(file) {
  if (!file) throw new Error("Selecciona una foto de prenda");
  if (!LOCAL_GARMENT_TYPES.has(file.type)) throw new Error("Formato no permitido. Usa JPEG, PNG o WebP");
  if (file.size > LOCAL_GARMENT_MAX_BYTES) throw new Error("La imagen supera el limite de 8 MB");
}

function statusTextForUpload(job, file) {
  if (job.status === "completed" && job.result?.simulated === false) return "PNG transparente generado por rembg";
  if (job.status === "completed") return "Procesado simulado: listo para validar flujo";
  if (job.status === "failed") return job.error?.message || "No se pudo procesar la prenda";
  return `Procesando ${file.name}`;
}

async function processLocalGarment(file) {
  validateLocalGarment(file);
  const dataUrl = await readFileAsDataUrl(file);
  const assetId = `local-garment-${Date.now().toString(36)}`;
  const payload = buildAssetPayload(assetId, {
    upload: { fileName: file.name, contentType: file.type, size: file.size, dataUrl },
  });
  const job = await aiClosetGateway.removeBackground(payload, assetId);
  const image = job.result?.imageDataUrl || dataUrl;
  const item = {
    id: assetId,
    name: file.name.replace(/\.[^.]+$/, "") || "Prenda local",
    line: "Prenda subida",
    category: "uploads",
    material: job.result?.simulated ? "validacion local" : "PNG transparente",
    part: "upperbody",
    image,
    sourceImage: dataUrl,
    processedAssetId: job.result?.processedAssetId || null,
    processingStatus: statusTextForUpload(job, file),
    simulated: job.result?.simulated !== false,
  };
  localGarments.unshift(item);
  state.aiCloset.filter = "uploads";
  state.aiCloset.activeItemId = item.id;
  save();
  return item;
}

function renderCloset() {
  const closet = state.aiCloset;
  const allItems = allClosetItems();
  const categories = [...new Set(allItems.map(item => item.category).filter(Boolean))];
  const filters = [["all", "Todo"], ...categories.map(category => [category, localCategoryLabel(category)])];
  const visible = closet.filter === "all" ? allItems : allItems.filter(item => item.category === closet.filter);
  $("#closet-filters").innerHTML = `<div class="closet-filter-list">${filters.map(([id, label]) => `<button class="chip ${closet.filter === id ? "is-on" : ""}" data-closet-filter="${id}">${label}</button>`).join("")}</div>`;
  $("#closet-grid").innerHTML = `<div class="garment-upload">
    <label for="garment-input">Subir foto de prenda</label>
    <input id="garment-input" type="file" accept="image/png,image/jpeg,image/webp" />
    <small>JPEG, PNG o WebP. Maximo 8 MB. Sin R2: asset temporal de validacion.</small>
    <p id="garment-upload-status" class="upload-status"></p>
  </div>${visible.map(item => `<button class="closet-card ${closet.activeItemId === item.id ? "is-active" : ""}" data-closet-item="${item.id}"><span class="closet-art"><img src="${item.image}" alt="" /></span><span><strong>${item.name}</strong><small>${item.material || item.category} / activo</small></span></button>`).join("")}`;
  const active = findClosetItem(closet.activeItemId) || allItems[0];
  const onCanvas = closet.canvasItems.some(entry => entry.itemId === active.id);
  const transform = closet.canvasItems.find(entry => entry.itemId === active.id);
  const transformControls = transform ? `<div class="transform-controls"><span>Transformar prenda</span><output>Escala ${Math.round(transform.scale * 100)}% / giro ${transform.rotation}deg / capa ${transform.zIndex}</output><div><button data-transform="scale-down">- Tamano</button><button data-transform="scale-up">+ Tamano</button></div><div><button data-transform="rotate-left">Girar izq.</button><button data-transform="rotate-right">Girar der.</button></div><div><button data-transform="back">Enviar atras</button><button data-transform="front">Traer delante</button></div><button class="danger-link" data-transform="remove">Quitar del lienzo</button></div>` : "";
  const beforeAfter = active.sourceImage ? `<div class="before-after"><figure><img src="${active.sourceImage}" alt="Original ${active.name}" /><figcaption>Antes</figcaption></figure><figure><img src="${active.image}" alt="Procesada ${active.name}" /><figcaption>Despues</figcaption></figure></div>` : `<div class="detail-art"><img src="${active.image}" alt="${active.name}" /></div>`;
  const removeLocal = active.sourceImage ? `<button class="danger-link btn-block local-delete" data-local-delete="${active.id}">Borrar temporal</button>` : "";
  $("#closet-detail").innerHTML = `<p class="detail-kicker">${active.sourceImage ? "Prenda temporal" : "Catalogo real"} / ${active.line}</p>${beforeAfter}<h3>${active.name}</h3><p>${active.category} / ${active.material || "sin material"}</p><span class="detail-status">${active.processingStatus || "Asset aprobado"}</span><button class="btn btn-primary btn-block" data-canvas-add="${active.id}">${onCanvas ? "En el lienzo" : "Anadir al lienzo"}</button>${transformControls}${removeLocal}<p class="detail-note">Imagen real procesada mediante /api/ai-closet. Sin R2 ni persistencia permanente en esta fase.</p>`;
  const items = closet.canvasItems.filter(entry => findClosetItem(entry.itemId));
  if (items.length !== closet.canvasItems.length) {
    closet.canvasItems = items;
    save();
  }
  $("#canvas-count").textContent = `${items.length} ${items.length === 1 ? "prenda" : "prendas"}`;
  const mannequin = localMannequinUrl ? `<img class="canvas-mannequin" src="${localMannequinUrl}" alt="Foto local usada como referencia de composicion" />` : `<div class="canvas-mannequin canvas-mannequin-placeholder" aria-hidden="true"></div>`;
  $("#closet-canvas").innerHTML = `${mannequin}<div class="body-guides" aria-hidden="true"><i class="guide-shoulders"></i><i class="guide-waist"></i><i class="guide-hips"></i><i class="guide-feet"></i></div>${items.length ? items.map(entry => { const item = findClosetItem(entry.itemId); const preset = placementFor(item); return `<button class="canvas-garment ${closet.activeItemId === entry.itemId ? "is-selected" : ""}" data-canvas-item="${entry.itemId}" style="--garment-width:${preset.width}%;left:${entry.x}%;top:${entry.y}%;z-index:${entry.zIndex};transform:translate(-50%,-50%) rotate(${entry.rotation}deg) scale(${entry.scale})"><img src="${item.image}" alt="${item.name}" /><span class="canvas-handle" aria-hidden="true"></span></button>`; }).join("") : `<div class="canvas-empty"><span>Selecciona una prenda del armario</span><small>Tu composicion aparecera aqui</small></div>`}`;
  $$("[data-canvas-item]").forEach(node => node.addEventListener("pointerdown", event => {
    const itemId = node.dataset.canvasItem; setActiveClosetItem(itemId); node.setPointerCapture(event.pointerId); const canvas = $("#closet-canvas");
    const move = next => { const box = canvas.getBoundingClientRect(); const x = Math.max(8, Math.min(92, ((next.clientX - box.left) / box.width) * 100)); const y = Math.max(8, Math.min(92, ((next.clientY - box.top) / box.height) * 100)); updateClosetCanvasItem(itemId, { x, y }); node.style.left = `${x}%`; node.style.top = `${y}%`; };
    node.addEventListener("pointermove", move); node.addEventListener("pointerup", () => { node.removeEventListener("pointermove", move); renderCloset(); }, { once: true });
  }));
}

document.addEventListener("click", event => {
  const filter = event.target.closest("[data-closet-filter]"); if (filter) { setClosetFilter(filter.dataset.closetFilter); renderCloset(); return; }
  const item = event.target.closest("[data-closet-item]"); if (item) { setActiveClosetItem(item.dataset.closetItem); renderCloset(); return; }
  const add = event.target.closest("[data-canvas-add]"); if (add) { const product = findClosetItem(add.dataset.canvasAdd); addClosetItemToCanvas(product.id, placementFor(product)); renderCloset(); }
  const localDelete = event.target.closest("[data-local-delete]");
  if (localDelete) {
    const index = localGarments.findIndex(entry => entry.id === localDelete.dataset.localDelete);
    if (index >= 0) localGarments.splice(index, 1);
    removeClosetCanvasItem(localDelete.dataset.localDelete);
    state.aiCloset.activeItemId = PRODUCTS[0]?.id || null;
    save();
    renderCloset();
    toast("Prenda temporal borrada");
    return;
  }
  const transform = event.target.closest("[data-transform]");
  if (transform) {
    const entry = state.aiCloset.canvasItems.find(item => item.itemId === state.aiCloset.activeItemId);
    if (!entry) return;
    const action = transform.dataset.transform;
    if (action === "remove") removeClosetCanvasItem(entry.itemId);
    else if (action === "scale-up") updateClosetCanvasItem(entry.itemId, { scale: Math.min(2.4, +(entry.scale + 0.1).toFixed(2)) });
    else if (action === "scale-down") updateClosetCanvasItem(entry.itemId, { scale: Math.max(0.35, +(entry.scale - 0.1).toFixed(2)) });
    else if (action === "rotate-left") updateClosetCanvasItem(entry.itemId, { rotation: entry.rotation - 10 });
    else if (action === "rotate-right") updateClosetCanvasItem(entry.itemId, { rotation: entry.rotation + 10 });
    else if (action === "front") updateClosetCanvasItem(entry.itemId, { zIndex: Math.max(...state.aiCloset.canvasItems.map(item => item.zIndex)) + 1 });
    else if (action === "back") updateClosetCanvasItem(entry.itemId, { zIndex: Math.min(...state.aiCloset.canvasItems.map(item => item.zIndex)) - 1 });
    renderCloset();
  }
});

$("#closet-save").addEventListener("click", () => { saveClosetCanvas(); toast("Composicion guardada en este dispositivo"); });
document.addEventListener("change", async event => {
  if (event.target?.id !== "garment-input") return;
  const status = $("#garment-upload-status");
  const file = event.target.files?.[0];
  try {
    status.textContent = "Procesando prenda...";
    const item = await processLocalGarment(file);
    renderCloset();
    toast(`${item.name} lista para el lienzo`);
  } catch (caught) {
    status.textContent = caught.message || "No se pudo procesar";
    toast(status.textContent);
  } finally {
    event.target.value = "";
  }
});
$("#mannequin-input").addEventListener("change", event => { const file = event.target.files?.[0]; if (!file) return; if (localMannequinUrl) URL.revokeObjectURL(localMannequinUrl); localMannequinUrl = URL.createObjectURL(file); $("#mannequin-remove").hidden = false; renderCloset(); });
$("#mannequin-remove").addEventListener("click", () => { if (localMannequinUrl) URL.revokeObjectURL(localMannequinUrl); localMannequinUrl = null; $("#mannequin-input").value = ""; $("#mannequin-remove").hidden = true; renderCloset(); });

function renderBadges() {
  const bl = $("#badge-looks"), bw = $("#badge-wishlist");
  bl.textContent = state.looks.length; bl.hidden = !state.looks.length;
  bw.textContent = state.wishlist.length; bw.hidden = !state.wishlist.length;
}

function renderCampaignBanner(session) {
  if (!session) return;
  const el = $("#campaign-banner");
  el.textContent = `Campaña ${session.campaignId} · bienvenida desde ${session.source}`;
  el.hidden = false;
}

function applyBrandTheme() {
  const t = BRAND.theme || {};
  const r = document.documentElement.style;
  if (t.ink) r.setProperty("--ink", t.ink);
  if (t.brass) r.setProperty("--brass", t.brass);
  if (t.ivory) r.setProperty("--ivory", t.ivory);
}

/* ================= Init ================= */

await initCatalog();
applyBrandTheme();
applyCatalogCopy();
const session = readIncomingHandoff();
renderCampaignBanner(session || state.session);
$("#foot-brand").textContent = BRAND.name;
renderHero();
renderBadges();
subscribe(renderBadges);

if (session) goto("catalog");

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
