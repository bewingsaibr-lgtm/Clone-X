"""
SwitchX Clone - Main Python AI Pipeline
Orchestrates: segmentation → relighting → composition for each video frame.

Usage:
    python pipeline.py <frames_dir> <bg_path> <output_dir> [job_id]
"""

import sys
import os
import cv2
import json
import logging
import time
import traceback
import numpy as np
from pathlib import Path

# ─── Logging setup ────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("switchx.pipeline")

# ─── Add services dir to path ─────────────────────────────────
SERVICES_DIR = Path(__file__).parent
sys.path.insert(0, str(SERVICES_DIR))

from segmentation import SwitchXSegmenter
from relighting   import Relighter
from composition  import Compositor


# ─── Frame loading/saving ─────────────────────────────────────

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}

def load_frames(frames_dir: Path):
    """Return sorted list of (path, name) for all image files in frames_dir."""
    files = sorted(
        f for f in frames_dir.iterdir()
        if f.suffix.lower() in SUPPORTED_EXTS
    )
    return files


def load_rgb(path: Path) -> np.ndarray:
    """Load image as uint8 RGB."""
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {path}")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def save_rgb(path: Path, img_rgb: np.ndarray):
    """Save uint8 RGB image."""
    cv2.imwrite(str(path), cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))


# ─── Progress reporting ───────────────────────────────────────

def report_progress(current: int, total: int, job_id: str = ""):
    """Prints JSON progress to stdout (picked up by Node.js)."""
    pct = round(25 + (current / max(total, 1)) * 50)  # maps to 25–75 % range
    msg = {
        "type":    "progress",
        "job_id":  job_id,
        "current": current,
        "total":   total,
        "percent": pct,
        "message": f"Frame {current}/{total}",
    }
    print(json.dumps(msg), flush=True)


# ─── Single-frame processor ───────────────────────────────────

def process_frame(frame_rgb:  np.ndarray,
                  bg_rgb:     np.ndarray,
                  segmenter:  SwitchXSegmenter,
                  relighter:  Relighter,
                  compositor: Compositor) -> np.ndarray:
    """Full pipeline for one frame. Returns composed uint8 RGB."""

    # 1. Segment – get alpha mask
    alpha = segmenter.get_alpha(frame_rgb)                 # (H, W) float32 [0,1]

    # 2. Relight – adapt foreground colours to background lighting
    relit = relighter.relight(frame_rgb, bg_rgb, alpha)   # (H, W, 3) uint8

    # 3. Compose – place relit person over background with shadows
    result = compositor.compose(relit, bg_rgb, alpha)     # (H, W, 3) uint8

    return result


# ─── Batch processor ──────────────────────────────────────────

def process_batch(frames_dir: Path,
                  bg_rgb:     np.ndarray,
                  output_dir: Path,
                  job_id:     str = "",
                  resume:     bool = True):
    """
    Process all frames in frames_dir, save to output_dir.
    If resume=True, skips already-processed frames.
    """
    frames = load_frames(frames_dir)
    total  = len(frames)

    if total == 0:
        raise RuntimeError(f"No frames found in {frames_dir}")

    logger.info(f"📂 Processing {total} frames  job={job_id or 'N/A'}")

    # Initialise AI models (heavy – load once)
    logger.info("🔄 Loading AI models…")
    t0 = time.time()
    segmenter  = SwitchXSegmenter(model_dir="./models")
    relighter  = Relighter(model_dir="./models")
    compositor = Compositor(model_dir="./models")
    logger.info(f"✅ Models loaded in {time.time()-t0:.1f}s")

    # ── Frame loop ────────────────────────────────────────────
    errors = []
    for idx, frame_path in enumerate(frames):
        out_name = f"frame_{idx:04d}.png"
        out_path = output_dir / out_name

        if resume and out_path.exists():
            logger.debug(f"⏩ Skipping (already done): {out_name}")
            continue

        try:
            frame_rgb = load_rgb(frame_path)

            # Resize background to match each frame (frames may vary)
            h, w    = frame_rgb.shape[:2]
            bg_frame = cv2.resize(bg_rgb, (w, h), interpolation=cv2.INTER_AREA)

            result = process_frame(frame_rgb, bg_frame, segmenter, relighter, compositor)
            save_rgb(out_path, result)

        except Exception as e:
            logger.error(f"❌ Frame {idx} ({frame_path.name}): {e}")
            errors.append({"frame": idx, "error": str(e)})
            # On error: copy original frame so video stays in sync
            try:
                frame_rgb = load_rgb(frame_path)
                h, w      = frame_rgb.shape[:2]
                bg_frame  = cv2.resize(bg_rgb, (w, h), interpolation=cv2.INTER_AREA)
                save_rgb(out_path, bg_frame)
            except Exception:
                pass

        report_progress(idx + 1, total, job_id)

    logger.info(f"✅ All frames processed. Errors: {len(errors)}")
    if errors:
        error_log = output_dir / "errors.json"
        with open(error_log, "w") as f:
            json.dump(errors, f, indent=2)
        logger.warning(f"⚠️  {len(errors)} frames had errors – see {error_log}")


# ─── Entry point ──────────────────────────────────────────────

def main():
    if len(sys.argv) < 4:
        print("Usage: python pipeline.py <frames_dir> <bg_path> <output_dir> [job_id]")
        sys.exit(1)

    frames_dir = Path(sys.argv[1])
    bg_path    = Path(sys.argv[2])
    output_dir = Path(sys.argv[3])
    job_id     = sys.argv[4] if len(sys.argv) > 4 else ""

    # Validate inputs
    if not frames_dir.is_dir():
        logger.error(f"frames_dir not found: {frames_dir}")
        sys.exit(1)

    if not bg_path.exists():
        logger.error(f"background not found: {bg_path}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Load background
    logger.info(f"🖼  Background: {bg_path}")
    bg_rgb = load_rgb(bg_path)

    # Run pipeline
    try:
        process_batch(frames_dir, bg_rgb, output_dir, job_id)
        print(json.dumps({"type": "done", "job_id": job_id}), flush=True)
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}\n{traceback.format_exc()}")
        print(json.dumps({"type": "error", "job_id": job_id, "message": str(e)}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
