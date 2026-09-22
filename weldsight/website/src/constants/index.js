import {
  highlightFirstVideo,
  highlightSecondVideo,
  highlightThirdVideo,
  highlightFourthVideo,
} from "../utils";

// Each nav item points at a real section id on the page.
export const navLinks = [
  { id: "highlights", label: "Highlights" },
  { id: "product", label: "3D view" },
  { id: "story", label: "Story" },
  { id: "how", label: "How it works" },
  { id: "exhibition", label: "Exhibition" },
];

// Video durations are read from the files themselves, so no need to hard-code them.
// fit: "contain" is for portrait videos so they aren't cropped in the wide frame.
export const highlightsSlides = [
  {
    id: 1,
    textLists: ["5G connectivity.", "Ultra-low latency.", "Real-time weld streaming."],
    video: highlightFirstVideo,
  },
  {
    id: 2,
    textLists: ["AI-powered.", "Automated defect detection."],
    video: highlightSecondVideo,
  },
  {
    id: 3,
    textLists: ["VR visualization.", "Inspect welds from anywhere."],
    video: highlightThirdVideo,
    fit: "contain",
  },
  {
    id: 4,
    textLists: ["Portable design.", "Built for the field."],
    video: highlightFourthVideo,
  },
];

export const features = [
  {
    icon: "📡",
    title: "5G streaming",
    description:
      "Weld footage streams over 5G with ultra-low latency, so inspectors can watch live from anywhere.",
  },
  {
    icon: "🤖",
    title: "AI detection",
    description:
      "Computer vision flags weld defects automatically, so problems are caught while the job is still underway.",
  },
  {
    icon: "🥽",
    title: "VR review",
    description:
      "Inspectors examine welds in an immersive 3D view instead of squinting at a flat screen.",
  },
  {
    icon: "🔧",
    title: "Portable hardware",
    description:
      "Raspberry Pi, 5G modem, camera and a custom 3D-printed housing in one field-ready unit.",
  },
];

// TODO: make sure every number here is accurate before publishing.
export const exhibitionStats = [
  { number: "500+", label: "Visitors" },
  { number: "50+", label: "Live demos" },
  { number: "3", label: "Days" },
  { number: "1st", label: "Prize" },
];

// TODO: confirm this matches what you actually used.
export const techStack = [
  "5G NR",
  "Raspberry Pi",
  "Python",
  "Computer vision",
  "VR/XR",
  "React",
  "GSAP",
  "Gemini",
];

// Clickable parts on the 3D model. Edit the text to match your build.
export const modelParts = [
  {
    id: "camera",
    name: "Pan-tilt camera",
    detail: "A camera module on servo-driven pan and tilt axes, so an inspector can aim it at the seam remotely.",
  },
  {
    id: "antennas",
    name: "5G antennas",
    detail: "Four external antennas feed the 5G modem for the bandwidth and low latency that live weld video needs.",
  },
  {
    id: "compute",
    name: "Raspberry Pi + 5G modem",
    detail: "The compute layer captures video, runs the pipeline and hands frames to the modem for streaming.",
  },
  {
    id: "power",
    name: "Power stage",
    detail: "A regulator board with a finned heatsink and inductor keeps every component on a steady supply.",
  },
  {
    id: "battery",
    name: "Battery housing",
    detail: "The 3D-printed base holds the power pack, so the unit runs untethered on the shop floor.",
  },
];

export const housingColors = [
  { name: "Weld orange", hex: "#FF6B35" },
  { name: "Signal blue", hex: "#2997FF" },
  { name: "Arctic white", hex: "#E6E6E6" },
  { name: "Carbon", hex: "#2B2B2B" },
];
