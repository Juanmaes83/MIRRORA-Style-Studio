from __future__ import annotations

from base64 import b64decode, b64encode
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from time import perf_counter
from typing import Callable
from uuid import uuid4

from PIL import Image
from rembg import new_session, remove


SUPPORTED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
REQUEST_SCHEMA = "mirrora-background-removal-request/v0.1"
RESULT_SCHEMA = "mirrora-background-removal-result/v0.1"


@dataclass(frozen=True)
class RemovalConfig:
    model: str = "u2net_cloth_seg"
    max_bytes: int = 8 * 1024 * 1024
    output_dir: Path = Path("/tmp/mirrora-rembg")


class RemovalError(ValueError):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


def validate_payload(payload: dict, config: RemovalConfig) -> None:
    if payload.get("schema") != REQUEST_SCHEMA:
        raise RemovalError("invalid_schema", "Schema de eliminacion de fondo no soportado")
    if not str(payload.get("assetId") or "").strip():
        raise RemovalError("invalid_asset", "assetId requerido")
    content_type = str(payload.get("expectedContentType") or "").strip().lower()
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise RemovalError("unsupported_media_type", "Formato de imagen no permitido", 415)
    source_size = payload.get("sourceSize")
    if source_size is not None and int(source_size) > config.max_bytes:
        raise RemovalError("asset_too_large", "La imagen supera el limite permitido", 413)


def read_authorized_source(source: str, *, root_dir: Path, max_bytes: int) -> bytes:
    source_path = Path(str(source or ""))
    if source_path.is_absolute() or ".." in source_path.parts:
        raise RemovalError("source_not_authorized", "Ruta de imagen no autorizada", 403)
    if len(source_path.parts) < 3 or source_path.parts[0] != "catalog" or source_path.parts[1] != "images":
        raise RemovalError("source_not_authorized", "Solo se aceptan fixtures de catalog/images en 5C.1", 403)
    absolute = (root_dir / source_path).resolve()
    root = root_dir.resolve()
    if not absolute.is_relative_to(root):
        raise RemovalError("source_not_authorized", "Ruta de imagen fuera del repositorio", 403)
    if not absolute.exists():
        raise RemovalError("source_not_found", "Imagen fuente no encontrada", 404)
    data = absolute.read_bytes()
    if len(data) > max_bytes:
        raise RemovalError("asset_too_large", "La imagen supera el limite permitido", 413)
    return data


def read_data_url(data_url: str, *, content_type: str, max_bytes: int) -> bytes:
    prefix = f"data:{content_type};base64,"
    if not isinstance(data_url, str) or not data_url.startswith(prefix):
        raise RemovalError("invalid_upload", "dataUrl no coincide con el contentType declarado")
    try:
        data = b64decode(data_url[len(prefix):], validate=True)
    except Exception as exc:
        raise RemovalError("invalid_upload", "Imagen base64 invalida") from exc
    if len(data) > max_bytes:
        raise RemovalError("asset_too_large", "La imagen supera el limite permitido", 413)
    return data


def crop_alpha_png(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RemovalError("empty_alpha", "El resultado no conserva sujeto visible", 422)
    return rgba.crop(bounds)


def remove_background(
    source_bytes: bytes,
    *,
    asset_id: str,
    config: RemovalConfig,
    remove_impl: Callable[..., bytes] = remove,
    session_factory: Callable[[str], object] = new_session,
) -> dict:
    if len(source_bytes) > config.max_bytes:
        raise RemovalError("asset_too_large", "La imagen supera el limite permitido", 413)

    started = perf_counter()
    session = session_factory(config.model)
    transparent_bytes = remove_impl(source_bytes, session=session)
    cropped = crop_alpha_png(Image.open(BytesIO(transparent_bytes)))

    config.output_dir.mkdir(parents=True, exist_ok=True)
    processed_asset_id = f"{asset_id}:transparent:{uuid4().hex[:12]}"
    output_path = config.output_dir / f"{processed_asset_id.replace(':', '-')}.png"
    output_buffer = BytesIO()
    cropped.save(output_buffer, format="PNG")
    output_bytes = output_buffer.getvalue()
    if len(output_bytes) > config.max_bytes:
        raise RemovalError("processed_asset_too_large", "El PNG procesado supera el limite permitido", 413)
    output_path.write_bytes(output_bytes)

    return {
        "schema": RESULT_SCHEMA,
        "provider": "rembg",
        "model": config.model,
        "processedAssetId": processed_asset_id,
        "alphaPreserved": True,
        "cropped": True,
        "imageDataUrl": f"data:image/png;base64,{b64encode(output_bytes).decode('ascii')}",
        "outputBytes": len(output_bytes),
        "outputPath": str(output_path),
        "durationMs": int((perf_counter() - started) * 1000),
    }
