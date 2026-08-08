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
ni respuestas. La Function de Vercel esta implementada y validada en preview; 4B queda
cerrada con evidencia de ruta same-origin.

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

La preview de Vercel usa la misma rama y expone solo la ruta relativa
`/api/ai-closet`. La Function inyecta `MIRRORA_AI_BRIDGE_TOKEN` en servidor y reenvia al
bridge configurado por `MIRRORA_AI_BRIDGE_ORIGIN`. El incidente de autenticacion por
espacios accidentales al inicio del token quedo cubierto por el commit `8d21d56`, que
normaliza espacios de borde en el proxy y en el bridge.

```text
GET https://mirrora-style-studio-git-featu-05e60a-juanma-espinosas-projects.vercel.app/api/ai-closet/closet?campaign=vercel-preview
-> { "schema": "ai-closet-closet-response/v0.1", "campaignId": "vercel-preview", "items": [] }
```

## Fase 5A: contrato y proveedor apagado

El bridge admite categorizacion y eliminacion de fondo solo para fixtures explicitamente
autorizados en `processing.mjs`. Cada job conserva estado, resultado, numero de intentos
y puede borrarse. El adaptador inicial es simulado: sirve para validar el contrato y el
flujo sin enviar imagenes a terceros.

La seleccion de proveedor vive solo en el backend:

```text
MIRRORA_AI_ASSET_PROVIDER=simulated
MIRRORA_AI_ASSET_PROVIDER=openai
```

`simulated` es el valor por defecto y mantiene el entorno sin coste ni llamadas externas.
`openai` activa la categorizacion real en backend con Responses API si existe
`OPENAI_API_KEY`. Si falta la clave, devuelve `provider_not_configured`. La eliminacion
de fondo real sigue bloqueada en 5B con `provider_not_enabled`: esta fase solo cubre
categorizacion y enriquecimiento de metadata.

## Fase 5B: categorizacion OpenAI por adaptador

`mirrora-ai-bridge/providers/asset-adapters.mjs` contiene el adaptador OpenAI. El bridge
convierte el fixture autorizado a `data:image/*;base64`, llama a
`https://api.openai.com/v1/responses` desde servidor y solicita JSON estructurado con:

```json
{
  "category": "tops",
  "garmentType": "shirt",
  "material": "poplin",
  "color": "white",
  "confidence": 0.9
}
```

La respuesta se normaliza al schema interno `mirrora-garment-metadata/v0.1` e incluye
`provider`, `model`, `durationMs`, `simulated: false` y el `assetId` original. Los tests
mockean OpenAI para no consumir credito en CI y comprueban que la imagen se manda como
`input_image`, que la clave solo viaja en servidor y que `remove-background` no queda
activado accidentalmente.

Variables necesarias para validacion real en Railway staging:

```text
MIRRORA_AI_ASSET_PROVIDER=openai
OPENAI_API_KEY=<secreto en Railway>
OPENAI_MODEL=gpt-5-mini
```

Fase 5B queda implementada tecnicamente, pero no cerrada operativamente hasta ejecutar
una llamada real con fixture autorizado y documentar calidad visual, latencia y coste.

## Fase 5C: eliminacion de fondo y recorte con rembg

Repo registrado: `Juanmaes83/rembg` (`https://github.com/Juanmaes83/rembg`). Es un fork
de `danielgatis/rembg`, licencia MIT, orientado a quitar fondos desde CLI, libreria
Python, servidor HTTP o Docker.

Encaje previsto:

```text
MIRRORA PWA
-> /api/ai-closet
-> mirrora-ai-bridge
-> mirrora-rembg-service
-> PNG transparente + recorte
```

La integracion se hara como servicio backend aislado, no dentro del navegador y no como
parte de la Function de Vercel. El bridge Node seguira siendo la unica frontera publica y
llamara al servicio rembg por red privada o endpoint server-side autorizado.

Objetivo de Fase 5C:

- Procesar solo fixtures/prendas autorizadas del catalogo.
- Generar PNG con alfa real (`alphaPreserved: true`).
- Recortar al bounding box no transparente para composicion en canvas.
- Registrar `provider: "rembg"`, modelo, `durationMs`, intentos, estado y error code.
- Comparar calidad en prendas blancas, sombras, bordes finos y tejidos oscuros.
- Mantener fotos personales fuera de esta fase; try-on privado sigue siendo fase posterior.

Modelo inicial a evaluar:

```text
u2net_cloth_seg
```

Riesgos y controles:

- Peso y memoria de ONNX Runtime: desplegar separado del bridge Node.
- Primera llamada lenta por carga/descarga de modelo: medir cold start.
- Coste/creditos Railway: empezar con 1-2 fixtures y CPU.
- Calidad variable por prenda: no cerrar 5C hasta validacion visual.
- Persistencia y Cloud/R2: no se activan aqui; siguen como decision separada.

Contrato de respuesta previsto:

