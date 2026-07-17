// Avatar nivel 1 — editorial, paramétrico, sin foto ni datos biométricos.
// Se compone en SVG: silueta + tono + pelo + estilo, con la pieza y complementos del look.

import { productAvatarBody } from "./data/catalog.js";

export const AVATAR_OPTIONS = {
  silhouette: [
    { id: "a", label: "Silueta A" },
    { id: "h", label: "Silueta H" },
    { id: "o", label: "Silueta O" }
  ],
  skin: ["#f2ddc4", "#e8c39e", "#c99a6b", "#9c6b42", "#5f3f28"],
  hairStyle: [
    { id: "corto", label: "Corto" },
    { id: "melena", label: "Melena" },
    { id: "recogido", label: "Recogido" },
    { id: "rizado", label: "Rizado" }
  ],
  hairColor: ["#2f2118", "#5a3a22", "#a06a35", "#c9c2b8"],
  style: [
    { id: "minimal", label: "Minimal" },
    { id: "boho", label: "Boho" },
    { id: "sastre", label: "Sastre" },
    { id: "urbano", label: "Urbano" }
  ]
};

const STYLE_PALETTES = {
  minimal: { main: "#d8d2c6", accent: "#a49c8c" },
  boho:    { main: "#b0654f", accent: "#e0c9a6" },
  sastre:  { main: "#23211f", accent: "#8c8478" },
  urbano:  { main: "#4a5d4a", accent: "#23211f" }
};

function hairBack(style, color) {
  switch (style) {
    case "melena":
      return `<path d="M76 40 Q76 12 100 12 Q124 12 124 40 L128 96 Q114 104 100 104 Q86 104 72 96 Z" fill="${color}"/>`;
    case "rizado":
      return `<g fill="${color}">
        <circle cx="78" cy="40" r="16"/><circle cx="100" cy="26" r="18"/><circle cx="122" cy="40" r="16"/>
        <circle cx="76" cy="62" r="13"/><circle cx="124" cy="62" r="13"/><circle cx="100" cy="40" r="20"/>
      </g>`;
    case "recogido":
      return `<circle cx="100" cy="16" r="12" fill="${color}"/>
        <path d="M78 42 Q78 16 100 16 Q122 16 122 42 L122 52 Q100 44 78 52 Z" fill="${color}"/>`;
    default: // corto
      return `<path d="M76 44 Q76 14 100 14 Q124 14 124 44 L124 58 Q100 48 76 58 Z" fill="${color}"/>`;
  }
}

function hairFront(style, color) {
  if (style === "rizado") return "";
  return `<path d="M80 38 Q84 24 100 24 Q116 24 120 38 Q110 32 100 33 Q90 32 80 38 Z" fill="${color}"/>`;
}

function outfit(silhouette, pal) {
  switch (silhouette) {
    case "a":
      return `<path d="M84 88 L116 88 L142 228 Q100 240 58 228 Z" fill="${pal.main}"/>
              <path d="M84 88 L116 88 L120 108 L80 108 Z" fill="${pal.accent}" opacity="0.6"/>`;
    case "o":
      return `<path d="M82 88 L118 88 Q146 130 138 196 Q136 226 100 230 Q64 226 62 196 Q54 130 82 88 Z" fill="${pal.main}"/>
              <path d="M82 88 L118 88 L122 110 L78 110 Z" fill="${pal.accent}" opacity="0.6"/>`;
    default: // h
      return `<path d="M82 88 L118 88 L126 232 Q100 238 74 232 Z" fill="${pal.main}"/>
              <path d="M82 88 L118 88 L119 106 L81 106 Z" fill="${pal.accent}" opacity="0.6"/>`;
  }
}

/**
 * @param {object} cfg    state.avatar
 * @param {object|null} product   pieza principal seleccionada
 * @param {string[]} comboIds     complementos activos
 */
export function avatarSVG(cfg, product = null, comboIds = []) {
  const pal = STYLE_PALETTES[cfg.style] || STYLE_PALETTES.minimal;
  const has = id => comboIds.includes(id);

  const bag = product
    ? `<g transform="translate(122,168) scale(0.62)">${productAvatarBody(product)}</g>`
    : "";

  const charm = product && has("charm")
    ? `<g transform="translate(150,196) scale(0.28)">
         <path d="M60 30 L60 50" stroke="#8a7a55" stroke-width="6"/>
         <path d="M60 50 L78 72 L60 104 L42 72 Z" fill="#b08d4f"/>
       </g>` : "";

  const strap = product && has("correa")
    ? `<path d="M86 92 Q120 130 152 182" fill="none" stroke="#4a5d4a" stroke-width="7" stroke-linecap="round" stroke-dasharray="4 7"/>` : "";

  const scarf = has("panuelo")
    ? `<path d="M84 84 Q100 96 116 84 L114 92 Q100 102 86 92 Z" fill="#b0654f"/>
       <path d="M96 92 L92 122 L98 118 L102 124 L106 118 L104 92" fill="#c98a6f"/>` : "";

  const glasses = has("gafas")
    ? `<g><circle cx="90" cy="46" r="8.5" fill="#23211f" opacity="0.92"/>
       <circle cx="110" cy="46" r="8.5" fill="#23211f" opacity="0.92"/>
       <path d="M98 44 Q100 41 102 44" stroke="#23211f" stroke-width="2.5" fill="none"/></g>` : "";

  const belt = has("cinturon")
    ? `<rect x="76" y="128" width="48" height="10" rx="5" fill="#6e5124"/>
       <rect x="93" y="125" width="14" height="16" rx="3" fill="none" stroke="#b08d4f" stroke-width="3"/>` : "";

  const wallet = has("cartera")
    ? `<g transform="translate(44,176) rotate(-12)"><rect width="26" height="17" rx="4" fill="#23211f"/>
       <rect y="5" width="26" height="3" fill="#b08d4f"/></g>` : "";

  return `<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar editorial">
    <ellipse cx="100" cy="300" rx="64" ry="9" fill="rgba(22,20,18,0.10)"/>
    ${hairBack(cfg.hairStyle, cfg.hairColor)}
    <!-- cuello y cabeza -->
    <rect x="93" y="62" width="14" height="18" rx="6" fill="${cfg.skin}"/>
    <circle cx="100" cy="44" r="21" fill="${cfg.skin}"/>
    ${hairFront(cfg.hairStyle, cfg.hairColor)}
    ${glasses}
    <!-- brazos -->
    <path d="M84 92 Q62 130 56 172" fill="none" stroke="${cfg.skin}" stroke-width="11" stroke-linecap="round"/>
    <path d="M116 92 Q140 124 148 166" fill="none" stroke="${cfg.skin}" stroke-width="11" stroke-linecap="round"/>
    <!-- outfit -->
    ${outfit(cfg.silhouette, pal)}
    ${belt}
    ${scarf}
    <!-- piernas -->
    <path d="M88 230 L86 292 M112 230 L114 292" stroke="${cfg.skin}" stroke-width="12" stroke-linecap="round"/>
    <path d="M78 294 L92 294 M108 294 L122 294" stroke="${pal.accent}" stroke-width="8" stroke-linecap="round"/>
    ${strap}
    ${wallet}
    ${bag}
    ${charm}
  </svg>`;
}
