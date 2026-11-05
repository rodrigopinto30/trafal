# syntax=docker/dockerfile:1.7
#
# Imagen del worker de Python (validación y procesamiento de juegos).
#   target "test" → herramientas de verificación (pytest, ruff, mypy). El código se monta como volumen.
# El validador usa solo la biblioteca estándar: no hay dependencias de ejecución.

ARG PYTHON_VERSION=3.13

FROM python:${PYTHON_VERSION}-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app/worker

FROM base AS test
COPY worker/requirements-dev.txt /tmp/requirements-dev.txt
RUN pip install -r /tmp/requirements-dev.txt
