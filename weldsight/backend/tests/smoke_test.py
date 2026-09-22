"""Quick check that the model loads and finds rust. Run: python -m tests.smoke_test"""
import sys
import time

import cv2
import numpy as np

from app.knowledge import kb
from app.model import segmenter


def synthetic_rust() -> np.ndarray:
    rng = np.random.default_rng(1)
    img = np.clip(np.full((480, 640, 3), (125, 128, 132), np.float32) + rng.normal(0, 6, (480, 640, 3)), 0, 255)
    mask = np.zeros((480, 640), np.uint8)
    cv2.ellipse(mask, (380, 250), (150, 100), 20, 0, 360, 255, -1)
    mask = cv2.GaussianBlur(mask, (61, 61), 0).astype(np.float32)[..., None] / 255
    rust = np.stack([rng.uniform(20, 60, (480, 640)), rng.uniform(60, 110, (480, 640)), rng.uniform(120, 190, (480, 640))], -1)
    return (img * (1 - mask) + rust * mask).astype(np.uint8)


def main() -> int:
    t = time.time()
    if not segmenter.load():
        print("FAIL: model did not load:", segmenter.error)
        return 1
    print(f"model loaded in {time.time() - t:.1f}s ({segmenter.info()['provider']})")
    r = segmenter.predict(synthetic_rust())
    print(f"rust test: {r['count']} area(s), {r['coverage_pct']}% coverage, max {r['max_score']:.2f}, {r['inference_ms']:.0f} ms")
    clean = segmenter.predict(np.full((480, 640, 3), (125, 128, 132), np.uint8))
    print(f"clean steel: {clean['count']} area(s)")
    print(f"knowledge base: {len(kb.chunks)} sections")
    ok = r["count"] >= 1 and r["max_score"] > 0.8 and clean["count"] == 0 and len(kb.chunks) > 10
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
