#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SwitchX Clone – Automated Setup Script
# Compatible with: Ubuntu 20.04+, macOS 12+, Debian 11+
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ ${NC}$*"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }
step()    { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}"
cat << 'EOF'
  ███████╗██╗    ██╗██╗████████╗ ██████╗██╗  ██╗██╗  ██╗
  ██╔════╝██║    ██║██║╚══██╔══╝██╔════╝██║  ██║╚██╗██╔╝
  ███████╗██║ █╗ ██║██║   ██║   ██║     ███████║ ╚███╔╝
  ╚════██║██║███╗██║██║   ██║   ██║     ██╔══██║ ██╔██╗
  ███████║╚███╔███╔╝██║   ██║   ╚██████╗██║  ██║██╔╝ ██╗
  ╚══════╝ ╚══╝╚══╝ ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝
           Clone  –  AI Video Background Replacement
EOF
echo -e "${NC}"

# ─── System requirements ──────────────────────────────────────
step "Checking system requirements"

# Node.js
if ! command -v node &>/dev/null; then
    error "Node.js not found. Install from https://nodejs.org (≥18.0.0)"
fi
NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
[ "$NODE_VER" = "old" ] && error "Node.js ≥18 required. Current: $(node -v)"
success "Node.js $(node -v)"

# Python
PYTHON_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        VER=$("$cmd" -c "import sys; print(sys.version_info >= (3,9))" 2>/dev/null)
        [ "$VER" = "True" ] && { PYTHON_CMD="$cmd"; break; }
    fi
done
[ -z "$PYTHON_CMD" ] && error "Python ≥3.9 not found. Install from https://python.org"
success "Python $($PYTHON_CMD --version)"

# FFmpeg
if ! command -v ffmpeg &>/dev/null; then
    warn "FFmpeg not found. Install it for video processing:"
    echo "  Ubuntu/Debian: sudo apt install ffmpeg"
    echo "  macOS:         brew install ffmpeg"
    echo "  Windows:       https://ffmpeg.org/download.html"
    echo ""
    read -rp "Continue without FFmpeg? (y/N): " yn
    [[ "$yn" =~ ^[Yy]$ ]] || exit 1
else
    success "FFmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"
fi

# GPU detection
if command -v nvidia-smi &>/dev/null; then
    GPU=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    success "GPU detected: $GPU"
    INSTALL_GPU=true
else
    warn "No NVIDIA GPU detected – using CPU (slower processing)"
    INSTALL_GPU=false
fi

# ─── Backend setup ────────────────────────────────────────────
step "Installing Backend (Node.js)"
cd "$ROOT_DIR/backend"

info "Running npm install…"
npm install
success "Node.js dependencies installed"

# ─── Python virtual environment ───────────────────────────────
step "Setting up Python environment"
cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
    info "Creating virtual environment (.venv)…"
    $PYTHON_CMD -m venv .venv
fi

# Activate venv
if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
    PYTHON_CMD="python"
fi

info "Upgrading pip…"
$PYTHON_CMD -m pip install --upgrade pip --quiet

# ─── Python dependencies ──────────────────────────────────────
step "Installing Python AI dependencies"

if [ "$INSTALL_GPU" = true ]; then
    info "Installing PyTorch with CUDA support…"
    $PYTHON_CMD -m pip install torch torchvision \
        --index-url https://download.pytorch.org/whl/cu121 --quiet
else
    info "Installing PyTorch CPU…"
    $PYTHON_CMD -m pip install torch torchvision \
        --index-url https://download.pytorch.org/whl/cpu --quiet
fi

info "Installing remaining AI dependencies…"
$PYTHON_CMD -m pip install -r backend/requirements.txt --quiet
success "Python AI dependencies installed"

# ─── Frontend setup ───────────────────────────────────────────
step "Installing Frontend (React + Vite)"
cd "$ROOT_DIR/frontend"
npm install
success "Frontend dependencies installed"

# ─── Download AI models ───────────────────────────────────────
step "Downloading AI Models"
info "This may take several minutes on first run (~600 MB total)…"
cd "$ROOT_DIR"
$PYTHON_CMD scripts/download_models.py || warn "Some models failed to download (will use fallbacks)"

# ─── Create .env files ────────────────────────────────────────
step "Creating configuration files"
if [ ! -f "$ROOT_DIR/backend/.env" ]; then
    cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
    success "Created backend/.env (from .env.example)"
else
    info "backend/.env already exists – skipping"
fi

# ─── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅  SwitchX Clone installed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  🚀 To start the application:"
echo ""
echo "     Terminal 1 – Backend:"
echo "       cd backend && npm run dev"
echo ""
echo "     Terminal 2 – Frontend:"
echo "       cd frontend && npm run dev"
echo ""
echo "  🌐 Open: http://localhost:3000"
echo ""
echo "  📚 Docs: README.md"
echo ""

# Offer to start immediately
read -rp "Start both servers now? (y/N): " START
if [[ "$START" =~ ^[Yy]$ ]]; then
    info "Starting backend…"
    cd "$ROOT_DIR/backend" && npm run dev &
    BACKEND_PID=$!

    sleep 2

    info "Starting frontend…"
    cd "$ROOT_DIR/frontend" && npm run dev &
    FRONTEND_PID=$!

    echo ""
    success "Services started!"
    echo "  Backend  PID: $BACKEND_PID  → http://localhost:3001"
    echo "  Frontend PID: $FRONTEND_PID → http://localhost:3000"
    echo ""
    echo "  Press Ctrl+C to stop"
    wait
fi
