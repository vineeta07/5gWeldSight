import { useEffect, useRef, useState } from "react";
import { navLinks } from "../constants";
import { openChat } from "../utils/chat";
import { DASHBOARD_URL } from "../utils/api";
import logoUrl from "../logo.png";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("");
  const [hidden, setHidden] = useState(false);
  const progressRef = useRef(null);

  // Highlight the link for the section in the middle of the screen
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-50% 0px -50% 0px" }
    );
    navLinks.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Hide while scrolling down, show when scrolling up; update progress bar
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (Math.abs(y - lastY) > 6) {
        setHidden(y > lastY && y > 200);
        lastY = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const show = !hidden || menuOpen;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 h-[var(--nav-h)] bg-black/75 backdrop-blur-xl border-b border-white/[0.06] transition-transform duration-300 ${show ? "translate-y-0" : "-translate-y-full"
        }`}
    >
      <nav className="screen-max-width page-gutter h-full flex items-center justify-between gap-6">
        <a href="#hero" className="flex items-center gap-2 shrink-0" aria-label="WeldSight home">
          <img src={logoUrl} alt="WeldSight" className="w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 object-contain" />
          <span className="font-bold text-lg sm:text-xl md:text-2xl tracking-wide text-white md:-ml-2">WeldSight</span>
        </a>

        <div className="hidden lg:flex items-center gap-8 text-sm font-medium">
          {navLinks.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              className={`transition-colors ${active === id ? "text-white" : "text-gray hover:text-white"}`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openChat}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue text-white text-sm font-medium hover:bg-blue/80 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
            </svg>
            Chat
          </button>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-blue text-blue text-sm font-medium hover:bg-blue hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3" />
            </svg>
            Login
          </a>
          <button
            className="lg:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className={`w-5 h-px bg-white transition-transform duration-300 ${menuOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`w-5 h-px bg-white transition-opacity duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`w-5 h-px bg-white transition-transform duration-300 ${menuOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
          </button>
        </div>
      </nav>

      <div
        ref={progressRef}
        className="absolute bottom-0 left-0 h-px w-full origin-left bg-gradient-to-r from-blue to-weld"
        style={{ transform: "scaleX(0)" }}
        aria-hidden="true"
      />

      {menuOpen && (
        <div className="lg:hidden absolute top-full inset-x-0 bg-black/95 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex flex-col page-gutter py-6 gap-4">
            {navLinks.map(({ id, label }) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)} className="text-2xl font-semibold text-white/90 hover:text-white">
                {label}
              </a>
            ))}
            <button
              onClick={() => {
                setMenuOpen(false);
                openChat();
              }}
              className="self-start mt-2 btn"
            >
              Ask WeldSight AI
            </button>
            <a
              href={DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start btn-outline"
            >
              Login to Dashboard
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
