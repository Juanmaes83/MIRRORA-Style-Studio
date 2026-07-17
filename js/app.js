// MIRRORA Style Studio — app shell (Fase 1)
// Vanilla ES modules, sin frameworks ni CDNs.

import { state, save, subscribe, toggleWishlist, setProduct, toggleCombo, clearSelection, saveLook, deleteLook } from "./store.js";
import { PRODUCTS, COMBOS, OUTFITS, CATALOG_META, findItem, productArt, productSVG, comboSVG, initCatalog } from "./data/catalog.js";
import { AVATAR_OPTIONS, avatarSVG } from "./avatar.js";
import { BRAND, formatPrice } from "./data/brand.js";
import { track } from "./analytics.js";
import { buildHandoffURL, renderQR, readIncomingHandoff } from "./qr-handoff.js";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/* ================= Navegación ================= */

function goto(view) {
  $$(".view").forEach(v => v.classList.toggle("is-active", v.dataset.view === view));
  $$(".navlink").forEach(b => b.classList.toggle("is-active", b.dataset.nav === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "catalog") renderCatalog();
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

/* ================= Hero ================= */

function renderHero() {
  const pool = enabledProducts();
  const featured = pool.find(p => p.part === "accessories_up") || pool[4] || pool[0] || null;
  $("#hero-stage").innerHTML = avatarSVG(state.avatar, featured, ["panuelo"]);
}

// Tema white-label desde la consola de marca
function applyBrandTheme() {
  const t = BRAND.theme || {};
  const r = document.documentElement.style;
  if (t.ink) { r.setProperty("--ink", t.ink); }
  if (t.brass) { r.setProperty("--brass", t.brass); }
  if (t.ivory) { r.setProperty("--ivory", t.ivory); }
}

/* ================= Catálogo / Wishlist ================= */

function productCard(p) {
  const wished = state.wishlist.includes(p.id);
  return `
  <article class="product-card">
    <div class="product-art">${productArt(p)}</div>
    <div class="product-meta">
      <span class="product-line">${p.line}</span>
      <span class="product-name">${p.name}</span>
      ${p.price ? `<span class="product-price">${formatPrice(p.price)}</span>` : ""}
      <div class="product-actions">
        <button class="btn-try" data-try="${p.id}">Probar</button>
        <button class="btn-wish ${wished ? "is-on" : ""}" data-wish="${p.id}"
                aria-label="${wished ? "Quitar de wishlist" : "Añadir a wishlist"}">♥</button>
      </div>
    </div>
  </article>`;
}

function enabledProducts() {
  return BRAND.enabledProducts
    ? PRODUCTS.filter(p => BRAND.enabledProducts.includes(p.id))
    : PRODUCTS;
}

function outfitCard(o) {
  const names = o.garmentIds.map(id => findItem(id)?.name).filter(Boolean).join(" · ");
  return `
  <article class="product-card outfit-card">
    <div class="product-art">${o.image ? `<img src="${o.image}" alt="${o.name}" loading="lazy" />` : ""}</div>
    <div class="product-meta">
      <span class="product-line">Look de la colección</span>
      <span class="product-name">${o.name}</span>
      <span class="look-items">${names}</span>
      <div class="product-actions">
        <button class="btn-try" data-try-outfit="${o.id}">Probar look</button>
      </div>
    </div>
  </article>`;
}

function renderCatalog() {
  const items = enabledProducts();
  const grid = items.length
    ? items.map(productCard).join("")
    : `<p class="empty-note">Esta campaña aún no tiene piezas activas.</p>`;
  const outfitBlock = OUTFITS.length
    ? `<div class="catalog-outfits"><h3 class="catalog-outfits-title">Looks de la colección</h3>
       <div class="catalog-grid">${OUTFITS.map(outfitCard).join("")}</div></div>`
    : "";
  $("#catalog-grid").innerHTML = grid + outfitBlock;
}

function renderWishlist() {
  const items = PRODUCTS.filter(p => state.wishlist.includes(p.id));
  $("#wishlist-grid").innerHTML = items.length
    ? items.map(productCard).join("")
    : `<p class="empty-note">Tu wishlist está vacía. Explora la colección y marca ♥ en lo que te hable.</p>`;
}

document.addEventListener("click", e => {
  const tryOutfit = e.target.closest("[data-try-outfit]");
  if (tryOutfit) {
    const outfit = OUTFITS.find(o => o.id === tryOutfit.dataset.tryOutfit);
    const first = outfit?.garmentIds.map(findItem).find(Boolean);
    if (first) {
      setProduct(first.id);
      track("seleccion", { outfitId: outfit.id, productId: first.id });
      goto("studio");
      toast(`${outfit.name} en el estudio`);
    }
    return;
  }
  const tryBtn = e.target.closest("[data-try]");
  if (tryBtn) {
    const p = findItem(tryBtn.dataset.try);
    setProduct(p.id);
    track("seleccion", { productId: p.id });
    goto("studio");
    toast(`${p.name} en el estudio`);
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

/* ================= Estudio ================= */

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

function renderAvatarControls() {
  $("#avatar-controls").innerHTML = `
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
}

function renderAvatarStage() {
  const product = state.selection.productId ? findItem(state.selection.productId) : null;
  $("#avatar-stage").innerHTML = avatarSVG(state.avatar, product, state.selection.comboIds);
}

function renderOrbit() {
  const ring = $("#orbit-ring");
  const wrap = ring.closest(".orbit-wrap");
  const n = COMBOS.length;
  ring.innerHTML = COMBOS.map((c, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + 44 * Math.cos(angle);
    const y = 50 + 44 * Math.sin(angle);
    const on = state.selection.comboIds.includes(c.id);
    return `<button class="orbit-item ${on ? "is-on" : ""}" data-combo="${c.id}"
              style="left:calc(${x}% - 38px); top:calc(${y}% - 38px)"
              aria-pressed="${on}" title="${c.name} · ${formatPrice(c.price)}">
              ${comboSVG(c)}<span class="orbit-label">${c.name}</span>
            </button>`;
  }).join("");
  wrap.style.position = "relative";
}

function renderSelection() {
  const box = $("#selection-contents");
  const product = state.selection.productId ? findItem(state.selection.productId) : null;
  const combos = state.selection.comboIds.map(findItem).filter(Boolean);
  const items = [product, ...combos].filter(Boolean);

  if (!items.length) {
    box.innerHTML = `<p class="sel-empty">Aún no hay piezas. Elige un bolso en la colección
      y complementos en la órbita.</p>`;
    $("#btn-save-look").disabled = true;
    return;
  }
  $("#btn-save-look").disabled = false;

  const total = items.reduce((sum, it) => sum + it.price, 0);
  box.innerHTML = items.map(it => `
    <div class="sel-item">
      ${it.shape || it.part ? productArt(it) : comboSVG(it)}
      <span class="sel-item-name">${it.name}</span>
      <span class="sel-item-price">${formatPrice(it.price)}</span>
      <button class="sel-remove" data-remove="${it.id}" aria-label="Quitar ${it.name}">×</button>
    </div>`).join("")
    + (total ? `<div class="sel-total"><span>Total del look</span><span>${formatPrice(total)}</span></div>` : "");
}

function renderStudio() {
  renderAvatarControls();
  renderAvatarStage();
  renderOrbit();
  renderSelection();
}

document.addEventListener("click", e => {
  const av = e.target.closest("[data-avatar]");
  if (av) {
    state.avatar[av.dataset.avatar] = av.dataset.value;
    save();
    renderAvatarControls();
    renderAvatarStage();
    renderHero();
    return;
  }
  const combo = e.target.closest("[data-combo]");
  if (combo) {
    const added = toggleCombo(combo.dataset.combo);
    if (added) track("seleccion", { comboId: combo.dataset.combo });
    renderOrbit(); renderAvatarStage(); renderSelection();
    return;
  }
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const id = rm.dataset.remove;
    if (state.selection.productId === id) setProduct(null);
    else if (state.selection.comboIds.includes(id)) toggleCombo(id);
    renderStudio();
  }
});

$("#btn-clear-look").addEventListener("click", () => { clearSelection(); renderStudio(); });

$("#btn-save-look").addEventListener("click", () => {
  const product = state.selection.productId ? findItem(state.selection.productId) : null;
  const name = product ? `Look ${product.name}` : "Look MIRRORA";
  const look = saveLook(name);
  track("look_guardado", { lookId: look.id, productId: look.productId, comboIds: look.comboIds });
  renderBadges();
  toast(`Look guardado · ${BRAND.reward}`);
  goto("looks");
});

/* ================= Looks ================= */

function lookCard(look) {
  const product = look.productId ? findItem(look.productId) : null;
  const combos = look.comboIds.map(findItem).filter(Boolean);
  const names = [product, ...combos].filter(Boolean).map(i => i.name).join(" · ");
  const total = [product, ...combos].filter(Boolean).reduce((s, i) => s + i.price, 0);
  return `
  <article class="look-card">
    <div class="look-art">${avatarSVG(look.avatar, product, look.comboIds)}</div>
    <div class="look-meta">
      <h3 class="look-name">${look.name}</h3>
      <p class="look-items">${names || "Avatar"}${total ? " — " + formatPrice(total) : ""}</p>
      <div class="look-actions">
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
    : `<p class="empty-note">Todavía no has guardado ningún look. Crea uno en el estudio.</p>`;
}

document.addEventListener("click", e => {
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
    const ids = [look.productId, ...look.comboIds].filter(Boolean).join(",");
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

/* ================= Badges / sesión ================= */

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

/* ================= Init ================= */

await initCatalog();
applyBrandTheme();
const session = readIncomingHandoff();
renderCampaignBanner(session || state.session);
$("#foot-brand").textContent = BRAND.name;
renderHero();
renderBadges();
subscribe(renderBadges);

// Si el handoff trae un look de campaña, aterrizar en catálogo; si no, home.
if (session) goto("catalog");

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
