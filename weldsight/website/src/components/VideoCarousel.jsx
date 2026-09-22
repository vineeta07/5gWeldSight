import { useCallback, useEffect, useRef, useState } from "react";
import { highlightsSlides } from "../constants";

// Inline icons (the old replay.svg file had JSX attribute names and rendered badly)
const Icon = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const icons = {
  Play: <Icon><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" /></Icon>,
  Pause: <Icon><rect x="6" y="4" width="4" height="16" fill="currentColor" /><rect x="14" y="4" width="4" height="16" fill="currentColor" /></Icon>,
  Replay: <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>,
};

/**
 * Autoplaying video carousel.
 * - Starts when it scrolls into view, pauses when it leaves.
 * - Progress comes from each video's real duration.
 * - Dots are buttons: click to jump to any clip.
 * - Arrow keys work when the carousel has focus.
 */
const VideoCarousel = () => {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [finished, setFinished] = useState(false);

  const wrapperRef = useRef(null);
  const videoRefs = useRef([]);
  const fillRefs = useRef([]);

  const last = highlightsSlides.length - 1;

  // Play/pause based on visibility
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.4,
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep exactly one video playing: the active one, when it should be
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index && isPlaying && inView && !finished) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [index, isPlaying, inView, finished]);

  // Progress bar: read currentTime every frame and write the width directly
  useEffect(() => {
    let frame;
    const tick = () => {
      const video = videoRefs.current[index];
      const fill = fillRefs.current[index];
      if (video && fill && video.duration) {
        fill.style.width = `${(video.currentTime / video.duration) * 100}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index]);

  const goTo = useCallback((i) => {
    fillRefs.current.forEach((fill, j) => fill && (fill.style.width = j < i ? "100%" : "0%"));
    const video = videoRefs.current[i];
    if (video) video.currentTime = 0;
    setFinished(false);
    setIsPlaying(true);
    setIndex(i);
  }, []);

  const handleEnded = (i) => {
    if (i !== index) return;
    if (i < last) goTo(i + 1);
    else setFinished(true);
  };

  const handleControl = () => {
    if (finished) goTo(0);
    else setIsPlaying((p) => !p);
  };

  const handleKey = (e) => {
    if (e.key === "ArrowRight" && index < last) goTo(index + 1);
    if (e.key === "ArrowLeft" && index > 0) goTo(index - 1);
  };

  const controlLabel = finished ? "Replay" : isPlaying ? "Pause" : "Play";

  return (
    <div
      ref={wrapperRef}
      onKeyDown={handleKey}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Product highlight videos"
      className="focus:outline-none"
    >
      {/* Track */}
      <div
        className="carousel-track flex gap-5 transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{ transform: `translateX(calc(${-index} * (var(--slide-w) + 1.25rem)))` }}
      >
        {highlightsSlides.map((slide, i) => (
          <div
            key={slide.id}
            className="carousel-slide shrink-0 relative aspect-video rounded-3xl overflow-hidden bg-black"
            aria-hidden={i !== index}
          >
            <video
              ref={(el) => (videoRefs.current[i] = el)}
              src={slide.video}
              muted
              playsInline
              preload={i === 0 ? "auto" : "metadata"}
              onEnded={() => handleEnded(i)}
              className={`w-full h-full pointer-events-none ${
                slide.fit === "contain" ? "object-contain" : "object-cover"
              }`}
            />
            {/* Soft shade so the captions stay readable on bright footage */}
            <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10">
              {slide.textLists.map((text) => (
                <p key={text} className="text-lg md:text-2xl font-medium leading-snug">
                  {text}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="mt-8 flex-center gap-4">
        <div className="flex items-center gap-3 py-5 px-6 bg-gray-300 backdrop-blur rounded-full">
          {highlightsSlides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => goTo(i)}
              aria-label={`Play clip ${i + 1}: ${slide.textLists[0]}`}
              aria-current={i === index ? "true" : undefined}
              className={`relative h-3 rounded-full bg-gray-200/60 overflow-hidden transition-all duration-500 ${
                i === index ? "w-12" : "w-3 hover:bg-gray-200"
              }`}
            >
              <span
                ref={(el) => (fillRefs.current[i] = el)}
                className={`absolute inset-y-0 left-0 rounded-full ${i === index ? "bg-white" : "bg-transparent"}`}
                style={{ width: "0%" }}
              />
            </button>
          ))}
        </div>

        <button onClick={handleControl} className="control-btn text-white" aria-label={controlLabel}>
          {icons[controlLabel]}
        </button>
      </div>
    </div>
  );
};

export default VideoCarousel;
