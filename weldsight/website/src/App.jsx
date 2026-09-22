import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Highlights from "./components/Highlights";
import ModelSection from "./components/ModelSection";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Exhibition from "./components/Exhibition";
import Footer from "./components/Footer";
import ChatWidget from "./components/ChatWidget";

const App = () => {
  // ScrollTrigger measures positions when it starts. Images, videos and web
  // fonts load afterwards and push content down, which made scroll animations
  // fire in the wrong places. Re-measure once everything has loaded.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState === "complete") refresh();
    else window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh);
    return () => window.removeEventListener("load", refresh);
  }, []);

  return (
    <>
      <Navbar />
      <main className="bg-black">
        <Hero />
        <Highlights />
        <ModelSection />
        <Features />
        <HowItWorks />
        <Exhibition />
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
};

export default App;
