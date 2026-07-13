# MIRRORA Style Studio — Blueprint de arquitectura

> **Estado**: blueprint aprobado; Fase 1 (PWA v0.1) construida en este repo.
> **Fecha**: 2026-07-13

---

## 1. Meta

MIRRORA Style Studio **no es "poner ropa sobre una foto"**. Es un motor de decisión y
conversión para moda:

```
descubrir look → crear identidad de estilo → personalizar avatar → probar/combinar
→ guardar recuerdo → QR/móvil → carrito/lead/compra
```

- **El cliente** obtiene una experiencia personal, compartible y útil.
- **La marca** obtiene intención cualificada: looks guardados, escaneos QR, clics a
  carrito y una campaña white-label medible.

El diferencial **no** es copiar una extensión tipo Mira: es que una tienda pueda vender
una experiencia completa, branded y medible desde el escaparate hasta la compra personal.

---

## 2. Mapa de sistemas

Cuatro piezas, cada una con responsabilidad y límites explícitos:

### 2.1 `MIRRORA-Style-Studio` (repo nuevo, independiente)

- PWA/webapp de consumidor.
- Avatar, perfil de estilo, armario, looks, wishlist, QR, historial y CTA de compra.
- **Límite**: no vive dentro de Escaparates Pro. No ejecuta IA pesada en cliente.

### 2.2 `mirrora-tryon-gateway` (servicio nuevo, separado)

- API, cola de generación, consentimiento, caducidad/borrado, almacenamiento temporal
  y auditoría.
- Interfaz de **proveedor intercambiable**: aquí se conecta un proveedor comercial o un
  modelo autoalojado cuando haya licencia y GPU adecuadas.
- **Límite**: es el único componente que toca fotos personales. Nadie más las almacena.

### 2.3 Escaparates Pro

- Crea campañas, escenas, assets, branding y el CTA: *"Pruébatelo en tu móvil"*.
- Genera QR/handoff hacia MIRRORA.
- **Límite**: no ejecuta el motor IA pesado.

### 2.4 Rubik Sota Director de Orquesta / Gesture Lab

- Experiencia pública en tienda: navegar looks con gesto, favoritos, variantes y QR.
- **Límite**: no procesa la foto personal en una pantalla compartida. Nunca.

---

## 3. Contratos entre sistemas

### 3.1 Handoff campaña/look (Escaparates·Gesture Lab → MIRRORA)

El QR/handoff transporta **identidad de campaña y look, nunca datos personales ni
faciales**. Payload orientativo:

```json
{
  "schema": "mirrora-handoff/v0.1",
  "brand_id": "…",
  "campaign_id": "…",
  "look_id": "…",
  "source": "escaparate | gesture-lab | web",
  "cta": { "type": "cart | lead | reward", "target": "https://…" },
  "expires_at": "ISO-8601"
}
```

### 3.2 Interfaz de proveedor try-on (gateway)

```
submit(job)      → job_id            # imagen persona + prenda + consentimiento
status(job_id)   → queued|running|done|failed
result(job_id)   → imagen temporal firmada + metadatos
purge(job_id)    → borrado verificable (auditado)
```

Requisitos no negociables del gateway: consentimiento explícito registrado, TTL de
almacenamiento, borrado bajo demanda, log de auditoría, métricas de cola.

---

## 4. Tres niveles de avatar

| Nivel | Qué es | Requisitos |
|-------|--------|-----------|
| **1 — inmediato** | Avatar editorial configurable sin foto: silueta, tono, pelo, estilo, accesorios, preferencias | Sin IA pesada. Es el nivel de lanzamiento |
| **2 — foto** | Avatar a partir de foto con consentimiento explícito, opción de borrar, almacenamiento temporal controlado | Gateway + política de datos |
| **3 — try-on generativo** | Prenda real sobre persona/avatar | Gateway + proveedor/modelo + cola + métricas + política de datos |

**Regla de comunicación**: en nivel 3 no se promete talla real. Una imagen de try-on
muestra una interpretación visual, no garantiza fit físico. MediaPipe se usa para
interacción y encuadre en dispositivo; **no se presenta como identificación biométrica
ni como prueba de talla**.

---

## 5. Código y referencias de apoyo

- **Código de bolsos**: blueprint visual para el hero, el sobre de selección y la
  órbita de combinaciones. Se reconstruye como componentes de producción —
  **sin Babel/Tailwind/React desde CDN ni assets externos**.
- **Interactive Styling Canvas**: base para el configurador visual y la composición
  de prendas.
- **Escaparates Pro**: campaña, media, branding, salida QR y assets.
- **Rubik Sota Director de Orquesta**: launchers, módulos públicos, Gesture Lab y
  experiencias de tienda.
- **MediaPipe**: mano, pose y cara *en dispositivo* (Tasks). Solo interacción/encuadre.
- **CatVTON**: referencia técnica de try-on. Licencia **CC BY-NC-SA 4.0** → solo
  investigación/prototipo no comercial salvo licencia adicional. Requiere GPU
  significativa. **No es motor comercial utilizable tal cual.**
- **OOTDiffusion**: segunda referencia de investigación para comparar calidad/control.
  **Pendiente de auditoría de licencia y despliegue** antes de considerarla.

---

## 6. Fases seguras (roadmap)

1. **MIRRORA PWA**: diseño premium del código de bolsos + catálogo + avatar no
   fotográfico (nivel 1) + looks + wishlist + QR.
2. **Handoff**: conectar Escaparates y Gesture Lab mediante handoff de campaña/look,
   nunca mediante datos faciales.
3. **Consola de marca**: logo, colores, catálogo, CTA, recompensa, destino de carrito
   y reglas de retención.
4. **tryon-gateway**: implementar con interfaz de proveedor intercambiable.
5. **Piloto por categoría**: empezar con una categoría simple (bolsos, gafas o
   accesorios) → después tops → finalmente looks completos.
6. **Medición** (transversal desde fase 1): ver §7.

Cada fase debe poder demostrarse sin depender de la siguiente. El try-on generativo
(fase 4-5) no bloquea el valor comercial de las fases 1-3.

---

## 7. Funnel de medición

Eventos mínimos, en orden:

```
selección → escaneo QR → sesión iniciada → look guardado → clic a carrito → compra
```

Cada evento lleva `brand_id`, `campaign_id`, `look_id` y `source` para que la campaña
white-label sea medible de punta a punta.

---

## 8. Reglas duras (resumen)

1. MIRRORA no vive dentro de Escaparates Pro.
2. Solo el gateway toca fotos personales; con consentimiento, TTL, borrado y auditoría.
3. Ninguna pantalla compartida (escaparate, Gesture Lab) procesa fotos personales.
4. El handoff/QR nunca transporta datos personales ni faciales.
5. No prometer talla ni fit físico; no presentar MediaPipe como biometría.
6. CatVTON/OOTDiffusion son referencias de investigación, no motores comerciales
   (licencias CC BY-NC / pendiente de auditoría).
7. Componentes de producción sin CDN de Babel/Tailwind/React ni assets externos.
