import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { housingColors, modelParts } from "../constants";
import { useReveal } from "../hooks/useReveal";

// three.js is large, so load it only when this section is about to be seen
const Scene = lazy(() => import("./three/Scene"));

const ModelSection = () => {
  const sectionRef = useRef(null);
  const [nearView, setNearView] = useState(false); // start loading
  const [inView, setInView] = useState(false); // render frames
  const [exploded, setExploded] = useState(false);
  const [color] = useState(housingColors[0]);
  const [activePart, setActivePart] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const introDone = useRef(false);

  useReveal(sectionRef);

  useEffect(() => {
    const el = sectionRef.current;
    const near = new IntersectionObserver(([e]) => e.isIntersecting && setNearView(true), {
      rootMargin: "600px 0px",
    });
    const visible = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    near.observe(el);
    visible.observe(el);
    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, []);

  // First time the model is on screen: explode it once so visitors discover the feature
  useEffect(() => {
    if (!inView || introDone.current) return;
    introDone.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = setTimeout(() => setExploded(true), 1400);
    const b = setTimeout(() => setExploded(false), 4200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [inView]);

  const selectPart = (id) => {
    setActivePart((cur) => (cur === id ? null : id));
    setAutoRotate(false);
  };

  const part = modelParts.find((p) => p.id === activePart);

  return (
    <section id="product" ref={sectionRef} className="w-full bg-black section-pad overflow-hidden">
      <div className="screen-max-width page-gutter">
        <h2 data-reveal className="section-heading">
          Take a closer look.
        </h2>

        <div className="relative mt-6 h-[62vh] md:h-[78vh] max-h-[820px] w-full">
          {/* Stage glow */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-[8%] mx-auto h-1/2 w-3/4 rounded-full blur-3xl opacity-40"
            style={{ background: `radial-gradient(closest-side, ${color.hex}55, transparent)` }}
          />
          {nearView ? (
            <Suspense fallback={<SceneLoader />}>
              <Scene
                active={inView}
                exploded={exploded}
                housingColor={color.hex}
                parts={modelParts}
                activePart={activePart}
                onSelectPart={selectPart}
                autoRotate={autoRotate && !activePart}
                onInteract={() => setAutoRotate(false)}
              />
            </Suspense>
          ) : (
            <SceneLoader />
          )}

          {/* Part details */}
          <div
            className={`absolute left-0 bottom-0 sm:bottom-4 max-w-xs transition-all duration-500 ${
              part ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
            }`}
            aria-live="polite"
          >
            {part && (
              <div className="glass-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-white font-semibold">{part.name}</h3>
                  <button
                    onClick={() => setActivePart(null)}
                    className="text-gray hover:text-white -mt-1"
                    aria-label="Close part details"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray text-sm mt-2 leading-relaxed">{part.detail}</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls, same pattern as the reference site */}
        <div className="mt-4 flex flex-col items-center gap-5">
          <p className="text-sm text-white/80 text-center">
            WeldSight prototype
            <span className="block text-gray text-xs mt-1">
              Drag to rotate. Tap a blue dot to learn what it does.
            </span>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-gray-300 backdrop-blur" role="group" aria-label="View">
              {[
                { label: "Assembled", value: false },
                { label: "Exploded", value: true },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setExploded(opt.value)}
                  aria-pressed={exploded === opt.value}
                  className={`px-4 h-10 rounded-full text-sm transition-colors ${
                    exploded === opt.value ? "bg-white text-black" : "text-white hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const SceneLoader = () => (
  <div className="absolute inset-0 flex-center">
    <div className="w-10 h-10 border-2 border-blue border-t-transparent rounded-full animate-spin" />
  </div>
);

export default ModelSection;
