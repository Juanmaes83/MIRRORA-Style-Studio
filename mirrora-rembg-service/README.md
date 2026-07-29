# MIRRORA rembg Service

Servicio aislado para Fase 5C. Recibe peticiones internas desde `mirrora-ai-bridge`,
quita fondo con `rembg`, recorta el alfa resultante y devuelve un resultado versionado.

Este servicio no debe llamarse desde el navegador ni desde una reescritura estatica de
Vercel. La frontera publica sigue siendo `/api/ai-closet`.

## Endpoints

```text
GET  /health
POST /remove-background
```

`POST /remove-background` requiere `Authorization: Bearer <MIRRORA_REMBG_TOKEN>`.

## Variables

```text
MIRRORA_REMBG_TOKEN=<secreto interno>
MIRRORA_REMBG_MAX_BYTES=8388608
MIRRORA_REMBG_MODEL=u2net_cloth_seg
MIRRORA_REMBG_OUTPUT_DIR=/tmp/mirrora-rembg
MIRRORA_REMBG_ROOT_DIR=.
PORT=7000
```

## Arranque local

```bash
pip install -r mirrora-rembg-service/requirements.txt
uvicorn mirrora_rembg_service.app:app --host 0.0.0.0 --port 7000
```

## Contrato

Entrada:

```json
{
  "schema": "mirrora-background-removal-request/v0.1",
  "assetId": "asset-001",
  "source": "catalog/images/asset-001.png",
  "expectedContentType": "image/png"
}
```

Salida:

```json
{
  "schema": "mirrora-background-removal-result/v0.1",
  "provider": "rembg",
  "model": "u2net_cloth_seg",
  "processedAssetId": "asset-001:transparent",
  "alphaPreserved": true,
  "cropped": true,
  "durationMs": 1234
}
```

La persistencia definitiva queda fuera de 5C.1/5C.2. El resultado inicial debe ser
temporal y purgable.
