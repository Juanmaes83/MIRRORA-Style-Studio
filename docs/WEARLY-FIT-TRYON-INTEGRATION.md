# MIRRORA ↔ Wearly — Fit-aware Virtual Try-On

**Fecha:** 2026-08-08  
**Estado:** integración arquitectónica aprobada; conexión de código pendiente.

## Contexto

MIRRORA continúa siendo la **experiencia de consumidor** dentro del ecosistema Fashion Studio SOL: catálogo, looks, wishlist, QR/handoff, carrito, CTA y experiencia white-label.

El repositorio propio:

- https://github.com/Juanmaes83/wearly

se incorpora como **Fit Intelligence + Fit-Aware Virtual Try-On Engine**.

Wearly no sustituye MIRRORA. MIRRORA presenta y convierte; Wearly razona el ajuste y genera el try-on.

## Flujo objetivo

```text
MIRRORA
→ usuario abre producto
→ selecciona talla / color / fit
→ solicita Try On
→ perfil corporal + variante canónica
→ Wearly Fit Engine
→ Fit Report
→ generación de try-on
→ resultado + explicación
→ MIRRORA
→ cambiar talla / guardar / wishlist / look / QR / carrito / CTA
```

## Qué espera MIRRORA de Wearly

- estado del job;
- progreso;
- preview cuando exista;
- resultado final;
- talla/color/fit realmente utilizados;
- Fit Report estructurado;
- severidad `too-small`, `correct` o `too-large`;
- explicación legible para “How this fits you”;
- errores recuperables;
- clave estable para restaurar un try-on ya generado.

## Qué NO debe duplicar MIRRORA

MIRRORA no debe crear otro motor paralelo para:

- cálculo de talla;
- geometría de fit;
- consecuencias de manga/largo/hombro/cintura/cadera;
- generación de mandates de fit;
- lógica de cache específica del mismo try-on.

Antes de implementar una nueva capacidad de fitting, revisar Wearly.

## Qué sigue siendo responsabilidad de MIRRORA

- UX del consumidor;
- catálogo y navegación;
- selección de variante;
- consentimiento y comunicación al usuario;
- presentación del resultado;
- comparación entre tallas;
- looks;
- wishlist;
- QR / mobile handoff;
- cart/CTA;
- white-label;
- funnel y conversión.

## Fuente de verdad de producto

MIRRORA no debe enviar a Wearly descripciones libres de producto como fuente canónica.

La variante debe venir progresivamente de Fashion Studio SOL / `fashion-schema`, alimentada por Wardrobe:

```text
Wardrobe
→ Fashion Studio SOL / fashion-schema
→ MIRRORA selecciona variante
→ Wearly calcula fit y try-on
```

## Documento maestro

La decisión completa vive en:

- `Juanmaes83/Fashion-Studio-SOL/docs/ADR/0003-wearly-fit-tryon-engine.md`
- `Juanmaes83/Fashion-Studio-SOL/docs/WEARLY-FIT-TRYON-INTEGRATION-2026-08-08.md`

Esta nota existe para que cualquier futura sesión que trabaje directamente en MIRRORA descubra la integración antes de duplicar lógica.
