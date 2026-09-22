import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { highlightFourthVideo, protoAngled, protoTop2 } from "../utils";
import { useReveal } from "../hooks/useReveal";

gsap.registerPlugin(ScrollTrigger);

// Mirrors the reference site's "Explore the full story" section:
// a big statement, a video that grows as you scroll, photos that settle into
// place, and two short paragraphs with the key phrase in white.
const Features = () => {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  useReveal(sectionRef);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-grow]",
          { scale: 0.82, borderRadius: "48px" },
          {
            scale: 1,
            borderRadius: "24px",
            ease: "none",
            scrollTrigger: { trigger: "[data-grow]", start: "top bottom", end: "center center", scrub: true },
          }
        );
        gsap.utils.toArray("[data-settle]").forEach((el) => {
          gsap.fromTo(
            el.querySelector("img"),
            { scale: 1.25 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: { trigger: el, start: "top bottom", end: "bottom 60%", scrub: true },
            }
          );
        });
      });
      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  // Play the film only while it's on screen
  useEffect(() => {
    const video = videoRef.current;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), {
      threshold: 0.3,
    });
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <section id="story" ref={sectionRef} className="w-full bg-black section-pad overflow-hidden">
      <div className="screen-max-width page-gutter">
        <h2 data-reveal className="section-heading">
          Explore the full story.
        </h2>

        <div className="my-16 md:my-24 text-center">
          <p data-reveal className="statement text-white">WeldSight.</p>
          <p data-reveal data-reveal-delay="0.15" className="statement shine-text">
            Built for the weld bay.
          </p>
        </div>

        <div data-grow className="relative w-full aspect-[16/9] overflow-hidden rounded-3xl bg-zinc will-change-transform">
          <video
            ref={videoRef}
            src={highlightFourthVideo}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
            aria-label="WeldSight being set up in the field"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { src: protoAngled, alt: "WeldSight prototype, angled view" },
            { src: protoTop2, alt: "WeldSight prototype from above, showing boards and antennas" },
          ].map((img) => (
            <div key={img.src} data-settle className="overflow-hidden rounded-3xl aspect-[4/5] bg-zinc">
              <img src={img.src} alt={img.alt} loading="lazy" className="w-full h-full object-cover will-change-transform" />
            </div>
          ))}
        </div>

        <div className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          <p data-reveal className="feature-text">
            Built from{" "}
            <span className="text-white">a Raspberry Pi, a 5G modem and a 3D-printed chassis</span>, WeldSight
            turns any weld bay into one an expert can inspect from anywhere.
          </p>
          <p data-reveal data-reveal-delay="0.15" className="feature-text">
            Every frame is checked by{" "}
            <span className="text-white">AI for porosity, cracks and undercut</span>, then streamed straight to an
            inspector&apos;s VR headset.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Features;
