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
  // Look activo: composición por categorías. slots = { <slot>: <itemId> }.
  // outfitId se rellena si la composición nació de un look de la colección.
  selection: { slots: {}, outfitId: null },
  wishlist: [],             // product ids
  looks: [],                // { id, name, avatar, productId, comboIds, createdAt }
  events: []                // funnel local (espejo de analytics)
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const state = { ...structuredClone(DEFAULTS), ...data, avatar: { ...DEFAULTS.avatar, ...data.avatar } };
      if (!state.selection || !state.selection.slots) state.selection = { slots: {}, outfitId: null };
      return state;
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

export function setSlot(slot, itemId) {
  if (state.selection.slots[slot] === itemId) delete state.selection.slots[slot];
  else state.selection.slots[slot] = itemId;
  state.selection.outfitId = null;
  save();
}

export function removeSlot(slot) {
  delete state.selection.slots[slot];
  state.selection.outfitId = null;
  save();
}

export function loadComposition(slotsMap, outfitId = null) {
  state.selection = { slots: { ...slotsMap }, outfitId };
  save();
}

export function clearSelection() {
  state.selection = { slots: {}, outfitId: null };
  save();
}

export function selectedIds() {
  return Object.values(state.selection.slots);
}

export function saveLook(name) {
  const look = {
    id: "look-" + Date.now().toString(36),
    name,
    avatar: { ...state.avatar },
    itemIds: selectedIds(),
    slots: { ...state.selection.slots },
    outfitId: state.selection.outfitId,
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
