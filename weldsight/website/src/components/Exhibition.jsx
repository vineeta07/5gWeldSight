import { useRef } from "react";
import { exhibitionImage, ministerImage } from "../utils";
import SectionHeader from "./SectionHeader";
import { useReveal } from "../hooks/useReveal";

const points = [
  {
    icon: "🏛️",
    title: "DTU Innovation Exhibition",
    text: "We showcased WeldSight at the Innovation Exhibition at Delhi Technological University, where the 5G-powered inspection system drew attention from dignitaries and visitors alike.",
  },
  {
    icon: "👥",
    title: "Tested and appreciated",
    text: "The Education Minister, the Vice Chairman of DTU, police officials and hundreds of school students tried the VR inspection first-hand and saw the live 5G stream.",
  },
  {
    icon: "⭐",
    title: "Outstanding response",
    text: "Feedback from industry experts, educators and students backed our goal: industry inspection that is safer, smarter and easier to access.",
  },
];

const Exhibition = () => {
  const sectionRef = useRef(null);
  useReveal(sectionRef);

  return (
    <section id="exhibition" ref={sectionRef} className="w-full overflow-hidden bg-zinc pb-24 pt-8 md:pt-12">
      <div className="screen-max-width page-gutter">
        <SectionHeader
          title="Showcased at DTU"
          subtitle="Innovation Exhibition at Delhi Technological University"
        />

        <div className="flex flex-col gap-12 md:gap-16">
          {/* Minister photo */}
          <figure data-reveal className="relative rounded-3xl overflow-hidden bg-black">
            <img
              src={ministerImage}
              alt="WeldSight being demonstrated to the Education Minister at DTU"
              className="w-full aspect-[4/3] md:aspect-[16/9] object-cover"
            />
            <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
            <figcaption className="sm:absolute sm:bottom-0 sm:inset-x-0 p-5 sm:p-8">
              <div className="sm:glass-card sm:p-6 max-w-2xl">
                <h3 className="font-outfit font-bold text-xl sm:text-2xl md:text-3xl text-white mb-2">
                  Recognised by leaders
                </h3>
                <p className="text-gray text-sm sm:text-base leading-relaxed">
                  We presented the prototype to the Education Minister and the Vice Chairman of DTU,
                  who took a keen interest in 5G-powered industry inspection.
                </p>
              </div>
            </figcaption>
          </figure>

          {/* Photo + story */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div data-reveal className="relative rounded-2xl overflow-hidden">
              <img
                src={exhibitionImage}
                alt="The WeldSight stand at the DTU Innovation Exhibition"
                className="w-full aspect-square object-cover"
              />
            </div>

            <div className="flex flex-col gap-8">
              {points.map((p, i) => (
                <div key={p.title} data-reveal data-reveal-delay={i * 0.1}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue/30 to-weld/30 flex-center text-lg" aria-hidden="true">
                      {p.icon}
                    </div>
                    <h3 className="font-outfit font-semibold text-xl sm:text-2xl text-white">{p.title}</h3>
                  </div>
                  <p className="text-gray text-sm sm:text-base leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Exhibition;
