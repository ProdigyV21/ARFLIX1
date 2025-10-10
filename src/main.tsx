import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register a basic service worker for offline caching in production.  This will
// cache the app shell and manifest so the application can load when the
// network is unavailable.  The service worker file is located in
// `public/service-worker.js`.  Registration is skipped during local
// development (Vite sets `import.meta.env.DEV`).
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((err) => console.error('Service worker registration failed:', err));
  });
}
