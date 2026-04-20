import * as Phaser from 'phaser';
import {
  HERO_DATA, HeroTypeConfig, TIER_COLORS, TIER_NAMES,
  getHeroDamage, getHeroRange, getHeroFireRate, getHeroSellValue, MAX_TIER,
} from '../data/HeroData';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { playShoot } from '../utils/SoundManager';

export class Hero extends Phaser.GameObjects.Container {
  public heroType: string;
  public config: HeroTypeConfig;
  public tier: number;
  public gridCol: number;
  public gridRow: number;

  private fireTimer: number = 0;
  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Graphics;
  private glowGraphics: Phaser.GameObjects.Graphics;
  private tierStars: Phaser.GameObjects.Graphics;
  private tierBadge: Phaser.GameObjects.Graphics;
  private glowPhase: number = Math.random() * Math.PI * 2;
  private rangeCircle: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    heroType: string,
    tier: number,
    gridCol: number,
    gridRow: number,
  ) {
    super(scene, x, y);
    this.heroType = heroType;
    this.tier = tier;
    this.config = HERO_DATA[heroType];
    this.gridCol = gridCol;
    this.gridRow = gridRow;

    // Shadow
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.25);
    this.shadow.fillEllipse(2, 16, 28, 10);
    this.add(this.shadow);

    // Glow aura (drawn in update)
    this.glowGraphics = scene.add.graphics();
    this.add(this.glowGraphics);

    // Sprite
    this.sprite = scene.add.image(0, -3, `hero_${heroType}`);
    this.add(this.sprite);

    // Tier badge background
    this.tierBadge = scene.add.graphics();
    this.add(this.tierBadge);

    // Tier stars
    this.tierStars = scene.add.graphics();
    this.add(this.tierStars);
    this.drawTierIndicators();

    this.setSize(40, 40);
    this.setInteractive();

    // Spawn animation
    this.setScale(0);
    this.setAlpha(0);
    scene.tweens.add({
      targets: this, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 300, ease: 'Back.easeOut',
    });

    scene.add.existing(this);
  }

  private drawTierIndicators(): void {
    this.tierStars.clear();
    this.tierBadge.clear();
    const tierColor = TIER_COLORS[this.tier - 1];

    // Badge bg behind stars
    const badgeW = this.tier * 7 + 6;
    this.tierBadge.fillStyle(0x000000, 0.5);
    this.tierBadge.fillRoundedRect(-badgeW / 2, 18, badgeW, 10, 3);
    this.tierBadge.fillStyle(tierColor, 0.3);
    this.tierBadge.fillRoundedRect(-badgeW / 2, 18, badgeW, 10, 3);

    // Stars
    const startX = -((this.tier - 1) * 7) / 2;
    for (let i = 0; i < this.tier; i++) {
      this.tierStars.fillStyle(tierColor, 1);
      this.drawStar(this.tierStars, startX + i * 7, 23, 3);
    }
  }

  private drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    const points: number[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    g.fillStyle(g.defaultFillColor, g.defaultFillAlpha);
    g.beginPath();
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      g.lineTo(points[i], points[i + 1]);
    }
    g.closePath();
    g.fillPath();
  }

  getKey(): string {
    return `${this.heroType}_${this.tier}`;
  }

  getCurrentDamage(): number {
    return getHeroDamage(this.heroType, this.tier);
  }

  getCurrentRange(): number {
    return getHeroRange(this.heroType, this.tier);
  }

  getCurrentFireRate(): number {
    return getHeroFireRate(this.heroType, this.tier);
  }

  getSellValue(): number {
    return getHeroSellValue(this.tier);
  }

  canMerge(): boolean {
    return this.tier < MAX_TIER;
  }

  upgradeTier(): void {
    if (this.tier >= MAX_TIER) return;
    this.tier++;
    this.drawTierIndicators();

    // Upgrade flash
    if (this.scene) {
      this.scene.tweens.add({
        targets: this.sprite, alpha: 0.3, yoyo: true,
        duration: 80, repeat: 3,
      });

      // Tier-up particles
      const tierColor = TIER_COLORS[this.tier - 1];
      const particles = this.scene.add.particles(this.x, this.y, 'particle_spark', {
        speed: { min: 30, max: 80 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [tierColor, 0xffffff],
        lifespan: 600,
        quantity: 12,
        emitting: false,
      });
      particles.explode(12);
      this.scene.time.delayedCall(700, () => particles.destroy());
    }
  }

  showRange(): void {
    this.hideRange();
    if (!this.scene) return;
    const range = this.getCurrentRange();
    this.rangeCircle = this.scene.add.graphics();
    this.rangeCircle.fillStyle(this.config.color, 0.08);
    this.rangeCircle.fillCircle(this.x, this.y, range);
    this.rangeCircle.lineStyle(1.5, this.config.color, 0.3);
    this.rangeCircle.strokeCircle(this.x, this.y, range);
    this.rangeCircle.setDepth(1);
  }

  hideRange(): void {
    if (this.rangeCircle) {
      this.rangeCircle.destroy();
      this.rangeCircle = null;
    }
  }

  update(delta: number, enemies: Enemy[], projectiles: Projectile[]): void {
    this.fireTimer += delta;

    // Glow aura animation
    this.glowPhase += delta * 0.003;
    const tierColor = TIER_COLORS[this.tier - 1];
    const glowAlpha = 0.06 + Math.sin(this.glowPhase) * 0.04 + this.tier * 0.015;
    this.glowGraphics.clear();
    this.glowGraphics.fillStyle(tierColor, glowAlpha);
    this.glowGraphics.fillCircle(0, -3, 18 + this.tier * 2 + Math.sin(this.glowPhase * 0.7) * 3);

    const interval = 1000 / this.getCurrentFireRate();
    if (this.fireTimer < interval) return;

    const target = this.findTarget(enemies);
    if (!target) return;

    this.fireTimer = 0;
    this.fire(target, projectiles);
  }

  private findTarget(enemies: Enemy[]): Enemy | null {
    const range = this.getCurrentRange();
    let best: Enemy | null = null;
    let maxProgress = -1;

    for (const enemy of enemies) {
      if (!enemy.active || enemy.hp <= 0) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist <= range && enemy.distanceTraveled > maxProgress) {
        maxProgress = enemy.distanceTraveled;
        best = enemy;
      }
    }
    return best;
  }

  private fire(target: Enemy, projectiles: Projectile[]): void {
    const proj = new Projectile(
      this.scene, this.x, this.y - 5, target,
      this.heroType, this.getCurrentDamage(), this.config,
    );
    projectiles.push(proj);

    playShoot(this.heroType === 'warrior' ? 'archer' : this.heroType === 'mage' ? 'cannon' : this.heroType);

    // Recoil
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.scene.tweens.add({
      targets: this.sprite,
      x: -Math.cos(angle) * 3, y: -Math.sin(angle) * 3 - 3,
      duration: 50, yoyo: true,
    });

    // Muzzle flash
    const flashX = this.x + Math.cos(angle) * 14;
    const flashY = this.y + Math.sin(angle) * 14 - 5;
    const flash = this.scene.add.graphics();
    flash.setDepth(10);
    const flashColor = this.config.color;
    flash.fillStyle(flashColor, 0.9);
    flash.fillCircle(flashX, flashY, 5);
    flash.fillStyle(0xffffff, 0.6);
    flash.fillCircle(flashX, flashY, 2.5);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  destroy(fromScene?: boolean): void {
    this.hideRange();
    super.destroy(fromScene);
  }
}
