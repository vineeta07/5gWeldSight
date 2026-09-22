import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Fades in every element marked with `data-reveal` inside `scopeRef`
 * the first time it scrolls into view.
 *
 * Uses gsap.from, so content is visible by default: if JS is slow or the
 * visitor prefers reduced motion, nothing is ever stuck invisible.
 */
export const useReveal = (scopeRef) => {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 40,
            duration: 0.9,
            ease: "power3.out",
            delay: Number(el.dataset.revealDelay || 0),
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: scopeRef }
  );
};
