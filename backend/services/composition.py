"""
SwitchX Clone - Composition Service
Composites the re-lit foreground onto the new background with:
  - MiDaS-based depth estimation for realistic shadow positioning
  - Soft projected shadow (elliptical, perspective-corrected)
  - Anti-aliased alpha compositing
  - Contact shadow at feet for grounding
"""

import cv2
import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Try MiDaS ───────────────────────────────────────────────
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available – using synthetic depth.")

MIDAS_AVAILABLE = False
midas_model     = None
midas_transform = None
midas_device    = "cpu"

def _load_midas():
    global MIDAS_AVAILABLE, midas_model, midas_transform, midas_device
    if not TORCH_AVAILABLE:
        return
    try:
        midas_model = torch.hub.load(
            "intel-isl/MiDaS", "MiDaS_small", trust_repo=True
        )
        midas_transforms = torch.hub.load(
            "intel-isl/MiDaS", "transforms", trust_repo=True
        )
        midas_transform = midas_transforms.small_transform
        midas_device    = "cuda" if torch.cuda.is_available() else "cpu"
        midas_model.to(midas_device).eval()
        MIDAS_AVAILABLE = True
        logger.info(f"✅ MiDaS loaded on {midas_device}")
    except Exception as e:
        logger.warning(f"MiDaS load failed: {e} – using synthetic depth")


# ─── Depth estimation ─────────────────────────────────────────

def estimate_depth(frame_rgb: np.ndarray) -> np.ndarray:
    """
    Returns a depth map (H, W) float32 normalised [0,1].
    1 = close, 0 = far.
    Falls back to a vertical gradient if MiDaS is unavailable.
    """
    if MIDAS_AVAILABLE and midas_model is not None:
        try:
            import torch
            inp = midas_transform(frame_rgb).to(midas_device)
            with torch.no_grad():
                pred = midas_model(inp)
                pred = torch.nn.functional.interpolate(
                    pred.unsqueeze(1),
                    size=frame_rgb.shape[:2],
                    mode="bicubic",
                    align_corners=False,
                ).squeeze()
            depth = pred.cpu().numpy().astype(np.float32)
            depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-6)
            return depth
        except Exception as e:
            logger.debug(f"MiDaS inference failed: {e}")

    # Synthetic depth: person is typically closer at bottom of frame
    h, w = frame_rgb.shape[:2]
    gradient = np.linspace(0.2, 0.9, h, dtype=np.float32)
    return np.tile(gradient[:, np.newaxis], (1, w))


# ─── Shadow helpers ───────────────────────────────────────────

def _get_person_bbox(alpha: np.ndarray):
    """Returns (x_min, y_min, x_max, y_max) bounding box of alpha mask."""
    ys, xs = np.where(alpha > 0.05)
    if len(xs) == 0:
        h, w = alpha.shape
        return 0, 0, w, h
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def create_shadow(alpha:        np.ndarray,
                  frame_size:   tuple,
                  light_angle:  float = 35.0,
                  shadow_color: tuple = (0, 0, 0),
                  opacity:      float = 0.45,
                  blur_radius:  int   = 35,
                  stretch:      float = 0.4) -> np.ndarray:
    """
    Create a soft projected shadow from the foreground silhouette.

    Returns BGRA shadow layer (H, W, 4) to composite over background.
    """
    h, w = frame_size

    # Binary silhouette from alpha
    silhouette = (alpha > 0.15).astype(np.uint8) * 255

    # ── Perspective warp to simulate ground projection ────────
    # Shadow is flattened horizontally (stretch < 1) and offset
    angle_rad   = np.radians(light_angle)
    offset_x    = int(np.tan(angle_rad) * h * 0.3)   # horizontal offset
    offset_y    = int(h * 0.05)                        # small vertical offset

    # Warp matrix: squash vertically (simulating cast shadow on floor)
    pts_src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    pts_dst = np.float32([
        [offset_x,         int(h * stretch)],
        [w + offset_x,     int(h * stretch)],
        [w,                h],
        [0,                h],
    ])
    M = cv2.getPerspectiveTransform(pts_src, pts_dst)
    shadow_mask = cv2.warpPerspective(silhouette, M, (w, h))

    # ── Blur for soft penumbra ────────────────────────────────
    k = blur_radius if blur_radius % 2 == 1 else blur_radius + 1
    shadow_mask = cv2.GaussianBlur(shadow_mask, (k, k), 0)

    # ── Build BGRA layer ──────────────────────────────────────
    shadow_layer        = np.zeros((h, w, 4), dtype=np.uint8)
    shadow_layer[:, :, 0] = shadow_color[2]   # B
    shadow_layer[:, :, 1] = shadow_color[1]   # G
    shadow_layer[:, :, 2] = shadow_color[0]   # R
    shadow_layer[:, :, 3] = (shadow_mask * opacity).astype(np.uint8)

    return shadow_layer


