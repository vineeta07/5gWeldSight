/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Apple-style palette, as on the reference site
        blue: "#2997FF", // links, buttons, anything interactive
        gray: {
          DEFAULT: "#86868b", // headings and body copy on black
          100: "#94928d",
          200: "#afafaf",
          300: "#42424570", // translucent control pills
        },
        zinc: "#101010", // alternate section background
        // WeldSight accents
        weld: "#FF6B35", // heat, sparks, the housing
        cyan: { DEFAULT: "#00F0FF", dark: "#00B8C4", light: "#7DFFFE" },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', "Inter", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
