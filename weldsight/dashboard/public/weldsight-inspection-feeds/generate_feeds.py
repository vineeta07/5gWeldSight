"""
WeldSight: synthetic industrial inspection feeds with a surveillance-style HUD.

Generates four camera feeds plus a 2x2 control-room montage, in the same visual
language as the border-surveillance dashboard (camera IDs, sectors, zones,
tracking IDs, risk levels, event log), and an incidents.json that matches the
dashboard's incident schema.

Everything is procedurally generated. Defects are placed by the generator, so
every detection box sits exactly on a real defect in the frame. Every frame is
stamped "SIMULATED FEED" so nobody mistakes it for real camera output.

    pip install opencv-python numpy
    python generate_feeds.py            # needs ffmpeg on PATH
"""
import json
import math
import os
import subprocess
from datetime import datetime, timedelta

import cv2
import numpy as np

W, H, FPS, SECONDS = 1280, 720, 30, 12
N = FPS * SECONDS
OUT = "output"
START = datetime(2026, 9, 22, 14, 32, 5)
MM_PER_PX = 0.1  # scene scale used for measurements

# BGR colours
WHITE = (235, 235, 235)
DIM = (150, 150, 150)
GREEN = (110, 220, 120)
AMBER = (40, 175, 255)
RED = (70, 70, 255)
CYAN = (255, 220, 60)
RISK = {"LOW": GREEN, "MEDIUM": AMBER, "HIGH": (40, 120, 255), "CRITICAL": RED}
FONT = cv2.FONT_HERSHEY_SIMPLEX
MONO = cv2.FONT_HERSHEY_PLAIN

rng = np.random.default_rng(7)


# ─────────────────────────────── drawing helpers ───────────────────────────────
def txt(img, s, org, scale=0.5, color=WHITE, thick=1, font=FONT):
    x, y = org
    cv2.putText(img, s, (x + 1, y + 1), font, scale, (0, 0, 0), thick + 2, cv2.LINE_AA)
    cv2.putText(img, s, (x, y), font, scale, color, thick, cv2.LINE_AA)


def blend_rect(img, x0, y0, x1, y1, color, alpha):
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0:
        return
    roi = img[y0:y1, x0:x1]
    roi[:] = (roi * (1 - alpha) + np.array(color) * alpha).astype(np.uint8)


