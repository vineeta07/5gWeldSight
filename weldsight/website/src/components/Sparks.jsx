import { useEffect, useRef } from "react";

/**
 * Welding sparks on a 2D canvas.
 * - A steady trickle from `origin` (fractions of the canvas size).
 * - Moving the pointer over the parent drags a "torch" that throws sparks.
 * - Tapping or clicking makes a burst.
 * Pauses when off-screen and does nothing if reduced motion is on.
 */
const COLORS = ["#fff4d6", "#ffd27a", "#ffb347", "#ff6b35"];

const Sparks = ({ origin = { x: 0.5, y: 0.7 }, rate = 3 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const host = canvas.parentElement;
    let w = 0,
      h = 0,
      dpr = 1,
      raf = 0,
      running = false,
      last = performance.now();
    const sparks = [];
    const pointer = { x: 0, y: 0, active: false, moved: 0 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const emit = (x, y, n, power = 1) => {
      for (let i = 0; i < n && sparks.length < 600; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        const speed = (120 + Math.random() * 420) * power;
        sparks.push({
          x,
          y,
          px: x,
          py: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          max: 0.4 + Math.random() * 0.9,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          width: 0.8 + Math.random() * 1.6,
        });
      }
    };

    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // torch follows the pointer
      if (pointer.active && pointer.moved > 0) {
        emit(pointer.x, pointer.y, 3, 0.7);
        pointer.moved -= 1;
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life > s.max || s.y > h + 20) {
          sparks.splice(i, 1);
          continue;
        }
        s.px = s.x;
        s.py = s.y;
        s.vy += 900 * dt; // gravity
        s.vx *= 0.985;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y > h - 2 && s.vy > 0) {
          // bounce off the floor
          s.vy *= -0.35;
          s.y = h - 2;
        }
        const fade = 1 - s.life / s.max;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = fade;
        ctx.lineWidth = s.width * fade + 0.3;
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      const p = local(e);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.active = true;
      pointer.moved = 4;
    };
    const onLeave = () => (pointer.active = false);
    const onDown = (e) => {
      const p = local(e);
      emit(p.x, p.y, 60, 1.2);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(canvas);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, [origin.x, origin.y, rate]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
};

export default Sparks;
