# ─────────────────────────────────────────────────────────────
# SwitchX Clone – Backend Dockerfile
# Node.js + Python + FFmpeg
# ─────────────────────────────────────────────────────────────

FROM node:20-slim AS base

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \
    ffmpeg \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Node deps ─────────────────────────────────────────────────
COPY package*.json ./
RUN npm ci --omit=dev

# ── Python deps ───────────────────────────────────────────────
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# ── App source ────────────────────────────────────────────────
COPY . .

# Create required directories
RUN mkdir -p uploads outputs frames models/birefnet models/modnet models/iclight models/midas

# ── Download models at build time (optional) ─────────────────
# Uncomment to bake models into the image (increases image size significantly):
# RUN python3 /app/../scripts/download_models.py

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
