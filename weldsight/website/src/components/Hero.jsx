import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { weldsightHeroVideo } from "../utils";
import Sparks from "./Sparks";

gsap.registerPlugin(ScrollTrigger);

// The video animates the WeldSight logo itself, so there's no visible title on top.
// Sparks fly from just under the logo, and follow the cursor like a welding torch.
const Hero = () => {
  const [videoReady, setVideoReady] = useState(false);
  const sectionRef = useRef(null);
  const videoRef = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-hero-in]", {
          opacity: 0,
          y: 30,
          duration: 1,
          stagger: 0.15,
          delay: 1.4,
          ease: "power3.out",
        });
        // As you scroll away, the video sinks back and dims, Apple-style
        gsap.to("[data-hero-stage]", {
          scale: 0.88,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: { trigger: sectionRef.current, start: "top top", end: "bottom top", scrub: true },
        });
      });
      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  useEffect(() => {
    const video = videoRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative w-full h-[100svh] min-h-[560px] flex flex-col bg-black pt-[var(--nav-h)] overflow-hidden"
    >
      <h1 className="sr-only">WeldSight: 5G-powered AI industry inspection</h1>

      <div data-hero-stage className="relative flex-1 min-h-0 will-change-transform">
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          src={weldsightHeroVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedData={() => setVideoReady(true)}
        />
        {/* the video's own black is a hair lighter than pure black; this hides the seam */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,#000_80%)]" />
        <Sparks origin={{ x: 0.5, y: 0.68 }} />
        {!videoReady && (
          <div className="absolute inset-0 flex-center" aria-hidden="true">
            <div className="w-10 h-10 border-2 border-blue border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="relative shrink-0 screen-max-width page-gutter w-full pb-12 md:pb-16 flex flex-col items-center text-center">
        <p data-hero-in className="text-gray text-2xl md:text-3xl font-semibold">
          5G-powered AI industry inspection
        </p>
        <div data-hero-in className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <a href="#highlights" className="btn">
            Watch the demo
          </a>
        </div>
        <p data-hero-in className="mt-4 text-xs text-gray hidden md:block">
          Move your cursor over the video.
        </p>
      </div>
    </section>
  );
};

export default Hero;
