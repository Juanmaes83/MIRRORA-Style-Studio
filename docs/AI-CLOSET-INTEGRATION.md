# AI Closet Integration

MIRRORA consume AI Closet como capacidad externa, no como app embebida.

## Encaje

```text
Fashion-Studio-SOL/packages/ai-closet-engine
-> catalogo, looks y prendas reales
-> MIRRORA PWA
-> /api/ai-closet
-> mirrora-ai-bridge
-> proveedor IA licenciado
```

## Lo que se puede reutilizar de ai-closet

- Armario/closet como experiencia de decision.
- Canvas de outfits, portado a web.
- Flujo de fondo transparente.
- Flujo de categorizacion visual.
- Try-on con estado, polling y resultado.

## Lo que no se copia

- App Expo completa.
- Dependencias React Native.
- Llamadas directas a OpenAI, Fal o Kling desde frontend.
- Claves `EXPO_PUBLIC_*`.

## Contrato de gateway

MIRRORA solo habla con `/api/ai-closet`:

```text
GET    /closet?campaign=<id>
POST   /try-on
GET    /try-on/:jobId
GET    /try-on/:jobId/result
DELETE /try-on/:jobId
```

La version de transporte es `ai-closet-gateway/v0.1`. La fuente canonica del contrato
vive en Fashion-Studio-SOL: `packages/ai-closet-engine/gateway-contract.v0.1.json`.
MIRRORA declara la misma version y sus pruebas comprueban rutas, payloads e
`Idempotency-Key`; no mantiene una copia divergente del schema.

Antes de una operacion de IA sobre un asset, el cliente envia:

```json
{
  "schema": "ai-closet-asset-request/v0.1",
  "assetId": "asset-temporal-001"
}
```

El payload de try-on debe incluir consentimiento y asset temporal:

```json
{
  "schema": "mirrora-tryon-request/v0.1",
  "brandId": "brand-sol",
  "campaignId": "campaign-001",
  "lookId": "look-001",
  "itemIds": ["garment-001"],
  "consentId": "consent-001",
  "personAssetId": "asset-person-001"
}
```

## Reglas duras

- Solo el gateway toca fotos personales.
- El QR nunca transporta fotos ni datos faciales.
- El resultado tiene TTL y purge.
- No se promete talla ni fit fisico.
- El frontend no contiene claves de proveedores.
- Un look y sus prendas se validan antes de solicitar try-on; el gateway vuelve a
  comprobar pertenencia, consentimiento y caducidad.

## Fase 4A: bridge sin proveedores

`mirrora-ai-bridge/server.mjs` es el servicio aislado inicial. Implementa `GET /health`
y las rutas `/api/ai-closet` con token `Bearer`, validacion versionada, idempotencia,
limite por cliente y jobs simulados en memoria. No acepta ni persiste archivos; por tanto
no requiere bucket, signed URLs ni CORS de R2.

Para ejecutarlo localmente:

```bash
MIRRORA_AI_BRIDGE_TOKEN=un-token-local npm run start:bridge
```

La PWA seguira usando la misma ruta relativa `/api/ai-closet` cuando un proxy de entorno
encamine esas peticiones al servicio. Antes de conectar cualquier proveedor se anadiran
adaptadores auditables y almacenamiento temporal con TTL, purge y auditoria.

## Fase 4B: preview same-origin

`preview-server.mjs` sirve los archivos de la PWA y reenvia solo `/api/ai-closet/*` al
bridge en loopback. El token existe exclusivamente como variable de entorno del proceso
Node y se anade entre ambos servidores; no se serializa en HTML, JavaScript, localStorage
ni respuestas. Esta parte local esta completada. La Function de Vercel esta implementada
y cubierta por pruebas, pero la configuracion de sus variables y la verificacion en un
preview Vercel siguen pendientes; 4B no se considera cerrada hasta entonces.

### Staging en Railway y Vercel

Railway arranca `npm run start:bridge`; el proceso escucha en `0.0.0.0` y usa el `PORT`
inyectado por la plataforma. Configurar `/health` como healthcheck. En Vercel, la
Function `api/ai-closet/[...path].mjs` es el unico proxy publico: anade el token de
bridge desde sus variables server-side y elimina cualquier `Authorization` del browser.
No usar una reescritura estatica para esta responsabilidad, ya que no puede inyectar el
secreto.

### Evidencia de staging

El bridge de staging se ha desplegado en Railway con la rama
`feature/mirrora-ai-bridge`, `npm run start:bridge` y healthcheck `/health`.

```text
GET https://mirrora-style-studio-staging.up.railway.app/health
-> { "schema": "mirrora-ai-bridge-health/v0.1", "status": "ok", "providers": "simulated" }
```

Las variables presentes en Railway son solo `NODE_ENV=staging` y
`MIRRORA_AI_BRIDGE_TOKEN` (no se documenta su valor). El dominio se usa unicamente
para verificacion y para el proximo proxy de Vercel; el navegador no debe enviar ese
token ni llamar proveedores directamente.

## Preparacion tecnica de Fase 5

El bridge admite categorizacion y eliminacion de fondo solo para fixtures explicitamente
autorizados en `processing.mjs`. Cada job conserva estado, resultado, numero de intentos
y puede borrarse. El adaptador inicial es simulado: sirve para validar el contrato y el
flujo sin enviar imagenes a terceros. La integracion con OpenAI puede analizar una imagen
por URL o fichero mediante Responses, pero requerira un adaptador server-side, una clave
de entorno, URLs temporales y una aprobacion de coste y retencion antes de activarse.
Esto no constituye el inicio de la Fase 5 real: faltan proveedor, persistencia y la
validacion explicita de calidad visual, latencia y coste.
