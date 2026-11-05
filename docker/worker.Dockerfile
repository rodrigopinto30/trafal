# syntax=docker/dockerfile:1.7
#
# Python worker image (validates and publishes uploaded games).
#   target "test" → verification tools (pytest, ruff, mypy) on top of the runtime dependencies. The code is mounted as a volume.
#   target "run"  → what actually runs: runtime dependencies only, the code baked in and an unprivileged user.
# The validator itself uses only the standard library; boto3 (storage) and psycopg (queue) are the only runtime dependencies.

ARG PYTHON_VERSION=3.13

FROM python:${PYTHON_VERSION}-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app/worker

FROM base AS test
COPY worker/requirements.txt worker/requirements-dev.txt /tmp/
RUN pip install -r /tmp/requirements-dev.txt

FROM base AS run
COPY worker/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt \
    && groupadd --system --gid 10001 worker \
    && useradd --system --uid 10001 --gid worker --no-create-home worker \
    && mkdir /work && chown worker:worker /work
COPY worker/src /app/worker/src
COPY packages/shared/upload-rules.json /app/packages/shared/upload-rules.json
ENV PYTHONPATH=/app/worker/src
USER worker
CMD ["python", "-m", "trafal_worker"]
