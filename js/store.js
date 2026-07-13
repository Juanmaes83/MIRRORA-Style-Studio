// Estado de la PWA. Persistencia local (sesión anónima por dispositivo):
// la identidad real solo se pide al reclamar recompensa o pasar a carrito (Fase 3+).

const KEY = "mirrora.v1";

const DEFAULTS = {
  deviceId: null,
  session: null,            // { campaignId, brandId, source, startedAt }
  avatar: {
    silhouette: "h",        // a | h | o
    skin: "#e8c39e",
    hairStyle: "melena",    // corto | melena | recogido | rizado
    hairColor: "#2f2118",
    style: "minimal"        // minimal | boho | sastre | urbano
  },
  selection: { productId: null, comboIds: [] },
  wishlist: [],             // product ids
  looks: [],                // { id, name, avatar, productId, comboIds, createdAt }
  events: []                // funnel local (espejo de analytics)
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...structuredClone(DEFAULTS), ...data, avatar: { ...DEFAULTS.avatar, ...data.avatar } };
    }
  } catch { /* estado corrupto → empezar limpio */ }
  return structuredClone(DEFAULTS);
}

export const state = load();

if (!state.deviceId) {
  state.deviceId = "dev-" + crypto.randomUUID();
}

const listeners = new Set();

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toggleWishlist(productId) {
  const i = state.wishlist.indexOf(productId);
  if (i >= 0) state.wishlist.splice(i, 1);
  else state.wishlist.push(productId);
  save();
  return i < 0;
}

export function setProduct(productId) {
  state.selection.productId = productId;
  save();
}

export function toggleCombo(comboId) {
  const list = state.selection.comboIds;
  const i = list.indexOf(comboId);
  if (i >= 0) list.splice(i, 1);
  else list.push(comboId);
  save();
  return i < 0;
}

export function clearSelection() {
  state.selection = { productId: null, comboIds: [] };
  save();
}

export function saveLook(name) {
  const look = {
    id: "look-" + Date.now().toString(36),
    name,
    avatar: { ...state.avatar },
    productId: state.selection.productId,
    comboIds: [...state.selection.comboIds],
    createdAt: new Date().toISOString()
  };
  state.looks.unshift(look);
  save();
  return look;
}

export function deleteLook(lookId) {
  state.looks = state.looks.filter(l => l.id !== lookId);
  save();
}
