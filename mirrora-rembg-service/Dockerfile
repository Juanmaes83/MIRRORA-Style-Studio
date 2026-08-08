FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY mirrora-rembg-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY mirrora-rembg-service/mirrora_rembg_service ./mirrora_rembg_service
COPY catalog ./catalog

EXPOSE 7000
CMD ["sh", "-c", "uvicorn mirrora_rembg_service.app:app --host 0.0.0.0 --port ${PORT:-7000}"]
