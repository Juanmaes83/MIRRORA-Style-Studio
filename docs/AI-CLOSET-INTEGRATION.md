# AI Closet Integration

MIRRORA consume AI Closet como capacidad externa, no como app embebida.

## Encaje

```text
Fashion-Studio-SOL/packages/ai-closet-engine
-> catalogo, looks y prendas reales
-> MIRRORA PWA
-> /api/ai-closet
-> mirrora-tryon-gateway
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

