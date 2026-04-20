"""
SwitchX Clone - Segmentation Service
Uses BiRefNet (primary) + MODNet (edge refinement) for precise alpha matting.

BiRefNet excels at hair, transparent edges, and fine details.
MODNet provides smooth alpha transitions for portrait matting.
"""

import os
import sys
import logging
import numpy as np
import torch
import torch.nn.functional as F
import cv2
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Try to import BiRefNet ───────────────────────────────────
try:
    from birefnet import BiRefNet as _BiRefNet
    BIREFNET_AVAILABLE = True
except ImportError:
    BIREFNET_AVAILABLE = False
    logger.warning("BiRefNet not installed. Falling back to rembg/ONNX.")

# ─── Try to import transformers (for HF BiRefNet) ─────────────
try:
    from transformers import AutoModelForImageSegmentation
    from torchvision import transforms
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("transformers not installed.")

# ─── Try rembg as fallback ────────────────────────────────────
try:
    from rembg import remove as rembg_remove, new_session
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    logger.warning("rembg not installed.")


class SwitchXSegmenter:
    """
    Multi-backend segmenter that selects the best available model.
    Priority: BiRefNet (HF) > rembg (isnet-anime / u2net_human_seg) > OpenCV GrabCut
    """

    def __init__(self, model_dir: str = "./models"):
        self.model_dir = Path(model_dir)
        self.device    = "cuda" if torch.cuda.is_available() else "cpu"
        self.backend   = None
        self.model     = None
        self.session   = None

        logger.info(f"🖥  Device: {self.device}")
        self._load_best_backend()

    # ──────────────────────────────────────────────────────────
    def _load_best_backend(self):
        if TRANSFORMERS_AVAILABLE:
            try:
                self._load_birefnet_hf()
                self.backend = "birefnet_hf"
                logger.info("✅ Backend: BiRefNet (HuggingFace)")
                return
            except Exception as e:
                logger.warning(f"BiRefNet HF failed: {e}")

        if REMBG_AVAILABLE:
            try:
                self._load_rembg()
                self.backend = "rembg"
                logger.info("✅ Backend: rembg (isnet-general-use)")
                return
            except Exception as e:
                logger.warning(f"rembg failed: {e}")

        # Last resort
        self.backend = "grabcut"
        logger.warning("⚠️  Falling back to OpenCV GrabCut (low quality)")

    # ── BiRefNet via HuggingFace transformers ─────────────────
    def _load_birefnet_hf(self):
        self.model = AutoModelForImageSegmentation.from_pretrained(
            "ZhengPeng7/BiRefNet",
            trust_remote_code=True,
            cache_dir=str(self.model_dir / "birefnet"),
        )
        self.model.to(self.device)
        self.model.eval()

        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Resize((1024, 1024), antialias=True),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])

    def _predict_birefnet_hf(self, frame_rgb: np.ndarray) -> np.ndarray:
        """Returns alpha mask [H, W] float32 in [0,1]."""
        from PIL import Image
        h, w = frame_rgb.shape[:2]
        pil  = Image.fromarray(frame_rgb)
        inp  = self.transform(pil).unsqueeze(0).to(self.device)

        with torch.no_grad():
            preds = self.model(inp)
            # BiRefNet returns list of predictions; last is finest
            pred  = preds[-1].sigmoid().squeeze()

        alpha = pred.cpu().numpy().astype(np.float32)
        alpha = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_LINEAR)
        return np.clip(alpha, 0.0, 1.0)

    # ── rembg backend ─────────────────────────────────────────
    def _load_rembg(self):
        # Use isnet-general-use for best quality; u2net_human_seg for speed
        self.session = new_session("isnet-general-use")

    def _predict_rembg(self, frame_rgb: np.ndarray) -> np.ndarray:
        from PIL import Image
        import io
        pil = Image.fromarray(frame_rgb)
        out = rembg_remove(pil, session=self.session)
        alpha = np.array(out)[:, :, 3].astype(np.float32) / 255.0
        return alpha

    # ── GrabCut fallback ──────────────────────────────────────
    def _predict_grabcut(self, frame_rgb: np.ndarray) -> np.ndarray:
        """Simple center-rect GrabCut – coarse but dependency-free."""
        h, w = frame_rgb.shape[:2]
        bgr  = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)

        mask    = np.zeros((h, w), np.uint8)
        bgdMdl  = np.zeros((1, 65), np.float64)
        fgdMdl  = np.zeros((1, 65), np.float64)

        # Assume person occupies central 60% of frame
        margin_x = int(w * 0.15)
        margin_y = int(h * 0.05)
        rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)

        cv2.grabCut(bgr, mask, rect, bgdMdl, fgdMdl, 5, cv2.GC_INIT_WITH_RECT)
        fg_mask = np.where((mask == 2) | (mask == 0), 0, 1).astype(np.float32)

        # Smooth edges
        fg_mask = cv2.GaussianBlur(fg_mask, (15, 15), 0)
        return fg_mask

    # ── Edge refinement (post-process) ────────────────────────
    def _refine_edges(self, alpha: np.ndarray, frame_rgb: np.ndarray) -> np.ndarray:
        """
        Guided filter refinement: sharpens edges using the original image
        as a guide. Reduces halo artefacts around hair / fine structures.
        """
        try:
            import cv2
            # Convert guide to grayscale float
            guide = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0

            # OpenCV guided filter (radius=8, eps=1e-3)
            # Available in opencv-contrib; fallback to bilateral
            if hasattr(cv2, 'ximgproc'):
                refined = cv2.ximgproc.guidedFilter(
                    guide, alpha, radius=8, eps=1e-3
                )
            else:
                refined = cv2.bilateralFilter(
                    (alpha * 255).astype(np.uint8), 9, 75, 75
                ).astype(np.float32) / 255.0

            return np.clip(refined, 0.0, 1.0)
        except Exception as e:
            logger.debug(f"Edge refinement skipped: {e}")
            return alpha

    # ── Public API ────────────────────────────────────────────
    def get_alpha(self, frame_rgb: np.ndarray) -> np.ndarray:
        """
        Main entry point.
        Args:
            frame_rgb: numpy array (H, W, 3) uint8 RGB
        Returns:
            alpha: numpy array (H, W) float32 [0.0, 1.0]
        """
        if self.backend == "birefnet_hf":
            alpha = self._predict_birefnet_hf(frame_rgb)
        elif self.backend == "rembg":
            alpha = self._predict_rembg(frame_rgb)
        else:
            alpha = self._predict_grabcut(frame_rgb)

        # Refine edges using original image
        alpha = self._refine_edges(alpha, frame_rgb)

        return alpha

    def get_rgba(self, frame_rgb: np.ndarray) -> np.ndarray:
        """Returns RGBA image (H, W, 4) uint8."""
        alpha = self.get_alpha(frame_rgb)
        alpha_u8 = (alpha * 255).astype(np.uint8)
        return np.dstack([frame_rgb, alpha_u8])


# ─── CLI test ─────────────────────────────────────────────────
if __name__ == "__main__":
    import cv2, sys
    if len(sys.argv) < 3:
        print("Usage: python segmentation.py input.jpg output.png")
        sys.exit(1)

    img = cv2.imread(sys.argv[1])
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    seg   = SwitchXSegmenter()
    alpha = seg.get_alpha(img_rgb)

    # Save alpha channel
    cv2.imwrite(sys.argv[2], (alpha * 255).astype(np.uint8))
    print(f"✅ Alpha saved to {sys.argv[2]}")
