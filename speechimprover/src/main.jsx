import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Let the app portal know (same-origin localStorage) that this app is installed.
try {
  const modes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];
  if (navigator.standalone || modes.some((m) => matchMedia(`(display-mode: ${m})`).matches)) {
    const key = 'portal-installed';
    const registry = JSON.parse(localStorage.getItem(key) || '{}');
    registry.SpeechImprover = Date.now();
    localStorage.setItem(key, JSON.stringify(registry));
  }
} catch { /* quota / private mode */ }

// Register the PWA service worker (base-aware for GitHub Pages subpaths).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  });
}
