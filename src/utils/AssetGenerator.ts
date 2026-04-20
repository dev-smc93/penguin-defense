import * as Phaser from 'phaser';
import { HERO_DATA } from '../data/HeroData';
import { ENEMY_DATA } from '../data/EnemyData';

export function generateAssets(scene: Phaser.Scene): void {
  generateTileTextures(scene);
  generateHeroTextures(scene);
  generateEnemyTextures(scene);
  generateProjectileTextures(scene);
  generateUITextures(scene);
  generateParticleTextures(scene);
}

function lighten(color: number, amount: number): number {
  let r = (color >> 16) & 0xff;
  let g = (color >> 8) & 0xff;
  let b = color & 0xff;
  r = Math.min(255, r + amount);
  g = Math.min(255, g + amount);
  b = Math.min(255, b + amount);
  return Phaser.Display.Color.GetColor(r, g, b);
}

function darken(color: number, amount: number): number {
  let r = (color >> 16) & 0xff;
  let g = (color >> 8) & 0xff;
  let b = color & 0xff;
  r = Math.max(0, r - amount);
  g = Math.max(0, g - amount);
  b = Math.max(0, b - amount);
  return Phaser.Display.Color.GetColor(r, g, b);
}

// ============================================================
//  TILES - Ice / Snow theme
// ============================================================
function generateTileTextures(scene: Phaser.Scene): void {
  const ts = 48;

  // --- Snow tile (hero placement slot) ---
  const grassG = scene.add.graphics();
  for (let i = 0; i < ts; i++) {
    const t = Math.abs(i - ts / 2) / (ts / 2);
    const base = Math.floor(60 + (1 - t) * 20);
    grassG.fillStyle(Phaser.Display.Color.GetColor(base + 30, base + 40, base + 55), 1);
    grassG.fillRect(0, i, ts, 1);
  }
  // Snow sparkles
  for (let i = 0; i < 10; i++) {
    const x = Phaser.Math.Between(4, ts - 4);
    const y = Phaser.Math.Between(4, ts - 4);
    grassG.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.15, 0.4));
    grassG.fillCircle(x, y, Phaser.Math.Between(1, 2));
  }
  // Ice crystal details
  grassG.lineStyle(1, 0xb3e5fc, 0.2);
  for (let i = 0; i < 4; i++) {
    const x = Phaser.Math.Between(8, ts - 8);
    const y = Phaser.Math.Between(8, ts - 8);
    grassG.beginPath();
    grassG.moveTo(x, y - 4);
    grassG.lineTo(x, y + 4);
    grassG.strokePath();
    grassG.beginPath();
    grassG.moveTo(x - 3, y - 2);
    grassG.lineTo(x + 3, y + 2);
    grassG.strokePath();
  }
  // Subtle edges
  grassG.fillStyle(0xffffff, 0.06);
  grassG.fillRect(1, 1, ts - 2, ts / 2);
  grassG.fillStyle(0x000000, 0.08);
  grassG.fillRect(0, 0, ts, 1);
  grassG.fillRect(0, 0, 1, ts);
  grassG.fillStyle(0x90caf9, 0.08);
  grassG.fillRect(0, ts - 1, ts, 1);
  grassG.fillRect(ts - 1, 0, 1, ts);
  grassG.generateTexture('tile_grass', ts, ts);
  grassG.destroy();

  // --- Ice path tile ---
  const pathG = scene.add.graphics();
  for (let i = 0; i < ts; i++) {
    const t = Math.abs(i - ts / 2) / (ts / 2);
    const base = Math.floor(40 + (1 - t) * 15);
    pathG.fillStyle(Phaser.Display.Color.GetColor(base + 10, base + 20, base + 40), 1);
    pathG.fillRect(0, i, ts, 1);
  }
  // Ice cracks
  pathG.lineStyle(1, 0x81d4fa, 0.2);
  for (let i = 0; i < 5; i++) {
    const x1 = Phaser.Math.Between(4, ts - 4);
    const y1 = Phaser.Math.Between(4, ts - 4);
    pathG.beginPath();
    pathG.moveTo(x1, y1);
    pathG.lineTo(x1 + Phaser.Math.Between(-10, 10), y1 + Phaser.Math.Between(-10, 10));
    pathG.strokePath();
  }
  // Frost patches
  for (let i = 0; i < 4; i++) {
    pathG.fillStyle(0xb3e5fc, 0.12);
    pathG.fillCircle(Phaser.Math.Between(6, ts - 6), Phaser.Math.Between(6, ts - 6), Phaser.Math.Between(3, 7));
  }
  pathG.fillStyle(0xffffff, 0.04);
  pathG.fillRect(1, 1, ts - 2, 1);
  pathG.fillStyle(0x000000, 0.12);
  pathG.fillRect(0, 0, ts, 1);
  pathG.fillRect(0, 0, 1, ts);
  pathG.fillRect(0, ts - 1, ts, 1);
  pathG.fillRect(ts - 1, 0, 1, ts);
  pathG.generateTexture('tile_path', ts, ts);
  pathG.destroy();

  // --- Highlight tile ---
  const hlG = scene.add.graphics();
  hlG.fillStyle(0x4fc3f7, 0.15);
  hlG.fillRect(0, 0, ts, ts);
  hlG.lineStyle(2, 0x29b6f6, 0.9);
  hlG.strokeRect(2, 2, ts - 4, ts - 4);
  hlG.lineStyle(1, 0x81d4fa, 0.4);
  hlG.strokeRect(4, 4, ts - 8, ts - 8);
  const corner = 8;
  hlG.lineStyle(2, 0x4fc3f7, 1);
  hlG.beginPath(); hlG.moveTo(2, corner + 2); hlG.lineTo(2, 2); hlG.lineTo(corner + 2, 2); hlG.strokePath();
  hlG.beginPath(); hlG.moveTo(ts - corner - 2, 2); hlG.lineTo(ts - 2, 2); hlG.lineTo(ts - 2, corner + 2); hlG.strokePath();
  hlG.beginPath(); hlG.moveTo(2, ts - corner - 2); hlG.lineTo(2, ts - 2); hlG.lineTo(corner + 2, ts - 2); hlG.strokePath();
  hlG.beginPath(); hlG.moveTo(ts - corner - 2, ts - 2); hlG.lineTo(ts - 2, ts - 2); hlG.lineTo(ts - 2, ts - corner - 2); hlG.strokePath();
  hlG.generateTexture('tile_highlight', ts, ts);
  hlG.destroy();

  // --- Invalid tile ---
  const invG = scene.add.graphics();
  invG.fillStyle(0xf44336, 0.12);
  invG.fillRect(0, 0, ts, ts);
  invG.lineStyle(2, 0xf44336, 0.7);
  invG.strokeRect(2, 2, ts - 4, ts - 4);
  invG.lineStyle(2, 0xf44336, 0.5);
  invG.beginPath(); invG.moveTo(12, 12); invG.lineTo(ts - 12, ts - 12); invG.strokePath();
  invG.beginPath(); invG.moveTo(ts - 12, 12); invG.lineTo(12, ts - 12); invG.strokePath();
  invG.generateTexture('tile_invalid', ts, ts);
  invG.destroy();
}