```json
{
  "schema": "mirrora-background-removal-result/v0.1",
  "provider": "rembg",
  "model": "u2net_cloth_seg",
  "processedAssetId": "asset-id:transparent",
  "alphaPreserved": true,
  "cropped": true,
  "durationMs": 1234
}
```

Fase 5C.1/5C.2 queda implementada en codigo, pero no cerrada operativamente hasta
desplegar el servicio, procesar una prenda real autorizada y documentar calidad visual,
latencia, memoria y coste.

Variables del bridge para activar rembg:

```text
MIRRORA_AI_BACKGROUND_PROVIDER=rembg
MIRRORA_REMBG_ORIGIN=<origen server-side del servicio rembg>
MIRRORA_REMBG_TOKEN=<secreto interno compartido con rembg>
MIRRORA_REMBG_TIMEOUT_MS=20000
```

Variables del servicio `mirrora-rembg-service`:

```text
MIRRORA_REMBG_TOKEN=<secreto interno>
MIRRORA_REMBG_MODEL=u2net_cloth_seg
MIRRORA_REMBG_MAX_BYTES=8388608
MIRRORA_REMBG_OUTPUT_DIR=/tmp/mirrora-rembg
MIRRORA_REMBG_ROOT_DIR=.
PORT=7000
```

Regla de aislamiento: `MIRRORA_AI_ASSET_PROVIDER=openai` puede estar activo para
categorizacion mientras `MIRRORA_AI_BACKGROUND_PROVIDER=simulated` o `rembg` controla
eliminacion de fondo. 5B y 5C no comparten proveedor ni credenciales.

### Argumentacion: prendas reales

La necesidad principal no es crear dibujos ni iconos de prendas. MIRRORA debe permitir
que una marca, estilista o usuario incorpore prendas reales del armario fisico o del
catalogo fotografiado. La funcion de `rembg` en esta fase es transformar una foto normal
en un asset usable por el sistema visual:

```text
foto real de prenda
-> upload seguro a /api/ai-closet
-> validacion de tipo, tamano, origen y consentimiento de uso
-> mirrora-ai-bridge
-> mirrora-rembg-service
-> PNG transparente + recorte
-> prenda procesada disponible en armario/canvas
```

Que conseguimos:

- La coleccion deja de depender solo de assets ya preparados.
- Una prenda fisica puede convertirse en objeto componible del canvas.
- El canvas puede mover, escalar, ordenar y combinar imagenes reales con alfa.
- La categorizacion de Fase 5B puede enriquecer despues la prenda con tipo, material,
  color y metadata editorial.
- El flujo se mantiene seguro: el navegador nunca recibe claves ni llama a proveedores.

Controles minimos para aceptar la prenda:

- Imagen subida por usuario autorizado o fixture de catalogo aprobado.
- Formato permitido: `image/png`, `image/jpeg` o `image/webp`.
- Limite de peso y dimensiones antes de procesar.
- Resultado temporal hasta que se apruebe persistencia.
- Borrado del asset temporal y del resultado procesado.
- Registro de proveedor, modelo, duracion, estado, intentos y errores.

### Argumentacion: personas y maniqui privado

La foto de una persona tiene una naturaleza distinta a la foto de una prenda. Puede ser
necesaria para usar una imagen de cuerpo entero como maniqui realista dentro del canvas,
pero no debe tratarse como un asset ordinario de catalogo. En esta fase se documenta el
flujo y las reglas; no se activa try-on privado ni persistencia publica.

```text
foto de cuerpo entero
-> consentimiento explicito
-> upload seguro a /api/ai-closet
-> validacion de tipo, tamano y finalidad
-> eliminacion opcional de fondo
-> asset temporal privado
-> uso como maniqui/referencia en canvas
-> TTL + borrado verificable
```

Que conseguimos:

- El usuario puede componer looks sobre una referencia humana realista, no sobre dibujos.
- La experiencia se acerca al objetivo de armario personal sin prometer talla ni ajuste
  fisico.
- La misma interfaz puede soportar maniqui editorial, foto local o futura prueba privada.
- Se mantiene separada la composicion editorial del try-on real con IA.

Reglas obligatorias para personas:

- Consentimiento claro antes de subir o procesar la foto.
- Uso limitado a maniqui/referencia privada salvo aprobacion posterior.
- TTL corto para foto original y resultado procesado.
- Borrado verificable desde la interfaz o gateway.
- No exposicion en URLs publicas indexables.
- No almacenamiento permanente sin politica aprobada.
- No uso para entrenar modelos ni compartir con proveedores fuera del contrato aceptado.

### Como se hara sin romper la plataforma

Fase 5C se implementa como modulo puente, no como reescritura de MIRRORA:

```text
MIRRORA PWA
-> /api/ai-closet
-> mirrora-ai-bridge
-> mirrora-rembg-service
-> resultado temporal versionado
```

El bridge conserva la frontera publica, valida payloads, aplica limites, emite jobs y
normaliza resultados. `mirrora-rembg-service` hace solo una cosa: quitar fondo y devolver
un asset transparente/cortado. La persistencia definitiva, Cloud/R2 y try-on privado
siguen siendo decisiones separadas para evitar mezclar seguridad, coste y datos personales
en el mismo cambio.

