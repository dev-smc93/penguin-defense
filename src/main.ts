import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 390,
  height: 780,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#0a1628',
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  input: {
    touch: {
      capture: true,
    },
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};

const game = new Phaser.Game(config);

// PWA service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker registration failed - fine for development
    });
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

// Prevent default touch behaviors
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
