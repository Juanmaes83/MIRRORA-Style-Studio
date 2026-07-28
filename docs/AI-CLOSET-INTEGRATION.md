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
ni respuestas. Esto es una herramienta de preview local, no el sistema de sesion de
produccion: antes del despliegue se sustituira por autenticacion de usuario o sesion en el
borde del backend.
