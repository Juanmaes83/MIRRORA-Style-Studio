# MIRRORA Style Studio

PWA de consumidor: motor de decisión y conversión para moda.

```
descubrir look → identidad de estilo → avatar → probar/combinar → guardar → QR/móvil → carrito
```

Repo independiente del ecosistema (no vive dentro de Escaparates Pro). El blueprint
completo de arquitectura está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Estado — Fase 1 (v0.1)

- ✅ Catálogo piloto (categoría: bolsos, 8 piezas, arte SVG propio)
- ✅ Avatar nivel 1: editorial, paramétrico, **sin foto ni datos biométricos**
- ✅ Estudio: órbita de combinaciones + sobre de selección
- ✅ Looks guardados y wishlist (sesión anónima por dispositivo, localStorage)
- ✅ QR handoff (`mirrora-handoff/v0.1`) — el payload nunca lleva datos personales
- ✅ CTA a carrito white-label (plantilla en `js/data/brand.js`)
- ✅ Funnel de eventos local con endpoint conmutables (`js/analytics.js`)
- ✅ PWA: manifest + service worker cache-first
- ✅ **Consola de marca** (`console.html`): identidad, tema, recompensa, carrito,
  retención, catálogo de campaña activable, vista previa en vivo, export/import JSON
  y **QR de handoff de campaña** (lado emisor de Fase 2, listo para que
  Escaparates/Gesture Lab lo rendericen junto al CTA “Pruébatelo en tu móvil”)

Pendiente: integración física del QR en Escaparates/Gesture Lab (Fase 2),
`mirrora-tryon-gateway` (niveles 2 y 3 de avatar), backend de eventos.

## Stack

HTML + CSS + JavaScript vanilla (ES modules). **Sin frameworks, sin CDNs, sin assets
externos.** Única dependencia vendorizada: `js/lib/qrcode.js`
([qrcode-generator 1.4.4](https://www.npmjs.com/package/qrcode-generator), MIT,
Kazuhiko Arase).

## Desarrollo local

```bash
npx serve .
```

(ES modules requieren servidor; no abrir `index.html` con `file://`.)

## Estructura

```
index.html            shell de la SPA/PWA
console.html          consola de marca (white-label + QR de campaña)
js/console.js         lógica de la consola
css/console.css       estilos de la consola
css/mirrora.css       sistema de diseño (ivory/ink/brass, editorial)
js/app.js             navegación y vistas
js/store.js           estado + localStorage (sesión anónima por dispositivo)
js/avatar.js          avatar nivel 1 paramétrico (SVG)
js/analytics.js       funnel: seleccion → qr → sesion → look → carrito
js/qr-handoff.js      schema mirrora-handoff/v0.1 (in & out)
js/data/brand.js      contrato de consola de marca (white-label)
js/data/catalog.js    catálogo piloto + complementos (SVG inline)
js/lib/qrcode.js      vendored, MIT
sw.js                 service worker cache-first
```

## Reglas duras (del blueprint)

1. Esta PWA no ejecuta IA pesada; el try-on real vivirá en `mirrora-tryon-gateway`.
2. El QR/handoff nunca transporta datos personales ni faciales.
3. No se promete talla ni ajuste físico; el avatar es una interpretación editorial.
4. Componentes de producción sin Babel/Tailwind/React desde CDN.
