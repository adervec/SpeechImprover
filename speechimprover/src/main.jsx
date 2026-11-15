import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Render once the reader's language has loaded (font.js; English resolves at once,
// and a failed fetch resolves empty, so this never blocks the app for long).
Promise.resolve(window.appFont?.ready).catch(() => {}).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

// Register the PWA service worker (base-aware for GitHub Pages subpaths).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  });
}
