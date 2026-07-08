# =====================================================================
#  PowerSys SaaS — production Dockerfile
#  Multi-stage build: smaller final image, no build toolchain at runtime.
# =====================================================================

# ---------- builder ---------------------------------------------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Build deps for pandapower / numpy / matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc g++ gfortran \
        libsuitesparse-dev \
        libopenblas-dev \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --user -r requirements.txt


# ---------- runtime ---------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/app/.local/bin:$PATH \
    HOME=/home/app

# Minimal runtime libraries (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libopenblas0 \
        libsuitesparse-dev \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash app

WORKDIR /app

# Copy installed packages from the builder
COPY --from=builder /root/.local /home/app/.local

# App code (own it as the non-root user)
COPY --chown=app:app . /app

# Where reports + uploads live
RUN mkdir -p /app/reports /app/uploads \
    && chown -R app:app /app

USER app

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:5000/api/health || exit 1

# Default command (overridden in docker-compose for worker / beat)
CMD ["gunicorn", "--worker-class", "eventlet", \
     "--workers", "1", \
     "--bind", "0.0.0.0:5000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--timeout", "120", \
     "main:app"]
