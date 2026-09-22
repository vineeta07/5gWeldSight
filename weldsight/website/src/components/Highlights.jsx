import { useRef } from "react";
import VideoCarousel from "./VideoCarousel";
import { useReveal } from "../hooks/useReveal";

const Highlights = () => {
  const sectionRef = useRef(null);
  useReveal(sectionRef);

  return (
    <section id="highlights" ref={sectionRef} className="w-full overflow-hidden bg-zinc section-pad">
      <div className="screen-max-width page-gutter">
        <div className="mb-12 w-full md:flex items-end justify-between gap-6">
          <h2 data-reveal className="section-heading">
            Get the highlights.
          </h2>
          <div data-reveal data-reveal-delay="0.15" className="mt-5 md:mt-0 flex flex-wrap items-end gap-6">
            <a href="#product" className="link">
              See it in 3D
              <Arrow />
            </a>
            <a href="#how" className="link">
              How it works
              <Arrow />
            </a>
          </div>
        </div>
        <VideoCarousel />
      </div>
    </section>
  );
};

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default Highlights;