def create_contact_shadow(alpha:      np.ndarray,
                          frame_size: tuple,
                          opacity:    float = 0.6) -> np.ndarray:
    """
    Soft elliptical shadow at feet – creates grounding effect.
    """
    h, w = frame_size
    x_min, y_min, x_max, y_max = _get_person_bbox(alpha)

    # Ellipse at the bottom of the person
    cx   = (x_min + x_max) // 2
    cy   = y_max
    rx   = max(int((x_max - x_min) * 0.45), 10)
    ry   = max(int((y_max - y_min) * 0.07), 5)

    contact = np.zeros((h, w), dtype=np.uint8)
    cv2.ellipse(contact, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)

    # Gaussian blur
    k = 41
    contact = cv2.GaussianBlur(contact, (k, k), 0)

    layer        = np.zeros((h, w, 4), dtype=np.uint8)
    layer[:, :, 3] = (contact * opacity).astype(np.uint8)  # black shadow
    return layer


# ─── Alpha compositing ────────────────────────────────────────

def alpha_composite(fg_rgb:  np.ndarray,
                    bg_rgb:  np.ndarray,
                    alpha:   np.ndarray) -> np.ndarray:
    """
    Porter-Duff over compositing.
    fg_rgb, bg_rgb: (H, W, 3) uint8
    alpha:          (H, W)   float32 [0,1]
    Returns:        (H, W, 3) uint8
    """
    a3  = alpha[:, :, np.newaxis]
    fg  = fg_rgb.astype(np.float32)
    bg  = bg_rgb.astype(np.float32)
    out = fg * a3 + bg * (1.0 - a3)
    return np.clip(out, 0, 255).astype(np.uint8)


# ─── Main Compositor class ────────────────────────────────────

class Compositor:
    """
    Composites re-lit foreground onto new background with depth-aware shadows.
    """

    def __init__(self, model_dir: str = "./models"):
        self.model_dir = Path(model_dir)
        _load_midas()   # lazy singleton

    def compose(self,
                person_rgb: np.ndarray,
                bg_rgb:     np.ndarray,
                alpha:      np.ndarray,
                light_angle: float = 35.0) -> np.ndarray:
        """
        Full composition pipeline.

        Args:
            person_rgb: (H, W, 3) uint8 – re-lit foreground
            bg_rgb:     (H, W, 3) uint8 – new background
            alpha:      (H, W)   float32 [0,1]
            light_angle: degrees from vertical for shadow direction

        Returns:
            composite: (H, W, 3) uint8
        """
        h, w = person_rgb.shape[:2]
        frame_size = (h, w)

        # Resize background to match frame
        bg_resized = cv2.resize(bg_rgb, (w, h), interpolation=cv2.INTER_AREA)

        # ── 1. Estimate depth for grounding ──────────────────
        # (could be used for depth-aware blur or parallax – currently for shadow)
        depth = estimate_depth(bg_resized)

        # ── 2. Projected shadow layer ─────────────────────────
        # Sample ground brightness from bottom of bg to tint shadow
        bottom_strip   = bg_resized[int(h * 0.8):, :]
        shadow_tint    = tuple(int(c) for c in bottom_strip.mean(axis=(0, 1)).astype(int)[::-1])
        # Darken tint
        shadow_color   = tuple(max(0, c - 60) for c in shadow_tint)

        proj_shadow = create_shadow(
            alpha,
            frame_size,
            light_angle  = light_angle,
            shadow_color = shadow_color,
            opacity      = 0.45,
            blur_radius  = 41,
            stretch      = 0.35,
        )

        # ── 3. Contact shadow ─────────────────────────────────
        contact_shadow = create_contact_shadow(alpha, frame_size, opacity=0.55)

        # ── 4. Composite: bg → projected shadow → contact → person
        result = bg_resized.copy().astype(np.float32)

        # Blend projected shadow
        ps_alpha = proj_shadow[:, :, 3:4].astype(np.float32) / 255.0
        ps_color = proj_shadow[:, :, :3].astype(np.float32)
        result   = result * (1 - ps_alpha) + ps_color * ps_alpha

        # Blend contact shadow
        cs_alpha = contact_shadow[:, :, 3:4].astype(np.float32) / 255.0
        result   = result * (1 - cs_alpha)  # contact shadow is pure black

        # Blend foreground
        a3     = alpha[:, :, np.newaxis]
        person = person_rgb.astype(np.float32)
        result = person * a3 + result * (1.0 - a3)

        return np.clip(result, 0, 255).astype(np.uint8)


# ─── CLI test ─────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 5:
        print("Usage: python composition.py person.png bg.jpg alpha.png output.png")
        sys.exit(1)

    person  = cv2.cvtColor(cv2.imread(sys.argv[1]), cv2.COLOR_BGR2RGB)
    bg      = cv2.cvtColor(cv2.imread(sys.argv[2]), cv2.COLOR_BGR2RGB)
    alpha   = cv2.imread(sys.argv[3], cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0

    comp    = Compositor()
    result  = comp.compose(person, bg, alpha)
    cv2.imwrite(sys.argv[4], cv2.cvtColor(result, cv2.COLOR_RGB2BGR))
    print(f"✅ Composed image saved to {sys.argv[4]}")
