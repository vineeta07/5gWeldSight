import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { highlightSecondVideo } from "../utils";
import { useReveal } from "../hooks/useReveal";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { title: "Capture", text: "The pan-tilt camera films the weld as it happens." },
  { title: "Stream", text: "The 5G modem sends the video out with minimal delay." },
  { title: "Detect", text: "AI marks porosity, cracks, undercut and other defects." },
  { title: "Review", text: "An inspector checks the result in VR, from anywhere." },
];

const HowItWorks = () => {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const [reached, setReached] = useState(-1);
  useReveal(sectionRef);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Device rises and straightens as it enters
        gsap.from("[data-device]", {
          y: 80,
          rotateX: 18,
          scale: 0.92,
          opacity: 0,
          duration: 1.4,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-device]", start: "top 85%", once: true },
        });
      });

      // Pipeline line fills as you scroll; steps light up when the line reaches them.
      // Horizontal on desktop, vertical on phones.
      const pipeline = (axis) => () =>
        gsap.fromTo(
          "[data-line]",
          { [axis]: 0 },
          {
            [axis]: 1,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-pipeline]",
              start: "top 75%",
              end: "bottom 45%",
              scrub: true,
              onUpdate: (self) => setReached(Math.floor(self.progress * steps.length - 0.01)),
            },
          }
        );
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", pipeline("scaleX"));
      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 767px)", pipeline("scaleY"));
      mm.add("(prefers-reduced-motion: reduce)", () => setReached(steps.length - 1));
      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  useEffect(() => {
    const video = videoRef.current;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()));
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <section id="how" ref={sectionRef} className="w-full bg-zinc section-pad overflow-hidden">
      <div className="screen-max-width page-gutter">
        <div className="text-center">
          <p data-reveal className="statement text-white">
            From arc to answer.
          </p>
          <p data-reveal data-reveal-delay="0.15" className="statement heat-text pb-2">
            In real time.
          </p>
          <p data-reveal data-reveal-delay="0.25" className="mt-6 text-gray text-xl md:text-2xl font-semibold">
            Four steps, one continuous stream.
          </p>
        </div>

        {/* Device showing the AI detection clip */}
        <div className="mt-14 md:mt-20 [perspective:1400px]">
          <div data-device className="mx-auto max-w-4xl">
            <div className="rounded-[28px] md:rounded-[44px] bg-[#1d1d1f] p-2.5 md:p-4 shadow-[0_40px_120px_-20px_rgba(41,151,255,0.35)] ring-1 ring-white/10">
              <div className="relative aspect-video overflow-hidden rounded-[20px] md:rounded-[32px] bg-black">
                <video
                  ref={videoRef}
                  src={highlightSecondVideo}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                  aria-label="AI flagging weld defects on a live stream"
                />
                <span className="absolute top-3 left-3 md:top-5 md:left-5 inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur px-3 py-1 text-xs text-white">
                  <span className="w-2 h-2 rounded-full bg-weld animate-pulse" /> Live
                </span>
              </div>
            </div>
            <p className="mt-4 text-center text-gray text-sm">AI detection running on the live weld stream</p>
          </div>
        </div>

        {/* Pipeline */}
        <div data-pipeline className="relative mt-20 md:mt-28">
          {/* track + fill: horizontal on desktop, vertical on mobile */}
          <div className="absolute md:left-[12.5%] md:right-[12.5%] md:top-5 md:h-px left-5 top-5 bottom-5 w-px md:w-auto md:bottom-auto bg-white/10">
            <div data-line className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-blue to-weld origin-top md:origin-left" />
          </div>
          <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-6">
            {steps.map((s, i) => {
              const on = i <= reached;
              return (
                <li key={s.title} className="flex md:flex-col md:items-center md:text-center gap-5 md:gap-4">
                  <span
                    className={`relative z-10 shrink-0 w-10 h-10 rounded-full flex-center text-sm font-semibold transition-all duration-500 ${
                      on ? "bg-blue text-white shadow-[0_0_24px_rgba(41,151,255,0.6)]" : "bg-zinc text-gray ring-1 ring-white/15"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className={`text-xl font-semibold transition-colors duration-500 ${on ? "text-white" : "text-gray"}`}>
                      {s.title}
                    </h3>
                    <p className="mt-1 text-gray text-base max-w-[16rem]">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