def zone(img, pts, color, label, alpha=0.12):
    pts = np.array(pts, np.int32)
    over = img.copy()
    cv2.fillPoly(over, [pts], color)
    cv2.addWeighted(over, alpha, img, 1 - alpha, 0, img)
    for i in range(len(pts)):  # dashed outline
        a, b = pts[i], pts[(i + 1) % len(pts)]
        seg = int(np.hypot(*(b - a)) // 14)
        for k in range(0, max(seg, 1), 2):
            p = a + (b - a) * k / max(seg, 1)
            q = a + (b - a) * min(k + 1, seg) / max(seg, 1)
            cv2.line(img, tuple(p.astype(int)), tuple(q.astype(int)), color, 1, cv2.LINE_AA)
    x, y = pts[:, 0].min() + 6, pts[:, 1].min() + 16
    txt(img, label, (x, y), 0.42, color)


def track_box(img, x, y, w, h, color, tag, sub=None, conf=None):
    """Corner-bracket box with a label tag, the look used by surveillance HUDs."""
    x, y, w, h = int(x), int(y), int(w), int(h)
    L = max(8, min(w, h) // 4)
    for (cx, cy, dx, dy) in [(x, y, 1, 1), (x + w, y, -1, 1), (x, y + h, 1, -1), (x + w, y + h, -1, -1)]:
        cv2.line(img, (cx, cy), (cx + dx * L, cy), color, 2, cv2.LINE_AA)
        cv2.line(img, (cx, cy), (cx, cy + dy * L), color, 2, cv2.LINE_AA)
    cv2.rectangle(img, (x, y), (x + w, y + h), color, 1, cv2.LINE_AA)
    label = tag + (f"  {conf:.0%}" if conf is not None else "")
    (tw, th), _ = cv2.getTextSize(label, FONT, 0.45, 1)
    ty = y - 8 if y > 40 else y + h + th + 8
    cv2.rectangle(img, (x, ty - th - 5), (x + tw + 10, ty + 4), color, -1)
    cv2.putText(img, label, (x + 5, ty), FONT, 0.45, (10, 10, 10), 1, cv2.LINE_AA)
    if sub:
        txt(img, sub, (x, ty + 18 if ty > y else ty - th - 12), 0.4, color)


class Writer:
    """Streams frames straight into ffmpeg (keeps memory low) and saves a poster."""

    def __init__(self, path, poster_at=None, w=W, h=H):
        self.p = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(FPS),
             "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path],
            stdin=subprocess.PIPE,
        )
        self.poster_path, self.poster_at, self.i = path.replace(".mp4", "_poster.jpg"), poster_at, 0

    def append(self, frame):
        if self.i == self.poster_at:
            cv2.imwrite(self.poster_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
        self.p.stdin.write(frame.tobytes())
        self.i += 1

    def close(self):
        self.p.stdin.close()
        self.p.wait()


class EventLog:
    def __init__(self):
        self.items = []  # (t, text, level)

    def add(self, t, text, level):
        self.items.append((t, text, level))

    def draw(self, img, t):
        shown = [e for e in self.items if e[0] <= t][-4:]
        x0, y0 = 30, H - 46 - 24 * len(shown)
        if shown:
            blend_rect(img, x0 - 10, y0 - 26, x0 + 420, H - 40, (0, 0, 0), 0.55)
            txt(img, "EVENT LOG", (x0, y0 - 8), 0.4, DIM)
        for i, (et, s, lvl) in enumerate(shown):
            age = t - et
            color = RISK[lvl]
            y = y0 + 20 + i * 24
            if age < 0.6 and int(age * 10) % 2 == 0:  # blink when new
                blend_rect(img, x0 - 6, y - 16, x0 + 414, y + 6, color, 0.25)
            ts = (START + timedelta(seconds=et)).strftime("%H:%M:%S")
            txt(img, f"{ts}  [{lvl[:4]}]  {s}", (x0, y), 0.42, color)


def hud(img, cam, t, i, extra=()):
    """Shared chrome: REC, camera, sector, clock, frame counter, corner brackets."""
    blend_rect(img, 0, 0, W, 52, (0, 0, 0), 0.5)
    if int(t * 2) % 2 == 0:
        cv2.circle(img, (22, 22), 7, (40, 40, 255), -1, cv2.LINE_AA)
    txt(img, "REC", (36, 28), 0.55, (90, 90, 255), 2)
    txt(img, f"{cam['id']}  {cam['name']}", (86, 28), 0.6, WHITE, 2)
    txt(img, f"SECTOR {cam['sector']}   {cam['type']}   {W}x{H} @{FPS}   AI: WELDSIGHT-VISION", (86, 45), 0.4, DIM)
    clock = START + timedelta(seconds=t)
    txt(img, clock.strftime("%Y-%m-%d  %H:%M:%S.") + f"{int((t % 1) * 100):02d}", (W - 300, 28), 0.55, WHITE, 1)
    txt(img, f"FRM {i:06d}", (W - 300, 45), 0.4, DIM)
    for k, line in enumerate(extra):
        txt(img, line, (W - 150, 45 + 0 * k), 0.4, DIM)
    # frame brackets
    for (cx, cy, dx, dy) in [(12, 62, 1, 1), (W - 12, 62, -1, 1), (12, H - 12, 1, -1), (W - 12, H - 12, -1, -1)]:
        cv2.line(img, (cx, cy), (cx + dx * 40, cy), WHITE, 1, cv2.LINE_AA)
        cv2.line(img, (cx, cy), (cx, cy + dy * 40), WHITE, 1, cv2.LINE_AA)
    # centre reticle
    c = (W // 2, H // 2 + 20)
    for a, b in [((-18, 0), (-6, 0)), ((6, 0), (18, 0)), ((0, -18), (0, -6)), ((0, 6), (0, 18))]:
        cv2.line(img, (c[0] + a[0], c[1] + a[1]), (c[0] + b[0], c[1] + b[1]), (200, 200, 200), 1, cv2.LINE_AA)
    # honesty stamp
    txt(img, "SIMULATED FEED  |  DEMO DATA", (24, H - 20), 0.42, (120, 120, 120))


def scanlines(img):
    img[::3] = (img[::3] * 0.9).astype(np.uint8)


def vignette_mask():
    y, x = np.ogrid[:H, :W]
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    return np.clip(1.15 - 0.45 * d**2, 0.35, 1)[..., None].astype(np.float32)


VIG = vignette_mask()


def finish(img):
    img[:] = np.clip(img.astype(np.float32) * VIG, 0, 255).astype(np.uint8)
    noise = rng.integers(0, 10, (H, W, 1), dtype=np.uint8)
    cv2.add(img, np.repeat(noise, 3, axis=2), img)
    scanlines(img)


def steel(h, w, seed, base=(118, 122, 126)):
    r = np.random.default_rng(seed)
    brushed = cv2.resize(r.normal(0, 1, (h, max(4, w // 24))).astype(np.float32), (w, h))
    blotch = cv2.resize(r.normal(0, 1, (max(2, h // 90), max(2, w // 90))).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    fine = r.normal(0, 1, (h, w)).astype(np.float32)
    v = 9 * brushed + 5 * blotch + 3 * fine
    img = np.clip(np.array(base, np.float32)[None, None] + v[..., None], 0, 255)
    return img.astype(np.uint8)


def glow_sprite(size, sigma):
    ax = np.linspace(-1, 1, size)
    xx, yy = np.meshgrid(ax, ax)
    return np.exp(-(xx**2 + yy**2) / (2 * sigma**2)).astype(np.float32)


GLOW = glow_sprite(512, 0.22)
CORE = glow_sprite(128, 0.12)


def add_sprite(img_f, sprite, cx, cy, color, gain):
    s = sprite.shape[0]
    x0, y0 = int(cx - s / 2), int(cy - s / 2)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    x0c, y0c = max(0, x0), max(0, y0)
    x1c, y1c = min(W, x0 + s), min(H, y0 + s)
    if x1c <= x0c or y1c <= y0c:
        return
    sp = sprite[sy0 : sy0 + (y1c - y0c), sx0 : sx0 + (x1c - x0c)]
    img_f[y0c:y1c, x0c:x1c] += sp[..., None] * np.array(color, np.float32) * gain


class Sparks:
    def __init__(self):
        self.p = np.zeros((0, 6), np.float32)  # x y vx vy life max

    def emit(self, x, y, n):
        a = rng.uniform(0, 2 * np.pi, n)
        s = rng.uniform(150, 650, n)
        new = np.stack([np.full(n, x), np.full(n, y), np.cos(a) * s, np.sin(a) * s * 0.7, np.zeros(n), rng.uniform(0.15, 0.6, n)], 1)
        self.p = np.concatenate([self.p, new.astype(np.float32)])[-500:]

    def step(self, img, dt):
        if not len(self.p):
            return
        p = self.p
        px, py = p[:, 0].copy(), p[:, 1].copy()
        p[:, 4] += dt
        p[:, 2] *= 0.95
        p[:, 3] *= 0.95
        p[:, 0] += p[:, 2] * dt
        p[:, 1] += p[:, 3] * dt
        alive = p[:, 4] < p[:, 5]
        for k in np.where(alive)[0]:
            f = 1 - p[k, 4] / p[k, 5]
            col = (int(120 + 135 * f), int(200 + 55 * f), 255)
            cv2.line(img, (int(px[k]), int(py[k])), (int(p[k, 0]), int(p[k, 1])), col, 1, cv2.LINE_AA)
        self.p = p[alive]


# ───────────────────────────── bead renderer (shared) ─────────────────────────────
def render_bead(canvas, x_start, x_end, cy, half_w, arc_x=None, seed=0, hot=True):
    """Draws a rippled weld bead from x_start to x_end on `canvas` (in place).
    If arc_x is given, the metal near it is glowing and cools behind it."""
    x0, x1 = int(max(0, x_start)), int(min(canvas.shape[1], x_end))
    if x1 <= x0:
        return
    band = int(half_w + 6)
    y0, y1 = int(cy - band), int(cy + band)
    ys = np.arange(y0, y1)[:, None].astype(np.float32)
    xs = np.arange(x0, x1)[None, :].astype(np.float32)
    wobble = 1.6 * np.sin(xs * 0.05 + seed) + 1.1 * np.sin(xs * 0.013 + 2 * seed)
    hw = half_w + wobble
    dy = ys - cy
    inside = np.abs(dy) < hw
    height = np.sqrt(np.clip(1 - (dy / hw) ** 2, 0, 1))
    ripple = np.sin(2 * np.pi * (xs - 0.035 * dy**2) / 7.0)
    u = dy / hw
    lambert = 0.45 + 0.4 * height - 0.3 * u + 0.14 * ripple * height
    spec = np.exp(-((u + 0.28) ** 2) / 0.018) * (0.75 + 0.25 * ripple)
    cold = np.array([138, 144, 150], np.float32)
    col = cold[None, None] * lambert[..., None] + 75 * spec[..., None]
    # heat-tint colours near the toes: straw, bronze, blue
    toe = np.exp(-((np.abs(u) - 0.92) ** 2) / 0.012)[..., None]
    band = np.exp(-((np.abs(u) - 0.75) ** 2) / 0.02)[..., None]
    col = col * (1 - 0.5 * toe) + np.array([150, 95, 60], np.float32) * 0.5 * toe
    col = col * (1 - 0.3 * band) + np.array([90, 150, 190], np.float32) * 0.3 * band
    if arc_x is not None and hot:
        d = np.clip(arc_x - xs, 0, None)
        heat = np.exp(-d / 140.0)[..., None]
        hotc = np.array([150, 230, 255], np.float32) * (0.6 + 0.4 * height[..., None])
        col = col * (1 - heat) + hotc * heat
    roi = canvas[y0:y1, x0:x1].astype(np.float32)
    m = inside[..., None].astype(np.float32)
    edge = cv2.GaussianBlur(m, (5, 5), 0)
    if edge.ndim == 2:
        edge = edge[..., None]
    canvas[y0:y1, x0:x1] = np.clip(roi * (1 - edge) + col * edge, 0, 255).astype(np.uint8)


def draw_pores(canvas, pores, visible_until=None):
    for (x, y, r) in pores:
        if visible_until is not None and x > visible_until:
            continue
        cv2.circle(canvas, (int(x), int(y)), int(r) + 1, (70, 74, 78), -1, cv2.LINE_AA)
        cv2.circle(canvas, (int(x), int(y)), int(r), (18, 18, 20), -1, cv2.LINE_AA)
        cv2.circle(canvas, (int(x - r / 3), int(y - r / 3)), max(1, int(r / 3)), (140, 140, 140), -1, cv2.LINE_AA)


def pore_cluster(cx, cy, n, spread, seed):
    r = np.random.default_rng(seed)
    return [(cx + r.normal(0, spread), cy + r.normal(0, spread * 0.5), r.uniform(1.5, 4.2)) for _ in range(n)]


# ─────────────────────────────── CAM-01: live arc ───────────────────────────────
def cam01(frames):
    cam = {"id": "CAM-01", "name": "WELD BAY A - LIVE ARC", "sector": "W-01", "type": "RGB"}
    plate = steel(H, W, 11)
    seam_y = H // 2 + 20
    # bevel groove
    cv2.line(plate, (0, seam_y - 3), (W, seam_y - 3), (150, 155, 160), 1)
    cv2.line(plate, (0, seam_y), (W, seam_y), (40, 42, 45), 3)
    cv2.line(plate, (0, seam_y + 3), (W, seam_y + 3), (80, 84, 88), 1)
    x_begin, x_end = 90, 1190
    pores = pore_cluster(430, seam_y, 9, 8, 3)
    undercut = (700, 790)  # along top toe
    log, sparks = EventLog(), Sparks()
    defects = [
        {"id": "D-001", "kind": "POROSITY", "x": 430, "box": (398, seam_y - 22, 66, 44), "risk": "HIGH", "conf": 0.91,
         "reason": "Cluster of 9 gas pores in bead"},
        {"id": "D-002", "kind": "UNDERCUT", "x": 745, "box": (694, seam_y - 30, 102, 20), "risk": "MEDIUM", "conf": 0.84,
         "reason": "Groove along top toe, 9 mm long"},
    ]
    hand_t = (8.2, 10.6)  # safety event: glove enters arc zone
    logged, prev_arc, speed = set(), None, 0.0
    log.add(0.3, "Arc started - tracking A-01", "LOW")
    for i in range(N):
        t = i / FPS
        arc_x = x_begin + (x_end - x_begin) * min(1, t / (SECONDS - 0.6))
        img = plate.copy()
        render_bead(img, x_begin, arc_x, seam_y, 17, arc_x=arc_x, seed=1)
        draw_pores(img, pores, visible_until=arc_x - 30)
        if arc_x > undercut[0]:
            xe = min(arc_x - 25, undercut[1])
            if xe > undercut[0]:
                pts = np.array([[x, seam_y - 18 - 1.5 * math.sin(x * 0.08)] for x in np.arange(undercut[0], xe, 3)], np.int32)
                cv2.polylines(img, [pts], False, (20, 20, 22), 3, cv2.LINE_AA)
        # glove intrusion (drawn before glow so the arc lights it)
        hand_in = hand_t[0] <= t <= hand_t[1]
        if hand_in:
            k = min(1, (t - hand_t[0]) / 0.8) if t < hand_t[1] - 0.8 else max(0, (hand_t[1] - t) / 0.8)
            hx, hy = int(arc_x - 70), int(H + 60 - 250 * k)
            glove = img.copy()
            cv2.ellipse(glove, (hx, hy + 70), (70, 95), 0, 0, 360, (48, 78, 120), -1, cv2.LINE_AA)
            for j, dx in enumerate([-48, -18, 12, 40]):
                cv2.ellipse(glove, (hx + dx, hy - 20 - (8 if j in (1, 2) else 0)), (15, 48), 8 * (j - 1.5), 0, 360, (52, 84, 128), -1, cv2.LINE_AA)
            cv2.ellipse(glove, (hx + 78, hy + 50), (16, 42), -40, 0, 360, (50, 80, 124), -1, cv2.LINE_AA)
            glove = cv2.GaussianBlur(glove, (5, 5), 0)
            img = glove
        # arc glow
        f = img.astype(np.float32) * 0.62
        flick = 0.85 + 0.3 * rng.random()
        add_sprite(f, GLOW, arc_x, seam_y, (120, 190, 255), 1.3 * flick)
        add_sprite(f, CORE, arc_x, seam_y, (255, 255, 255), 2.2 * flick)
        img = np.clip(f, 0, 255).astype(np.uint8)
        sparks.emit(arc_x, seam_y, int(6 * flick))
        sparks.step(img, 1 / FPS)
        # real CV: find the arc as the brightest blob
        lum = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (31, 31), 0)
        _, _, _, (ax, ay) = cv2.minMaxLoc(lum)
        inst = 0 if prev_arc is None else (ax - prev_arc) * FPS * MM_PER_PX
        speed = inst if prev_arc is None else 0.93 * speed + 0.07 * inst
        prev_arc = ax
        # zones
        zone(img, [(40, seam_y - 70), (W - 40, seam_y - 70), (W - 40, seam_y + 70), (40, seam_y + 70)], GREEN, "INSPECTION ROI", 0.05)
        cv2.circle(img, (int(ax), int(ay)), 120, RED, 1, cv2.LINE_AA)
        txt(img, "ARC ZONE - NO ENTRY", (int(ax) - 80, int(ay) - 128), 0.42, RED)
        track_box(img, ax - 34, ay - 34, 68, 68, CYAN, "ARC A-01", f"TRAVEL {max(0, speed):.1f} mm/s")
        # defects appear once the bead behind the arc has cooled
        for d in defects:
            if arc_x - d["x"] > 90:
                age = (arc_x - d["x"] - 90) / 200
                conf = min(d["conf"], 0.6 + age * 0.5)
                x, y, w, h = d["box"]
                track_box(img, x, y, w, h, RISK[d["risk"]], f"{d['id']} {d['kind']}", d["risk"], conf)
                if d["id"] not in logged:
                    logged.add(d["id"])
                    log.add(t, f"{d['id']} {d['kind']} detected", d["risk"])
                    d["t"] = t
        if hand_in:
            k2 = (t - hand_t[0])
            if k2 > 0.5:
                hx = int(arc_x - 70)
                track_box(img, hx - 95, H - 250, 190, 230, RED, "P-07 GLOVE/HAND", "IN ARC ZONE", 0.93)
                if "SAFE" not in logged:
                    logged.add("SAFE")
                    log.add(t, "Hand entered arc zone - SAFETY", "CRITICAL")
                if int(t * 4) % 2 == 0:
                    blend_rect(img, 0, 54, W, 94, (0, 0, 180), 0.6)
                    txt(img, "CRITICAL  |  RESTRICTED ZONE INTRUSION  |  P-07 INSIDE ARC ZONE", (W // 2 - 330, 79), 0.6, WHITE, 2)
        # side telemetry (derived from the scene itself)
        done = (arc_x - x_begin) * MM_PER_PX
        blend_rect(img, 14, 104, 250, 216, (0, 0, 0), 0.5)
        txt(img, "WELD PASS 1 / ROOT", (24, 124), 0.45, WHITE)
        txt(img, f"LENGTH   {done:6.1f} mm", (24, 146), 0.42, DIM)
        txt(img, f"DEFECTS  {len([d for d in defects if 't' in d])}", (24, 166), 0.42, DIM)
        live_score = 100 - sum({"HIGH": 22, "MEDIUM": 10}[d["risk"]] for d in defects if "t" in d)
        txt(img, f"QUALITY  {live_score:3d} / 100", (24, 186), 0.42, AMBER if live_score < 80 else GREEN)
        txt(img, "STATUS   WELDING", (24, 206), 0.42, CYAN)
        log.draw(img, t)
        hud(img, cam, t, i)
        finish(img)
        frames.append(img)
    return cam, frames, defects, log, {"safety": hand_t}


# ─────────────────────────── CAM-02: post-weld seam scan ───────────────────────────
def cam02(frames):
    cam = {"id": "CAM-02", "name": "SEAM SCANNER - POST-WELD", "sector": "W-02", "type": "RGB MACRO"}
    L = 5200
    strip = steel(H, L, 21, base=(112, 116, 121))
    cy, hw = H // 2 + 20, 42
    render_bead(strip, 0, L, cy, hw, seed=4, hot=False)
    # scale ruler baked into plate edge
    defects = [
        {"id": "D-101", "kind": "SPATTER", "x": 1500, "risk": "LOW", "conf": 0.88, "reason": "Spatter beads beside toe"},
        {"id": "D-102", "kind": "TRANSVERSE CRACK", "x": 2350, "risk": "CRITICAL", "conf": 0.95, "reason": "Crack across bead - reject"},
        {"id": "D-103", "kind": "POROSITY", "x": 3200, "risk": "HIGH", "conf": 0.9, "reason": "Scattered pores in cap"},
        {"id": "D-104", "kind": "LACK OF FUSION", "x": 4050, "risk": "HIGH", "conf": 0.86, "reason": "Unfused line at lower toe"},
    ]
    r = np.random.default_rng(5)
    for _ in range(26):  # spatter
        x, y = 1500 + r.normal(0, 40), cy + r.choice([-1, 1]) * r.uniform(hw + 8, hw + 60)
        rad = r.uniform(2, 5)
        cv2.circle(strip, (int(x), int(y)), int(rad), (150, 155, 160), -1, cv2.LINE_AA)
        cv2.circle(strip, (int(x - 1), int(y - 1)), max(1, int(rad / 2)), (210, 210, 215), -1, cv2.LINE_AA)
    crack = [(2350 + r.normal(0, 3) + 4 * math.sin(k), cy - hw + 6 + k * (2 * hw - 12) / 14) for k in range(15)]
    cv2.polylines(strip, [np.array(crack, np.int32)], False, (15, 15, 18), 3, cv2.LINE_AA)
    cv2.polylines(strip, [np.array([(x + 2, y) for x, y in crack], np.int32)], False, (150, 150, 155), 1, cv2.LINE_AA)
    draw_pores(strip, pore_cluster(3200, cy, 14, 18, 9))
    lof = np.array([[x, cy + hw - 3 + 1.2 * math.sin(x * 0.1)] for x in range(3960, 4150, 3)], np.int32)
    cv2.polylines(strip, [lof], False, (20, 20, 24), 3, cv2.LINE_AA)
    boxes = {"D-101": (-80, cy - hw - 70, 160, 2 * hw + 140), "D-102": (-26, cy - hw - 6, 52, 2 * hw + 12),
             "D-103": (-50, cy - 32, 100, 64), "D-104": (-100, cy + hw - 18, 200, 32)}
    log = EventLog()
    log.add(0.2, "Scan started - seam S-2201", "LOW")
    speed = (L - W) / (SECONDS - 0.5)
    scores, logged = [], set()
    for i in range(N):
        t = i / FPS
        off = min(L - W, speed * t)
        shake = int(1.5 * math.sin(t * 13))
        img = strip[:, int(off) : int(off) + W].copy()
        img = np.roll(img, shake, axis=0)
        # soft ring light
        f = img.astype(np.float32)
        add_sprite(f, GLOW, W // 2, cy, (22, 22, 22), 1.0)
        img = np.clip(f, 0, 255).astype(np.uint8)
        zone(img, [(40, cy - hw - 90), (W - 40, cy - hw - 90), (W - 40, cy + hw + 90), (40, cy + hw + 90)], GREEN, "SEAM ROI", 0.04)
        pos_mm = (off + W / 2) * MM_PER_PX
        # scanning line
        sx = W // 2
        cv2.line(img, (sx, 70), (sx, H - 60), CYAN, 1, cv2.LINE_AA)
        txt(img, f"SEAM POS {pos_mm:06.1f} mm", (sx + 8, 118), 0.45, CYAN)
        local = 100
        for d in defects:
            sxd = d["x"] - off
            if -120 < sxd < W + 120:
                bx, by, bw, bh = boxes[d["id"]]
                seen = sxd < W / 2 + 10
                if seen:
                    track_box(img, sxd + bx, by, bw, bh, RISK[d["risk"]], f"{d['id']} {d['kind']}", d["risk"], d["conf"])
                    if d["id"] not in logged:
                        logged.add(d["id"])
                        d["t"] = t
                        log.add(t, f"{d['id']} {d['kind']}", d["risk"])
            if abs(d["x"] - (off + W / 2)) < 200:
                local -= {"LOW": 8, "MEDIUM": 18, "HIGH": 35, "CRITICAL": 60}[d["risk"]]
        scores.append(max(0, local))
        # ruler
        for mm in range(int(off * MM_PER_PX) // 10 * 10, int((off + W) * MM_PER_PX) + 10, 10):
            x = int(mm / MM_PER_PX - off)
            big = mm % 50 == 0
            cv2.line(img, (x, H - 60), (x, H - 60 - (14 if big else 7)), WHITE, 1)
            if big:
                txt(img, f"{mm}", (x - 12, H - 80), 0.38, DIM)
        # rolling quality graph
        gx0, gy0, gw, gh = 20, 108, 300, 90
        blend_rect(img, gx0 - 6, gy0 - 4, gx0 + gw + 6, gy0 + gh + 22, (0, 0, 0), 0.55)
        txt(img, "LOCAL QUALITY SCORE", (gx0, gy0 + 12), 0.4, DIM)
        pts = scores[-gw // 2 :]
        for k in range(1, len(pts)):
            c = GREEN if pts[k] >= 80 else AMBER if pts[k] >= 50 else RED
            cv2.line(img, (gx0 + (k - 1) * 2, gy0 + gh - int(pts[k - 1] * 0.7)), (gx0 + k * 2, gy0 + gh - int(pts[k] * 0.7)), c, 2, cv2.LINE_AA)
        txt(img, f"{scores[-1]:3d}", (gx0 + gw - 34, gy0 + 12), 0.45, GREEN if scores[-1] >= 80 else AMBER if scores[-1] >= 50 else RED)
        if any(d.get("t") is not None and d["risk"] == "CRITICAL" and t - d["t"] < 2.5 for d in defects):
            if int(t * 4) % 2 == 0:
                blend_rect(img, 0, 54, W, 94, (0, 0, 180), 0.6)
                txt(img, "CRITICAL  |  TRANSVERSE CRACK D-102  |  WELD REJECTED - REPAIR REQUIRED", (W // 2 - 360, 79), 0.6, WHITE, 2)
        log.draw(img, t)
        hud(img, cam, t, i)
        finish(img)
        frames.append(img)
    return cam, frames, defects, log, {}


# ─────────────────────────────── CAM-03: thermal ───────────────────────────────
def cam03(frames):
    cam = {"id": "CAM-03", "name": "THERMAL - COOLING PROFILE", "sector": "W-01", "type": "LWIR THERMAL"}
    seam_y = H // 2 + 20
    x_begin, x_end = 90, 1190
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cold_span = (560, 680)  # abnormal fast cooling = possible lack of fusion
    base_noise = cv2.resize(rng.normal(0, 1, (H // 20, W // 20)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    log = EventLog()
    log.add(0.3, "Thermal tracking - pass 1", "LOW")
    defects = [{"id": "D-201", "kind": "ABNORMAL COOLING", "x": 620, "risk": "HIGH", "conf": 0.82,
                "reason": "Section cooled ~3x faster than neighbours; possible lack of fusion"}]
    logged = set()
    T_MIN, T_MAX = 25.0, 1500.0
    for i in range(N):
        t = i / FPS
        arc_x = x_begin + (x_end - x_begin) * min(1, t / (SECONDS - 0.6))
        d = np.clip(arc_x - xx, 0, None)
        behind = 1 / (1 + np.exp(np.clip(-(xx - x_begin) / 6, -50, 50))) / (1 + np.exp(np.clip(-(arc_x - xx) / 3, -50, 50)))
        mid = (cold_span[0] + cold_span[1]) / 2
        decay = 190.0 - 125.0 * np.exp(-(((xx - mid) / 60.0) ** 2))  # faster cooling in the bad section
        along = np.exp(-d / decay) * behind
        across = np.exp(-((yy - seam_y) ** 2) / (2 * (9 + 2.6 * np.sqrt(d)) ** 2))
        pool = np.exp(-(((xx - arc_x) ** 2) + (yy - seam_y) ** 2) / (2 * 22.0**2))
        temp = T_MIN + (T_MAX - T_MIN) * np.clip(0.92 * along * across + pool, 0, 1) ** 0.8
        temp += 3 * base_noise + rng.normal(0, 1.2, (H, W)).astype(np.float32)
        norm = np.clip((temp - T_MIN) / (T_MAX - T_MIN), 0, 1)
        img = cv2.applyColorMap((norm ** 0.55 * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
        # isotherms
        for level, col in [(800, (255, 255, 255)), (300, (200, 200, 200))]:
            m = (temp > level).astype(np.uint8)
            cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(img, cs, -1, col, 1, cv2.LINE_AA)
            if cs:
                c = max(cs, key=cv2.contourArea)
                x, y, _, _ = cv2.boundingRect(c)
                txt(img, f"{level} C", (x, y - 4), 0.38, col)
        _, tmax, _, (mx, my) = cv2.minMaxLoc(temp)
        track_box(img, mx - 30, my - 30, 60, 60, CYAN, "HOTSPOT H-01", f"MAX {tmax:.0f} C")
        # spot readings every 150 px behind the arc (real values from the field)
        for sx in range(int(arc_x) - 150, x_begin, -150):
            v = temp[seam_y, sx]
            cv2.drawMarker(img, (sx, seam_y), WHITE, cv2.MARKER_CROSS, 10, 1)
            txt(img, f"{v:.0f}", (sx - 14, seam_y + 30), 0.4, WHITE)
        dd = defects[0]
        if arc_x - dd["x"] > 160:
            track_box(img, cold_span[0], seam_y - 40, cold_span[1] - cold_span[0], 80, RISK["HIGH"], f"{dd['id']} {dd['kind']}", "HIGH", dd["conf"])
            if "D-201" not in logged:
                logged.add("D-201")
                dd["t"] = t
                log.add(t, "D-201 abnormal cooling gradient", "HIGH")
        # colour bar
        bar = cv2.applyColorMap((np.linspace(1, 0, 260) ** 0.55 * 255).astype(np.uint8)[:, None].repeat(16, 1), cv2.COLORMAP_INFERNO)
        img[80:340, W - 44 : W - 28] = bar
        for k, val in enumerate([1500, 1000, 500, 25]):
            y = 80 + int((1 - ((val - T_MIN) / (T_MAX - T_MIN)) ** 0.55) * 259)
            txt(img, f"{val}", (W - 100, y + 4), 0.38, WHITE)
        txt(img, "DEG C", (W - 96, 360), 0.38, DIM)
        blend_rect(img, 14, 104, 280, 190, (0, 0, 0), 0.5)
        txt(img, "COOLING PROFILE", (24, 124), 0.45, WHITE)
        v150 = temp[seam_y, int(max(x_begin, arc_x - 150))]
        txt(img, f"T @ -15 mm   {v150:6.0f} C", (24, 146), 0.42, DIM)
        txt(img, f"POOL MAX     {tmax:6.0f} C", (24, 166), 0.42, DIM)
        txt(img, "EMISSIVITY   0.85", (24, 186), 0.42, DIM)
        log.draw(img, t)
        hud(img, cam, t, i)
        finish(img)
        frames.append(img)
    return cam, frames, defects, log, {}


# ─────────────────────────── CAM-04: pipeline crawler ───────────────────────────
def cam04(frames):
    cam = {"id": "CAM-04", "name": "PIPELINE P-12 - GIRTH WELD", "sector": "P-12", "type": "CRAWLER RGB"}
    L = 3600  # unrolled circumference strip (vertical scroll = rotation)
    band_w = 92
    # build the unrolled pipe sideways (brushing runs around the pipe), draw the
    # weld band as a horizontal bead, then transpose so it runs top-to-bottom
    side = steel(W, L, 31, base=(96, 104, 112))
    cx = W // 2
    render_bead(side, 0, L, cx, band_w / 2, seed=8, hot=False)
    strip = np.ascontiguousarray(side.transpose(1, 0, 2))
    r = np.random.default_rng(12)
    # corrosion pitting on parent metal
    for _ in range(140):
        y, x = r.uniform(0, L), r.uniform(0, W)
        if abs(x - cx) < band_w:
            continue
        cv2.circle(strip, (int(x), int(y)), int(r.uniform(1, 3)), (40, 60, 90), -1, cv2.LINE_AA)
    # burn-through at 1800
    cv2.ellipse(strip, (cx + 4, 1800), (14, 20), 10, 0, 360, (10, 10, 12), -1, cv2.LINE_AA)
    cv2.ellipse(strip, (cx + 4, 1800), (22, 28), 10, 0, 360, (40, 90, 150), 2, cv2.LINE_AA)
    # corrosion patch at 2700
    patch = np.zeros((L, W), np.uint8)
    cv2.ellipse(patch, (cx + 190, 2700), (70, 50), 30, 0, 360, 255, -1)
    patch = cv2.GaussianBlur(patch, (41, 41), 0).astype(np.float32)[..., None] / 255
    rust = np.array([40, 80, 140], np.float32)
    grain = (0.75 + 0.5 * r.random((L, W, 1))).astype(np.float32)
    rust_tex = rust * grain
    strip = np.clip(strip * (1 - 0.75 * patch) + rust_tex * 0.75 * patch, 0, 255).astype(np.uint8)
    defects = [
        {"id": "D-301", "kind": "BURN-THROUGH", "y": 1800, "box": (cx - 40, -44, 88, 88), "risk": "CRITICAL", "conf": 0.94,
         "reason": "Hole through root at 6 o'clock position"},
        {"id": "D-302", "kind": "EXTERNAL CORROSION", "y": 2700, "box": (cx + 104, -74, 180, 148), "risk": "MEDIUM", "conf": 0.8,
         "reason": "Corrosion patch 12 mm from weld toe"},
    ]
    log = EventLog()
    log.add(0.2, "Crawler on station - joint J-0418", "LOW")
    speed = (L - H) / (SECONDS - 0.5)
    logged = set()
    # cylinder shading across x
    xs = np.linspace(-1, 1, W)
    shade = (0.35 + 0.75 * np.sqrt(np.clip(1 - xs**2, 0, 1)))[None, :, None].astype(np.float32)
    for i in range(N):
        t = i / FPS
        off = min(L - H, speed * t)
        img = strip[int(off) : int(off) + H].copy()
        f = img.astype(np.float32) * shade
        add_sprite(f, GLOW, cx, H // 2, (70, 70, 70), 1.0)  # crawler lamp
        img = np.clip(f, 0, 255).astype(np.uint8)
        clock = ((off + H / 2) / L) * 12
        hh = int(clock) or 12
        mm = int((clock % 1) * 60)
        zone(img, [(cx - 110, 70), (cx + 110, 70), (cx + 110, H - 30), (cx - 110, H - 30)], GREEN, "WELD + HAZ", 0.06)
        for d in defects:
            sy = d["y"] - off
            if -150 < sy < H + 150:
                bx, by, bw, bh = d["box"]
                if sy < H * 0.8:
                    track_box(img, bx, sy + by, bw, bh, RISK[d["risk"]], f"{d['id']} {d['kind']}", d["risk"], d["conf"])
                    if d["id"] not in logged:
                        logged.add(d["id"])
                        d["t"] = t
                        log.add(t, f"{d['id']} {d['kind']}", d["risk"])
        blend_rect(img, 14, 104, 280, 210, (0, 0, 0), 0.5)
        txt(img, "JOINT J-0418  /  DN300", (24, 124), 0.45, WHITE)
        txt(img, f"POSITION     {hh:02d}:{mm:02d} o'clock", (24, 146), 0.42, DIM)
        txt(img, f"CIRCUMF.     {off * MM_PER_PX:6.1f} mm", (24, 166), 0.42, DIM)
        txt(img, f"DEFECTS      {len(logged)}", (24, 186), 0.42, DIM)
        txt(img, "CRAWLER      ROTATING", (24, 204), 0.42, CYAN)
        if any(d.get("t") is not None and d["risk"] == "CRITICAL" and t - d["t"] < 2.5 for d in defects):
            if int(t * 4) % 2 == 0:
                blend_rect(img, 0, 54, W, 94, (0, 0, 180), 0.6)
                txt(img, "CRITICAL  |  BURN-THROUGH D-301  |  PRESSURE TEST BLOCKED", (W // 2 - 300, 79), 0.6, WHITE, 2)
        log.draw(img, t)
        hud(img, cam, t, i)
        finish(img)
        frames.append(img)
    return cam, frames, defects, log, {}


# ─────────────────────────────── output ───────────────────────────────
def montage(paths, out):
    """2x2 control-room wall, assembled by ffmpeg from the rendered feeds."""
    header = np.full((56, 1920, 3), 12, np.uint8)  # 56 + 2x512 = 1080
    cv2.putText(header, "WELDSIGHT OPS CENTER  |  INDUSTRIAL INSPECTION NETWORK", (24, 38), FONT, 0.9, WHITE, 2, cv2.LINE_AA)
    cv2.putText(header, "4 FEEDS ONLINE   |   SIMULATED DEMO DATA", (1380, 38), FONT, 0.6, DIM, 1, cv2.LINE_AA)
    hp = os.path.join(OUT, "_header.png")
    cv2.imwrite(hp, header)
    inputs = sum([["-i", p] for p in paths], []) + ["-loop", "1", "-i", hp]
    f = "".join(f"[{k}:v]scale=952:504,pad=960:512:4:4:color=0x0c0c0c[v{k}];" for k in range(4))
    f += "[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[g];"
    f += "[4:v][g]vstack=inputs=2:shortest=1,format=yuv420p[out]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", f, "-map", "[out]", "-r", str(FPS),
                    "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-movflags", "+faststart", out], check=True)
    os.remove(hp)


def main():
    os.makedirs(OUT, exist_ok=True)
    incidents, cams, paths = [], [], []
    feeds = [("cam01_weld_bay_live_arc", cam01), ("cam02_seam_scanner", cam02),
             ("cam03_thermal_cooling", cam03), ("cam04_pipeline_girth_weld", cam04)]
    score_hit = {"LOW": 20, "MEDIUM": 45, "HIGH": 75, "CRITICAL": 92}
    n = 1
    for slug, fn in feeds:
        print(f"rendering {slug} ...")
        path = os.path.join(OUT, slug + ".mp4")
        w = Writer(path, poster_at=int(N * 0.85))
        cam, _, defects, log, meta = fn(w)
        w.close()
        cams.append(cam)
        paths.append(path)
        for d in defects:
            if "t" not in d:
                continue
            ts = START + timedelta(seconds=d["t"])
            incidents.append({
                "incident_code": "", "camera_id": cam["id"], "camera_name": cam["name"], "sector": cam["sector"],
                "timestamp": ts.isoformat(), "video_file": slug + ".mp4", "video_time_s": round(d["t"], 2),
                "object_type": "weld_defect", "tracking_id": d["id"], "confidence": int(d["conf"] * 100),
                "threat_type": d["kind"].title(), "risk_score": score_hit[d["risk"]], "risk_level": d["risk"],
                "status": "NEW", "ai_reasons": [d["reason"]],
                "timeline": [{"time": ts.isoformat(), "event": f"{d['id']} detected by {cam['id']}", "status": "done"}],
            })
        if meta.get("safety"):
            st = meta["safety"][0] + 0.5
            ts = START + timedelta(seconds=st)
            incidents.append({
                "incident_code": "", "camera_id": cam["id"], "camera_name": cam["name"], "sector": cam["sector"],
                "timestamp": ts.isoformat(), "video_file": slug + ".mp4", "video_time_s": round(st, 2),
                "object_type": "person", "tracking_id": "P-07", "confidence": 93,
                "threat_type": "Restricted Zone Intrusion (Arc Zone)", "risk_score": 95, "risk_level": "CRITICAL",
                "status": "NEW", "ai_reasons": ["Hand/glove entered the arc exclusion zone while the arc was live"],
                "timeline": [{"time": ts.isoformat(), "event": "P-07 entered arc zone", "status": "done"}],
            })
    incidents.sort(key=lambda x: x["timestamp"])
    for k, inc in enumerate(incidents, 1):
        inc["incident_code"] = f"WLD-2026-{k:04d}"
    with open(os.path.join(OUT, "incidents.json"), "w") as f:
        json.dump({"note": "Simulated demo data generated alongside the videos", "cameras": cams, "incidents": incidents}, f, indent=2)
    print("rendering ops_center_4up ...")
    montage(paths, os.path.join(OUT, "ops_center_4up.mp4"))
    print("done ->", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
