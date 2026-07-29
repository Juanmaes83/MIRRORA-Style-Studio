from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse

from .processing import RemovalConfig, RemovalError, read_authorized_source, remove_background, validate_payload


def normalize_secret(value: str | None) -> str:
    return value.strip() if isinstance(value, str) else ""


def read_bearer(value: str | None) -> str:
    if not isinstance(value, str):
        return ""
    prefix = "bearer "
    return normalize_secret(value[len(prefix):]) if value.lower().startswith(prefix) else ""


def error(code: str, message: str) -> dict:
    return {"schema": "mirrora-rembg-error/v0.1", "error": {"code": code, "message": message}}


def create_app() -> FastAPI:
    app = FastAPI(title="MIRRORA rembg Service", version="0.1")
    token = normalize_secret(os.environ.get("MIRRORA_REMBG_TOKEN"))
    config = RemovalConfig(
        model=os.environ.get("MIRRORA_REMBG_MODEL", "u2net_cloth_seg"),
        max_bytes=int(os.environ.get("MIRRORA_REMBG_MAX_BYTES", 8 * 1024 * 1024)),
        output_dir=Path(os.environ.get("MIRRORA_REMBG_OUTPUT_DIR", "/tmp/mirrora-rembg")),
    )
    root_dir = Path(os.environ.get("MIRRORA_REMBG_ROOT_DIR", "."))

    @app.get("/health")
    async def health() -> dict:
        return {"schema": "mirrora-rembg-health/v0.1", "status": "ok", "provider": "rembg", "model": config.model}

    @app.post("/remove-background")
    async def remove_background_endpoint(request: Request, authorization: str | None = Header(default=None)):
        if not token:
            return JSONResponse(error("service_not_configured", "MIRRORA_REMBG_TOKEN requerido"), status_code=503)
        if read_bearer(authorization) != token:
            return JSONResponse(error("unauthorized", "Token de rembg invalido"), status_code=401)

        try:
            payload = await request.json()
            validate_payload(payload, config)
            source_bytes = read_authorized_source(payload.get("source"), root_dir=root_dir, max_bytes=config.max_bytes)
            result = remove_background(source_bytes, asset_id=payload["assetId"], config=config)
            return JSONResponse(result, status_code=200)
        except RemovalError as caught:
            return JSONResponse(error(caught.code, str(caught)), status_code=caught.status)
        except Exception:
            return JSONResponse(error("invalid_request", "Solicitud de rembg invalida"), status_code=400)

    return app


app = create_app()
