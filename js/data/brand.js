// Contrato de configuración white-label. La consola de marca (console.html) escribe
// un override en localStorage; la PWA lo funde con estos valores de demo.

export const BRAND_DEFAULTS = {
  brandId: "maison-demo",
  name: "Maison Demo",
  campaignId: "ss26-bolsos",
  // Plantilla de destino de carrito: {items} = ids separados por coma, {look} = id de look
  cartUrlTemplate: "https://tienda.example.com/cart?add={items}&utm_source=mirrora&utm_campaign={campaign}&look={look}",
  reward: "10% en tu primera compra al guardar un look",
  currency: "EUR",
  retentionDays: 30,
  theme: { ink: "#161412", brass: "#b08d4f", ivory: "#f4efe7" },
  enabledProducts: null // null = todo el catálogo; o array de ids
};

const OVERRIDE_KEY = "mirrora.brand.v1";

export function loadBrandOverride() {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveBrandOverride(cfg) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(cfg));
}

export function clearBrandOverride() {
  localStorage.removeItem(OVERRIDE_KEY);
}

const override = loadBrandOverride() || {};
export const BRAND = {
  ...BRAND_DEFAULTS,
  ...override,
  theme: { ...BRAND_DEFAULTS.theme, ...(override.theme || {}) }
};

export function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: BRAND.currency }).format(value);
}
