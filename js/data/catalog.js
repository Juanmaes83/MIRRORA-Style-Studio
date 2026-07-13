// Catálogo piloto — categoría: bolsos + complementos combinables.
// Todo el arte es SVG inline propio (sin assets externos).

const S = (body, vb = "0 0 120 120") =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${body}</svg>`;

/* ---------- Siluetas de bolso (color principal parametrizable) ---------- */

const bagArt = {
  tote: (c, c2) => S(`
    <path d="M42 34 Q42 18 60 18 Q78 18 78 34" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
    <path d="M28 40 L92 40 L86 98 Q85 104 79 104 L41 104 Q35 104 34 98 Z" fill="${c}"/>
    <rect x="28" y="40" width="64" height="8" rx="3" fill="${c2}" opacity="0.55"/>
    <circle cx="60" cy="72" r="4" fill="${c2}"/>
  `),
  clutch: (c, c2) => S(`
    <rect x="18" y="48" width="84" height="38" rx="10" fill="${c}"/>
    <path d="M18 60 L102 60 L98 48 Q96 42 88 42 L32 42 Q24 42 22 48 Z" fill="${c2}" opacity="0.75"/>
    <circle cx="60" cy="60" r="5" fill="${c2}"/>
  `),
  crossbody: (c, c2) => S(`
    <path d="M38 44 Q60 4 82 44" fill="none" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>
    <rect x="30" y="44" width="60" height="50" rx="14" fill="${c}"/>
    <rect x="30" y="56" width="60" height="6" fill="${c2}" opacity="0.5"/>
    <rect x="52" y="44" width="16" height="10" rx="4" fill="${c2}"/>
  `),
  bucket: (c, c2) => S(`
    <path d="M40 36 Q60 12 80 36" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
    <path d="M32 40 L88 40 L82 96 Q81 104 72 104 L48 104 Q39 104 38 96 Z" fill="${c}"/>
    <path d="M36 56 Q60 66 84 56" fill="none" stroke="${c2}" stroke-width="3" stroke-dasharray="5 6"/>
    <circle cx="60" cy="58" r="4" fill="${c2}"/>
  `),
  tophandle: (c, c2) => S(`
    <path d="M46 40 Q46 22 60 22 Q74 22 74 40" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
    <rect x="24" y="40" width="72" height="56" rx="12" fill="${c}"/>
    <rect x="24" y="40" width="72" height="12" rx="6" fill="${c2}" opacity="0.5"/>
    <rect x="54" y="48" width="12" height="16" rx="3" fill="${c2}"/>
  `),
  hobo: (c, c2) => S(`
    <path d="M42 46 Q60 8 78 46" fill="none" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
    <path d="M24 52 Q24 44 34 44 L86 44 Q96 44 96 52 Q98 92 60 100 Q22 92 24 52 Z" fill="${c}"/>
    <path d="M30 54 Q60 64 90 54" fill="none" stroke="${c2}" stroke-width="3" opacity="0.6"/>
  `),
  mini: (c, c2) => S(`
    <path d="M48 46 Q48 32 60 32 Q72 32 72 46" fill="none" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>
    <rect x="38" y="46" width="44" height="40" rx="10" fill="${c}"/>
    <rect x="38" y="56" width="44" height="5" fill="${c2}" opacity="0.5"/>
    <circle cx="60" cy="70" r="3.5" fill="${c2}"/>
  `),
  shopper: (c, c2) => S(`
    <path d="M40 32 L48 16 M80 32 L72 16" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>
    <path d="M22 32 L98 32 L92 102 Q91 108 84 108 L36 108 Q29 108 28 102 Z" fill="${c}"/>
    <path d="M22 32 L98 32 L96 46 L24 46 Z" fill="${c2}" opacity="0.4"/>
    <text x="60" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="${c2}" letter-spacing="2">M</text>
  `)
};

export const PRODUCTS = [
  { id: "atica",    name: "Ática",    line: "Tote estructurado",  price: 290, shape: "tote",      color: "#8a5a34", accent: "#3c2716" },
  { id: "nocturne", name: "Nocturne", line: "Clutch de noche",    price: 185, shape: "clutch",    color: "#23211f", accent: "#b08d4f" },
  { id: "vela",     name: "Vela",     line: "Crossbody urbano",   price: 240, shape: "crossbody", color: "#9c3d2e", accent: "#4a1d15" },
  { id: "duna",     name: "Duna",     line: "Bucket artesanal",   price: 260, shape: "bucket",    color: "#c9a061", accent: "#6e5124" },
  { id: "opera",    name: "Ópera",    line: "Top-handle icónico", price: 340, shape: "tophandle", color: "#5d3a52", accent: "#2c1a26" },
  { id: "luna",     name: "Luna",     line: "Hobo suave",         price: 265, shape: "hobo",      color: "#7a7d6a", accent: "#3d3f33" },
  { id: "bruma",    name: "Bruma",    line: "Mini de tarde",      price: 210, shape: "mini",      color: "#b9b3a6", accent: "#5b564c" },
  { id: "marea",    name: "Marea",    line: "Shopper de lino",    price: 195, shape: "shopper",   color: "#e5dcc9", accent: "#8a7a55" }
];

/* ---------- Complementos: la órbita de combinaciones ---------- */

const comboArt = {
  scarf: () => S(`
    <path class="tint" d="M28 36 Q60 20 92 36 Q80 52 60 50 Q40 52 28 36 Z" fill="#b0654f"/>
    <path d="M52 50 L46 96 L54 92 L58 98 L64 92 L70 96 L66 50" fill="#c98a6f"/>
  `),
  charm: () => S(`
    <path d="M60 22 L60 44" stroke="#8a7a55" stroke-width="4"/>
    <circle cx="60" cy="22" r="7" fill="none" stroke="#8a7a55" stroke-width="4"/>
    <path class="tint" d="M60 44 L78 66 L60 98 L42 66 Z" fill="#b08d4f"/>
    <path d="M60 44 L69 66 L60 98 L51 66 Z" fill="#c9ad7b"/>
  `),
  strap: () => S(`
    <path class="tint" d="M24 84 Q60 16 96 84" fill="none" stroke="#4a5d4a" stroke-width="12" stroke-linecap="round"/>
    <path d="M24 84 Q60 16 96 84" fill="none" stroke="#8fa08f" stroke-width="12" stroke-linecap="round" stroke-dasharray="6 10"/>
  `),
  wallet: () => S(`
    <rect class="tint" x="26" y="40" width="68" height="44" rx="9" fill="#23211f"/>
    <rect x="26" y="52" width="68" height="6" fill="#b08d4f"/>
    <circle cx="82" cy="70" r="4" fill="#b08d4f"/>
  `),
  sunglasses: () => S(`
    <path d="M22 50 L98 50" stroke="#23211f" stroke-width="5"/>
    <circle class="tint" cx="42" cy="62" r="16" fill="#23211f"/>
    <circle class="tint" cx="78" cy="62" r="16" fill="#23211f"/>
    <path d="M56 58 Q60 52 64 58" fill="none" stroke="#23211f" stroke-width="4"/>
  `),
  belt: () => S(`
    <rect class="tint" x="18" y="52" width="84" height="16" rx="8" fill="#6e5124"/>
    <rect x="50" y="46" width="20" height="28" rx="4" fill="none" stroke="#b08d4f" stroke-width="5"/>
  `)
};

export const COMBOS = [
  { id: "panuelo",  name: "Pañuelo Sena",   price: 55, art: "scarf" },
  { id: "charm",    name: "Charm Goutte",   price: 38, art: "charm" },
  { id: "correa",   name: "Correa Tejida",  price: 62, art: "strap" },
  { id: "cartera",  name: "Mini Cartera",   price: 88, art: "wallet" },
  { id: "gafas",    name: "Gafas Riviera",  price: 120, art: "sunglasses" },
  { id: "cinturon", name: "Cinturón Marco", price: 75, art: "belt" }
];

export function productSVG(product, scale) {
  const svg = bagArt[product.shape](product.color, product.accent);
  return scale ? svg.replace("<svg ", `<svg style="width:${scale}px;height:${scale}px" `) : svg;
}

export function comboSVG(combo) {
  return comboArt[combo.art]();
}

export function findItem(id) {
  return PRODUCTS.find(p => p.id === id) || COMBOS.find(c => c.id === id) || null;
}
