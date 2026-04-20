import { Game } from './game/Game';

// Initialize game
const container = document.getElementById('game-container')!;
new Game(container);

// PWA service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// PWA install prompt
let deferredPrompt: Event | null = null;

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    (deferredPrompt as any).prompt();
    await (deferredPrompt as any).userChoice;
    deferredPrompt = null;
  }
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
});

document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  deferredPrompt = null;
});

// Prevent default touch behaviors for mobile
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