// ============================================================
//  PENGUIN HEROES
// ============================================================
function generateHeroTextures(scene: Phaser.Scene): void {
  const size = 44;
  const half = size / 2;

  for (const [key, data] of Object.entries(HERO_DATA)) {
    const g = scene.add.graphics();
    const col = data.color;
    const light = lighten(col, 60);

    // === Penguin body ===
    // White belly
    g.fillStyle(0x263238, 1);
    g.fillEllipse(half, half - 2, 22, 26); // dark body
    g.fillStyle(0xe0e0e0, 1);
    g.fillEllipse(half, half, 14, 18); // white belly

    // Type-specific hat/accessory color
    g.fillStyle(col, 1);
    // Hat
    g.fillRoundedRect(half - 9, half - 16, 18, 8, 3);
    g.fillStyle(light, 0.6);
    g.fillRect(half - 7, half - 15, 14, 2);

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(half - 4, half - 5, 6, 5);
    g.fillEllipse(half + 4, half - 5, 6, 5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(half - 3, half - 5, 2);
    g.fillCircle(half + 5, half - 5, 2);
    // Eye shine
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(half - 4, half - 6, 1);
    g.fillCircle(half + 4, half - 6, 1);

    // Beak
    g.fillStyle(0xff9800, 1);
    g.fillTriangle(half - 3, half - 1, half + 3, half - 1, half, half + 3);
    g.fillStyle(0xffa726, 0.7);
    g.fillTriangle(half - 2, half - 1, half + 2, half - 1, half, half + 1);

    // Feet
    g.fillStyle(0xff9800, 1);
    g.fillEllipse(half - 5, half + 12, 6, 3);
    g.fillEllipse(half + 5, half + 12, 6, 3);

    // Type-specific weapon/accessory
    if (key === 'archer') {
      // Bow on right side
      g.lineStyle(2, 0x8d6e63, 1);
      g.beginPath();
      g.moveTo(half + 12, half - 10);
      g.lineTo(half + 14, half - 2);
      g.lineTo(half + 12, half + 6);
      g.strokePath();
      g.lineStyle(1, 0xffd54f, 0.8);
      g.beginPath();
      g.moveTo(half + 12, half - 10);
      g.lineTo(half + 12, half + 6);
      g.strokePath();
      // Arrow
      g.lineStyle(1, 0x8d6e63, 1);
      g.beginPath();
      g.moveTo(half + 8, half - 2);
      g.lineTo(half + 18, half - 2);
      g.strokePath();
      g.fillStyle(0xf44336, 1);
      g.fillTriangle(half + 18, half - 2, half + 15, half - 4, half + 15, half);
    } else if (key === 'warrior') {
      // Sword on right
      g.fillStyle(0xbdbdbd, 1);
      g.fillRect(half + 10, half - 14, 3, 16);
      g.fillStyle(0xe0e0e0, 0.7);
      g.fillRect(half + 10, half - 14, 1, 16);
      // Guard
      g.fillStyle(0xffd700, 1);
      g.fillRect(half + 8, half + 1, 7, 3);
      // Handle
      g.fillStyle(0x795548, 1);
      g.fillRect(half + 10, half + 4, 3, 5);
      // Shield on left
      g.fillStyle(col, 1);
      g.fillRoundedRect(half - 16, half - 6, 10, 14, 3);
      g.fillStyle(light, 0.4);
      g.fillRoundedRect(half - 15, half - 5, 8, 5, 2);
    } else if (key === 'mage') {
      // Wizard hat (taller)
      g.fillStyle(col, 1);
      g.beginPath();
      g.moveTo(half, half - 24);
      g.lineTo(half + 11, half - 12);
      g.lineTo(half - 11, half - 12);
      g.closePath();
      g.fillPath();
      g.fillStyle(light, 0.5);
      g.beginPath();
      g.moveTo(half, half - 22);
      g.lineTo(half + 6, half - 13);
      g.lineTo(half - 2, half - 13);
      g.closePath();
      g.fillPath();
      // Star on hat
      g.fillStyle(0xffd700, 1);
      g.fillCircle(half, half - 18, 2);
      // Staff
      g.fillStyle(0x8d6e63, 1);
      g.fillRect(half + 12, half - 12, 2, 22);
      g.fillStyle(col, 1);
      g.fillCircle(half + 13, half - 14, 4);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(half + 13, half - 14, 2);
    } else if (key === 'ice') {
      // Ice crown
      g.fillStyle(0x4fc3f7, 0.8);
      g.fillTriangle(half - 8, half - 14, half - 5, half - 22, half - 2, half - 14);
      g.fillTriangle(half - 2, half - 14, half, half - 24, half + 2, half - 14);
      g.fillTriangle(half + 2, half - 14, half + 5, half - 22, half + 8, half - 14);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(half - 5, half - 18, 1);
      g.fillCircle(half, half - 20, 1);
      g.fillCircle(half + 5, half - 18, 1);
      // Ice crystal in flipper
      g.fillStyle(0x81d4fa, 0.8);
      g.beginPath();
      g.moveTo(half + 14, half - 6);
      g.lineTo(half + 12, half + 4);
      g.lineTo(half + 16, half + 4);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(half + 14, half - 2, 1);
    } else if (key === 'thunder') {
      // Lightning bolt headband
      g.fillStyle(col, 1);
      g.fillRoundedRect(half - 10, half - 16, 20, 5, 2);
      // Lightning bolt emblem
      g.fillStyle(col, 1);
      g.beginPath();
      g.moveTo(half + 2, half - 20);
      g.lineTo(half - 2, half - 14);
      g.lineTo(half + 1, half - 14);
      g.lineTo(half - 2, half - 8);
      g.lineTo(half + 4, half - 14);
      g.lineTo(half + 1, half - 14);
      g.closePath();
      g.fillPath();
      // Electric sparks around
      g.lineStyle(1, col, 0.6);
      g.beginPath(); g.moveTo(half - 12, half - 4); g.lineTo(half - 16, half - 8); g.strokePath();
      g.beginPath(); g.moveTo(half + 12, half - 4); g.lineTo(half + 16, half - 8); g.strokePath();
      g.fillStyle(col, 0.4);
      g.fillCircle(half - 16, half - 8, 2);
      g.fillCircle(half + 16, half - 8, 2);
    }

    g.generateTexture(`hero_${key}`, size, size);
    g.destroy();

    // Range indicator
    const rangeSize = (data.baseRange + 40) * 2;
    const rHalf = rangeSize / 2;
    const rangeG = scene.add.graphics();
    for (let r = rHalf; r > rHalf - 8; r -= 2) {
      const alpha = 0.02 + (rHalf - r) * 0.01;
      rangeG.fillStyle(data.color, alpha);
      rangeG.fillCircle(rHalf, rHalf, r);
    }
    rangeG.lineStyle(1.5, data.color, 0.25);
    rangeG.strokeCircle(rHalf, rHalf, rHalf - 1);
    rangeG.generateTexture(`range_${key}`, rangeSize, rangeSize);
    rangeG.destroy();
  }
}

// ============================================================
//  ZOMBIE ENEMIES
// ============================================================
function generateEnemyTextures(scene: Phaser.Scene): void {
  for (const [key, data] of Object.entries(ENEMY_DATA)) {
    const pad = 8;
    const size = data.size * 2 + pad * 2;
    const g = scene.add.graphics();
    const cx = size / 2;
    const cy = size / 2;
    const r = data.size;
    const light = lighten(data.color, 50);
    const dark = darken(data.color, 40);

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(cx + 1, cy + r * 0.5, r * 1.8, r * 0.6);

    if (key === 'goblin') {
      // Basic zombie
      g.fillStyle(dark, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(data.color, 1);
      g.fillCircle(cx, cy, r - 1);
      // Decomposed patches
      g.fillStyle(darken(data.color, 30), 0.5);
      g.fillCircle(cx - 3, cy + 1, 3);
      g.fillCircle(cx + 4, cy - 1, 2);
      // Eyes (one bigger than other - zombie style)
      g.fillStyle(0xffffff, 0.9);
      g.fillEllipse(cx - 3, cy - 2, 5, 4);
      g.fillEllipse(cx + 3, cy - 2, 3, 4);
      g.fillStyle(0xf44336, 1);
      g.fillCircle(cx - 3, cy - 2, 1.5);
      g.fillCircle(cx + 3, cy - 2, 1);
      // Mouth with teeth
      g.lineStyle(1, dark, 0.8);
      g.beginPath(); g.moveTo(cx - 3, cy + 3); g.lineTo(cx + 3, cy + 4); g.strokePath();
      g.fillStyle(0xffffff, 0.8);
      g.fillRect(cx - 2, cy + 2, 1, 2);
      g.fillRect(cx + 1, cy + 3, 1, 2);
    } else if (key === 'orc') {
      // Armored zombie
      g.fillStyle(0x4e6e4e, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(data.color, 0.9);
      g.fillCircle(cx, cy, r - 1);
      // Armor plate
      g.fillStyle(0x455a64, 0.85);
      g.fillRoundedRect(cx - 7, cy - 5, 14, 12, 2);
      g.lineStyle(1, 0x607d8b, 0.6);
      g.strokeRoundedRect(cx - 7, cy - 5, 14, 12, 2);
      // Rivets
      g.fillStyle(0x78909c, 0.8);
      g.fillCircle(cx - 5, cy - 2, 1);
      g.fillCircle(cx + 5, cy - 2, 1);
      // Glowing eyes through visor
      g.fillStyle(0x000000, 0.8);
      g.fillRect(cx - 6, cy - 5, 12, 4);
      g.fillStyle(0x76ff03, 1);
      g.fillCircle(cx - 3, cy - 3, 1.5);
      g.fillCircle(cx + 3, cy - 3, 1.5);
    } else if (key === 'troll') {
      // Giant zombie
      g.fillStyle(dark, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(data.color, 1);
      g.fillCircle(cx, cy, r - 1);
      // Stitched marks
      g.lineStyle(1, darken(data.color, 50), 0.6);
      g.beginPath(); g.moveTo(cx - 5, cy - 6); g.lineTo(cx - 5, cy + 6); g.strokePath();
      for (let i = -4; i <= 4; i += 2) {
        g.beginPath(); g.moveTo(cx - 7, cy + i); g.lineTo(cx - 3, cy + i); g.strokePath();
      }
      // Glowing eyes
      g.fillStyle(0xff1744, 1);
      g.fillCircle(cx - 4, cy - 3, 2.5);
      g.fillCircle(cx + 4, cy - 3, 2.5);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(cx - 4, cy - 3, 1);
      g.fillCircle(cx + 4, cy - 3, 1);
      // Exposed bone
      g.fillStyle(0xefebe9, 0.7);
      g.fillRoundedRect(cx + 5, cy + 2, 4, 6, 1);
    } else if (key === 'dragon') {
      // Ghost
      // Transparent body effect
      g.fillStyle(data.color, 0.15);
      g.fillCircle(cx, cy, r + 4);
      g.fillStyle(data.color, 0.3);
      g.fillCircle(cx, cy, r + 2);
      // Ghost body
      g.fillStyle(data.color, 0.7);
      g.fillEllipse(cx, cy - 2, r * 2, r * 1.8);
      // Wavy bottom
      for (let i = 0; i < 4; i++) {
        g.fillStyle(data.color, 0.5);
        g.fillCircle(cx - r + 3 + i * (r * 2 - 6) / 3, cy + r - 4, 4);
      }
      // Face
      g.fillStyle(0x000000, 0.8);
      g.fillCircle(cx - 3, cy - 3, 2.5);
      g.fillCircle(cx + 3, cy - 3, 2.5);
      // Mouth (O shape)
      g.fillStyle(0x000000, 0.6);
      g.fillEllipse(cx, cy + 3, 4, 5);
      // Inner glow
      g.fillStyle(0xffffff, 0.15);
      g.fillEllipse(cx - 2, cy - 4, r, r * 0.8);
    } else if (key === 'boss') {
      // Zombie King
      g.fillStyle(0xff1744, 0.08);
      g.fillCircle(cx, cy, r + 8);
      g.fillStyle(0xff1744, 0.05);
      g.fillCircle(cx, cy, r + 12);
      // Body
      g.fillStyle(0x2e7d32, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(0x388e3c, 1);
      g.fillCircle(cx, cy, r - 2);
      // Armor
      g.fillStyle(0x37474f, 0.7);
      g.fillRoundedRect(cx - r + 4, cy - 6, r * 2 - 8, 14, 4);
      g.lineStyle(1, 0x546e7a, 0.5);
      g.strokeRoundedRect(cx - r + 4, cy - 6, r * 2 - 8, 14, 4);
      // Skull face
      g.fillStyle(data.color, 1);
      g.fillRoundedRect(cx - 7, cy - 8, 14, 10, 3);
      // Glowing eyes
      g.fillStyle(0xff1744, 1);
      g.fillCircle(cx - 4, cy - 4, 2.5);
      g.fillCircle(cx + 4, cy - 4, 2.5);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(cx - 4, cy - 4, 1);
      g.fillCircle(cx + 4, cy - 4, 1);
      // Crown
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx - 9, cy - r - 1, 18, 4);
      g.fillTriangle(cx - 9, cy - r - 1, cx - 7, cy - r - 8, cx - 5, cy - r - 1);
      g.fillTriangle(cx - 2, cy - r - 1, cx, cy - r - 10, cx + 2, cy - r - 1);
      g.fillTriangle(cx + 5, cy - r - 1, cx + 7, cy - r - 8, cx + 9, cy - r - 1);
      g.fillStyle(0xf44336, 1);
      g.fillCircle(cx, cy - r - 7, 1.5);
    }

    g.generateTexture(`enemy_${key}`, size, size);
    g.destroy();
  }
}

// ============================================================
//  PROJECTILES
// ============================================================
function generateProjectileTextures(scene: Phaser.Scene): void {
  for (const [key, data] of Object.entries(HERO_DATA)) {
    const size = 16;
    const half = size / 2;
    const g = scene.add.graphics();

    if (key === 'archer') {
      g.fillStyle(data.projectileColor, 0.15);
      g.fillCircle(half, half, 6);
      g.fillStyle(data.projectileColor, 1);
      g.beginPath();
      g.moveTo(half + 4, half);
      g.lineTo(half - 3, half - 2);
      g.lineTo(half - 3, half + 2);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(half + 3, half, 1);
    } else if (key === 'warrior') {
      // Slash wave
      g.fillStyle(data.projectileColor, 0.2);
      g.fillCircle(half, half, 6);
      g.fillStyle(data.projectileColor, 0.8);
      g.beginPath();
      g.moveTo(half + 5, half - 3);
      g.lineTo(half - 3, half);
      g.lineTo(half + 5, half + 3);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.6);
      g.fillRect(half - 1, half - 1, 5, 2);
    } else if (key === 'mage') {
      // Magic orb
      g.fillStyle(data.projectileColor, 0.2);
      g.fillCircle(half, half, 7);
      g.fillStyle(data.projectileColor, 0.5);
      g.fillCircle(half, half, 5);
      g.fillStyle(data.color, 0.8);
      g.fillCircle(half, half, 3.5);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(half - 1, half - 1, 1.5);
    } else if (key === 'ice') {
      g.fillStyle(0x4fc3f7, 0.2);
      g.fillCircle(half, half, 7);
      g.fillStyle(data.projectileColor, 0.8);
      g.beginPath();
      g.moveTo(half + 5, half);
      g.lineTo(half, half - 3);
      g.lineTo(half - 4, half);
      g.lineTo(half, half + 3);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(half + 1, half - 1, 1.5);
    } else if (key === 'thunder') {
      g.fillStyle(data.projectileColor, 0.15);
      g.fillCircle(half, half, 7);
      g.fillStyle(data.projectileColor, 0.3);
      g.fillCircle(half, half, 5);
      g.fillStyle(data.projectileColor, 0.7);
      g.fillCircle(half, half, 3.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(half, half, 2);
      g.lineStyle(1, data.projectileColor, 0.6);
      g.beginPath(); g.moveTo(half, half - 3); g.lineTo(half - 4, half - 6); g.strokePath();
      g.beginPath(); g.moveTo(half + 3, half); g.lineTo(half + 6, half - 3); g.strokePath();
    }

    g.generateTexture(`proj_${key}`, size, size);
    g.destroy();
  }
}

// ============================================================
//  UI
// ============================================================
function generateUITextures(scene: Phaser.Scene): void {
  // Coin
  const coinG = scene.add.graphics();
  coinG.fillStyle(0xf9a825, 1);
  coinG.fillCircle(12, 12, 10);
  coinG.fillStyle(0xffd700, 1);
  coinG.fillCircle(12, 12, 8);
  coinG.fillStyle(0xffecb3, 0.6);
  coinG.fillCircle(10, 10, 4);
  coinG.lineStyle(1.5, 0xf57f17, 0.8);
  coinG.beginPath(); coinG.moveTo(12, 8); coinG.lineTo(12, 16); coinG.strokePath();
  coinG.beginPath(); coinG.moveTo(10, 9); coinG.lineTo(14, 9); coinG.strokePath();
  coinG.beginPath(); coinG.moveTo(10, 15); coinG.lineTo(14, 15); coinG.strokePath();
  coinG.fillStyle(0xffffff, 0.4);
  coinG.fillCircle(9, 9, 2);
  coinG.generateTexture('coin', 24, 24);
  coinG.destroy();

  // Heart
  const heartG = scene.add.graphics();
  heartG.fillStyle(0xf44336, 0.2);
  heartG.fillCircle(12, 12, 12);
  heartG.fillStyle(0xf44336, 1);
  heartG.fillCircle(8, 8, 5);
  heartG.fillCircle(16, 8, 5);
  heartG.fillTriangle(3, 10, 12, 20, 21, 10);
  heartG.fillStyle(0xff8a80, 0.6);
  heartG.fillCircle(7, 7, 2);
  heartG.fillStyle(0xffffff, 0.4);
  heartG.fillCircle(7, 6, 1);
  heartG.generateTexture('heart', 24, 24);
  heartG.destroy();

  // Wave icon
  const waveIconG = scene.add.graphics();
  waveIconG.fillStyle(0x4fc3f7, 0.2);
  waveIconG.fillCircle(12, 12, 12);
  waveIconG.fillStyle(0x4fc3f7, 1);
  waveIconG.fillCircle(12, 12, 9);
  waveIconG.fillStyle(0x81d4fa, 0.5);
  waveIconG.fillCircle(10, 10, 4);
  // Skull
  waveIconG.fillStyle(0xffffff, 0.9);
  waveIconG.fillCircle(12, 10, 4);
  waveIconG.fillRect(10, 13, 4, 3);
  waveIconG.fillStyle(0x4fc3f7, 1);
  waveIconG.fillCircle(10, 10, 1);
  waveIconG.fillCircle(14, 10, 1);
  waveIconG.generateTexture('wave_icon', 24, 24);
  waveIconG.destroy();
}

// ============================================================
//  PARTICLES
// ============================================================
function generateParticleTextures(scene: Phaser.Scene): void {
  // Soft glow
  const pG = scene.add.graphics();
  pG.fillStyle(0xffffff, 0.1);
  pG.fillCircle(8, 8, 8);
  pG.fillStyle(0xffffff, 0.3);
  pG.fillCircle(8, 8, 5);
  pG.fillStyle(0xffffff, 0.8);
  pG.fillCircle(8, 8, 3);
  pG.fillStyle(0xffffff, 1);
  pG.fillCircle(8, 8, 1.5);
  pG.generateTexture('particle', 16, 16);
  pG.destroy();

  // Explosion
  const eG = scene.add.graphics();
  eG.fillStyle(0xff6600, 0.1);
  eG.fillCircle(10, 10, 10);
  eG.fillStyle(0xff8800, 0.3);
  eG.fillCircle(10, 10, 7);
  eG.fillStyle(0xffcc00, 0.6);
  eG.fillCircle(10, 10, 4);
  eG.fillStyle(0xffffff, 0.8);
  eG.fillCircle(10, 10, 2);
  eG.generateTexture('particle_explosion', 20, 20);
  eG.destroy();

  // Ice
  const iG = scene.add.graphics();
  iG.fillStyle(0x4fc3f7, 0.1);
  iG.fillCircle(8, 8, 8);
  iG.fillStyle(0x81d4fa, 0.4);
  iG.fillCircle(8, 8, 5);
  iG.fillStyle(0xe1f5fe, 0.8);
  iG.fillCircle(8, 8, 2.5);
  iG.fillStyle(0xffffff, 1);
  iG.fillCircle(8, 8, 1);
  iG.generateTexture('particle_ice', 16, 16);
  iG.destroy();

  // Spark
  const sG = scene.add.graphics();
  sG.fillStyle(0xffffff, 0.1);
  sG.fillCircle(6, 6, 6);
  sG.fillStyle(0xffffff, 0.6);
  sG.fillRect(5, 2, 2, 8);
  sG.fillRect(2, 5, 8, 2);
  sG.fillStyle(0xffffff, 1);
  sG.fillCircle(6, 6, 1.5);
  sG.generateTexture('particle_spark', 12, 12);
  sG.destroy();

  // Snow particle
  const snowG = scene.add.graphics();
  snowG.fillStyle(0xffffff, 0.3);
  snowG.fillCircle(4, 4, 4);
  snowG.fillStyle(0xffffff, 0.7);
  snowG.fillCircle(4, 4, 2);
  snowG.fillStyle(0xffffff, 1);
  snowG.fillCircle(4, 4, 1);
  snowG.generateTexture('particle_snow', 8, 8);
  snowG.destroy();
}