Estado actual:

- 5C.1 base segura: implementada en `mirrora-rembg-service`.
- 5C.2 adaptador bridge: implementado con `MIRRORA_AI_BACKGROUND_PROVIDER`.
- 5C.3 prendas reales: implementada como prototipo local con upload validado,
  antes/despues, asset temporal, canvas y borrado.
- 5C.4 personas/maniqui: pendiente de consentimiento, TTL y borrado verificable.

### Fase 5C.3: prendas reales locales

La UI de Armario acepta una foto local de prenda y la convierte en asset temporal del
canvas sin persistencia permanente.

Flujo implementado:

```text
input file local
-> validacion frontend: JPEG/PNG/WebP, maximo 8 MB
-> payload versionado ai-closet-asset-request/v0.1
-> POST /api/ai-closet/remove-background
-> validacion backend de tipo, tamano y data URL
-> job de processing
-> ficha antes/despues
-> boton Anadir al lienzo
-> mover, escalar, girar, capas, quitar del lienzo
-> borrar temporal
```

Contrato extendido para upload local:

```json
{
  "schema": "ai-closet-asset-request/v0.1",
  "assetId": "local-garment-001",
  "upload": {
    "fileName": "camisa.png",
    "contentType": "image/png",
    "size": 123456,
    "dataUrl": "data:image/png;base64,..."
  }
}
```

Controles implementados:

- El upload solo se acepta para `remove-background`; `categorize` lo rechaza.
- Formatos permitidos: `image/png`, `image/jpeg`, `image/webp`.
- Limite de tamano: 8 MB.
- Sin R2, sin URL publica y sin persistencia permanente.
- Prenda local guardada solo en memoria de la sesion del navegador.
- Borrado temporal elimina la prenda del listado y del canvas.

Estado visual validado:

- La seccion `Subidas` aparece tras cargar una prenda.
- La ficha muestra comparacion `Antes` / `Despues`.
- El item temporal entra en el canvas.
- Los controles de escala y giro actualizan el item.
- Viewport movil validado con el item en canvas.

Limitacion honesta:

Con `MIRRORA_AI_BACKGROUND_PROVIDER=simulated`, la UI valida el circuito completo pero
no genera alfa nuevo. El PNG transparente real queda condicionado a desplegar
`mirrora-rembg-service` y configurar `MIRRORA_AI_BACKGROUND_PROVIDER=rembg`.

## Fase 5D: validacion rembg real

Objetivo: comprobar que una prenda real subida desde MIRRORA vuelve como PNG
transparente recortado generado por `rembg`, no por simulacion.

Cambio de contrato necesario para cerrar 5D:

```json
{
  "schema": "mirrora-background-removal-result/v0.1",
  "provider": "rembg",
  "model": "u2net_cloth_seg",
  "processedAssetId": "local-garment:transparent:abc123",
  "alphaPreserved": true,
  "cropped": true,
  "imageDataUrl": "data:image/png;base64,...",
  "outputBytes": 123456,
  "durationMs": 1200
}
```

`imageDataUrl` es obligatorio para validar experiencia sin R2: permite que el frontend
muestre el despues real y anada el PNG transparente al canvas en la misma sesion. No es
persistencia definitiva y no debe usarse para fotos personales permanentes.

Despliegue separado:

```text
Railway service A: MIRRORA-Style-Studio
-> bridge Node existente
-> npm run start:bridge
-> /health

Railway service B: mirrora-rembg-service
-> Dockerfile.rembg
-> /health
-> rembg + u2net_cloth_seg
```

Orden de activacion:

1. Desplegar `mirrora-rembg-service` con `Dockerfile.rembg`.
2. Validar `GET /health` del servicio rembg.
3. Activar en el bridge:

```text
MIRRORA_AI_BACKGROUND_PROVIDER=rembg
MIRRORA_REMBG_ORIGIN=https://<dominio-rembg>
MIRRORA_REMBG_TOKEN=<mismo secreto interno>
MIRRORA_REMBG_TIMEOUT_MS=60000
```

4. Redeploy del bridge.
5. Probar desde Vercel preview:

```text
Armario -> Subir foto de prenda -> procesar
-> ficha Antes/Despues
-> estado PNG transparente generado por rembg
-> Anadir al lienzo
-> mover / escalar / rotar / capas
-> borrar temporal
```

Criterios de cierre 5D:

- `/health` de `mirrora-rembg-service` en verde.
- `/api/ai-closet/remove-background` devuelve `provider: "rembg"` y
  `simulated: false`.
- La respuesta contiene `imageDataUrl` con prefijo `data:image/png;base64,`.
- El canvas usa esa imagen procesada y no la original.
- Validado con prenda blanca, prenda oscura y al menos un borde fino.
- Error controlado por token invalido, formato invalido y archivo superior al limite.

Fuera de alcance:

- R2 y URLs publicas.
- Fotos personales permanentes.
- Try-on.
- Kling/Higgsfield.
