import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Dev-only safety net: if Tailwind didn't run (e.g. postcss.config.js is
// missing), say so loudly instead of showing a broken-looking page.
if (import.meta.env.DEV) {
  requestAnimationFrame(() => {
    const probe = document.createElement("div");
    probe.className = "sr-only";
    document.body.appendChild(probe);
    const ok = getComputedStyle(probe).position === "absolute";
    probe.remove();
    if (!ok) {
      const bar = document.createElement("div");
      bar.textContent =
        "Styles are not compiling: Tailwind isn't running. Make sure postcss.config.js and tailwind.config.js are in the same folder as package.json, then restart `npm run dev`.";
      bar.style.cssText =
        "position:fixed;inset:0 0 auto 0;z-index:99999;background:#e53935;color:#fff;padding:12px 16px;font:14px/1.4 system-ui";
      document.body.appendChild(bar);
      console.error(bar.textContent);
    }
  });
}
