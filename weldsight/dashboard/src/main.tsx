import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// @ts-ignore
window._deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  // @ts-ignore
  window._deferredPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
