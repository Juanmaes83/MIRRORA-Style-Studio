# MIRRORA Style Studio

## Estado de entrega

**Fase 2 - Diseno visual navegable: completada.**

- El armario consume las imagenes reales de `catalog/catalog.json`; no usa prendas SVG.
- El panel de detalle, el armario y los assets de catalogo real estan disponibles.

**Fase 3 - Canvas funcional local: completada.**

- El canvas permite foto local de cuerpo entero como referencia, mover, escalar, girar,
  ordenar capas, eliminar y guardar una composicion local.
- La foto de referencia no se sube ni se persiste fuera del navegador y no es try-on.
- El gateway de IA sigue siendo un contrato seguro sin claves de proveedor en frontend.

**Fase 4A - `mirrora-ai-bridge` seguro sin IA: completada.**

- Servicio Node aislado con `healthcheck`, autenticacion por token de entorno,
  validacion de schemas, limite por ventana e idempotencia de peticiones.
- Sus respuestas son simuladas y los jobs viven solo en memoria: no hay proveedor,
  subida de archivos, almacenamiento, Cloud/R2 ni CORS de bucket en esta fase.
- Ejecutar localmente con `MIRRORA_AI_BRIDGE_TOKEN=<token> npm run start:bridge`.

**Fase 4B - preview same-origin: completada y validada en Vercel.** El servidor local
entrega la PWA y encamina exclusivamente `/api/ai-closet` al bridge. El navegador no
recibe el token; el proxy loopback lo inyecta en servidor. En Vercel, la Function
`api/ai-closet/[...path].mjs` hace el mismo trabajo server-side contra Railway.
Ejecutar localmente con `MIRRORA_AI_BRIDGE_TOKEN=<token> PORT=4181 npm run start:preview`.

**Despliegue staging:** Railway ejecuta el bridge en `0.0.0.0:$PORT` y verifica
`/health`. Vercel entrega la PWA y su Function `api/ai-closet/[...path].mjs` reenvia
las rutas relativas al bridge. Sus dos variables server-side son
`MIRRORA_AI_BRIDGE_ORIGIN` y `MIRRORA_AI_BRIDGE_TOKEN`; ninguna se expone al navegador.

**Estado operativo de Fase 4:** 4A esta desplegada en Railway staging y 4B esta
validada con preview same-origin en Vercel. El bridge activo en
`https://mirrora-style-studio-staging.up.railway.app` confirma `status: "ok"` y
`providers: "simulated"`. La preview de Vercel
`https://mirrora-style-studio-git-featu-05e60a-juanma-espinosas-projects.vercel.app`
responde correctamente a `/api/ai-closet/closet?campaign=vercel-preview` con schema
`ai-closet-closet-response/v0.1` e `items: []`. No hay proveedor IA, clave de proveedor,
foto personal, R2 ni Supabase conectados en este entorno.

**Fase 5A - contrato y proveedor apagado: iniciada.** El bridge incluye un fixture real
autorizado, un selector server-side de proveedor (`MIRRORA_AI_ASSET_PROVIDER`) y un
adaptador simulado con categorizacion, resultado de fondo transparente, estado,
reintento y borrado. El valor por defecto sigue siendo `simulated`. El adaptador
`openai` esta declarado pero devuelve error controlado hasta aprobacion explicita de
Fase 5B. No existe una llamada externa, persistencia ni validacion de calidad, latencia
o coste.

**Siguiente hito:** Fase 5B, conectar categorizacion real con proveedor por adaptador y
comparar calidad visual, latencia y coste antes de persistir resultados.

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
- ✅ Contrato AI Closet via backend/proxy (`js/ai-closet-gateway.js`), sin claves IA en frontend
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
js/ai-closet-gateway.js cliente seguro hacia /api/ai-closet
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
5. AI Closet se consume mediante backend/proxy; nunca con claves de proveedor en cliente.
