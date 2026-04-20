#!/usr/bin/env python3
"""
SwitchX Clone - Model Downloader
Downloads and caches all AI models needed for the pipeline.

Models:
  1. BiRefNet  – ZhengPeng7/BiRefNet  (HuggingFace)
  2. MiDaS     – intel-isl/MiDaS     (PyTorch Hub)
  3. rembg     – isnet-general-use    (ONNX via rembg)

IC-Light weights require manual download from the official repo.
"""

import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("download_models")

ROOT     = Path(__file__).parent.parent
MODELS   = ROOT / "backend" / "models"
HF_CACHE = MODELS / "huggingface"

# Set HuggingFace cache dirs
os.environ["HF_HOME"]             = str(HF_CACHE)
os.environ["TRANSFORMERS_CACHE"]  = str(HF_CACHE)
os.environ["TORCH_HOME"]          = str(MODELS / "torch")


def ensure_deps():
    """Make sure required packages are installed."""
    missing = []
    for pkg in ["torch", "transformers", "huggingface_hub"]:
        try:
            __import__(pkg.replace("-", "_"))
        except ImportError:
            missing.append(pkg)
    if missing:
        log.error(f"Missing packages: {', '.join(missing)}")
        log.error("Run: pip install -r backend/requirements.txt")
        sys.exit(1)


def download_birefnet():
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info("1. Downloading BiRefNet (ZhengPeng7/BiRefNet)…")
    log.info("   Size: ~300 MB")
    try:
        from transformers import AutoModelForImageSegmentation
        model = AutoModelForImageSegmentation.from_pretrained(
            "ZhengPeng7/BiRefNet",
            trust_remote_code=True,
            cache_dir=str(HF_CACHE / "birefnet"),
        )
        log.info("   ✅ BiRefNet downloaded successfully")
        del model
    except Exception as e:
        log.warning(f"   ⚠️  BiRefNet download failed: {e}")
        log.warning("       Will use rembg fallback instead")


def download_midas():
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info("2. Downloading MiDaS (intel-isl/MiDaS_small)…")
    log.info("   Size: ~82 MB")
    try:
        import torch
        torch.hub.set_dir(str(MODELS / "torch" / "hub"))
        model = torch.hub.load(
            "intel-isl/MiDaS",
            "MiDaS_small",
            trust_repo=True,
        )
        log.info("   ✅ MiDaS downloaded successfully")
        del model
    except Exception as e:
        log.warning(f"   ⚠️  MiDaS download failed: {e}")
        log.warning("       Depth estimation will use synthetic gradient fallback")


def download_rembg_models():
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info("3. Downloading rembg ONNX models (isnet-general-use)…")
    log.info("   Size: ~170 MB")
    try:
        from rembg import new_session
        session = new_session("isnet-general-use")
        log.info("   ✅ rembg isnet-general-use downloaded")
        del session
    except ImportError:
        log.warning("   ⚠️  rembg not installed – skipping")
    except Exception as e:
        log.warning(f"   ⚠️  rembg model download failed: {e}")


def print_iclight_instructions():
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info("4. IC-Light (optional – requires manual download)")
    log.info("   The system works without IC-Light (uses color transfer fallback).")
    log.info("   For full IC-Light support:")
    log.info("   1. Visit: https://huggingface.co/lllyasviel/ic-light")
    log.info("   2. Download: iclight_sd15_fc.safetensors")
    log.info(f"   3. Place in: {MODELS / 'iclight' / 'iclight_sd15_fc.safetensors'}")


def main():
    log.info("🚀 SwitchX Clone – Model Downloader")
    log.info(f"   Models dir: {MODELS}")
    log.info("")

    # Create directories
    for d in [MODELS, HF_CACHE,
              MODELS / "birefnet", MODELS / "modnet",
              MODELS / "iclight",  MODELS / "midas",
              MODELS / "torch" / "hub"]:
        d.mkdir(parents=True, exist_ok=True)

    ensure_deps()
    download_birefnet()
    download_midas()
    download_rembg_models()
    print_iclight_instructions()

    log.info("")
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info("✅ Model download complete!")
    log.info("   Run the backend with: cd backend && npm run dev")
    log.info("   Run the frontend with: cd frontend && npm run dev")


if __name__ == "__main__":
    main()
