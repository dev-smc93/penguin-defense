import * as Phaser from 'phaser';
import { HeroTypeConfig } from '../data/HeroData';
import { Enemy } from './Enemy';
import { playEnemyHit, playExplosion } from '../utils/SoundManager';

export class Projectile extends Phaser.GameObjects.Image {
  public target: Enemy;
  public damage: number;
  public heroType: string;
  public heroConfig: HeroTypeConfig;
  public alive: boolean = true;

  private speed: number;
  private trailTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    heroType: string,
    damage: number,
    heroConfig: HeroTypeConfig,
  ) {
    super(scene, x, y, `proj_${heroType}`);
    this.target = target;
    this.damage = damage;
    this.heroType = heroType;
    this.heroConfig = heroConfig;
    this.speed = heroConfig.projectileSpeed;

    this.setDepth(8);
    scene.add.existing(this);
  }

  update(delta: number, enemies: Enemy[]): boolean {
    if (!this.alive) return false;

    if (!this.target || !this.target.alive || !this.target.active) {
      this.alive = false;
      this.destroy();
      return false;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      this.hit(enemies);
      return true;
    }

    const moveSpeed = this.speed * (delta / 1000);
    this.x += (dx / dist) * moveSpeed;
    this.y += (dy / dist) * moveSpeed;
    this.rotation = Math.atan2(dy, dx);

    // Trail particles
    this.trailTimer += delta;
    if (this.trailTimer > 30 && this.scene) {
      this.trailTimer = 0;
      const trail = this.scene.add.graphics();
      trail.setDepth(7);
      const trailColor = this.heroConfig.projectileColor;
      trail.fillStyle(trailColor, 0.5);
      trail.fillCircle(this.x, this.y, this.heroType === 'mage' ? 3 : 2);
      this.scene.tweens.add({
        targets: trail, alpha: 0, duration: 150,
        onComplete: () => trail.destroy(),
      });
    }

    return false;
  }

  private hit(enemies: Enemy[]): void {
    this.alive = false;
    playEnemyHit();

    const killed = this.target.takeDamage(this.damage);

    if (this.heroConfig.slow > 0) {
      this.target.applySlow(this.heroConfig.slow, this.heroConfig.slowDuration);
    }

    // Hit flash
    if (this.scene) {
      const hitFlash = this.scene.add.graphics();
      hitFlash.setDepth(9);
      hitFlash.fillStyle(0xffffff, 0.7);
      hitFlash.fillCircle(this.x, this.y, 5);
      this.scene.tweens.add({
        targets: hitFlash, alpha: 0, duration: 100,
        onComplete: () => hitFlash.destroy(),
      });
    }

    if (this.heroConfig.splash) {
      this.applySplash(enemies);
    }

    if (this.heroConfig.chain > 0) {
      this.applyChain(enemies);
    }

    this.destroy();
  }

  private applySplash(enemies: Enemy[]): void {
    const radius = this.heroConfig.splashRadius;
    playExplosion();

    if (this.scene) {
      const particles = this.scene.add.particles(this.x, this.y, 'particle_explosion', {
        speed: { min: 30, max: 80 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: 400,
        quantity: 10,
        emitting: false,
      });
      particles.explode(10);
      this.scene.time.delayedCall(500, () => particles.destroy());

      // Shockwave ring
      const ring = this.scene.add.graphics();
      ring.setDepth(9);
      ring.lineStyle(3, this.heroConfig.color, 0.8);
      ring.strokeCircle(this.x, this.y, 5);
      this.scene.tweens.add({
        targets: ring, alpha: 0, duration: 300,
        onUpdate: (_tween: Phaser.Tweens.Tween, target: Phaser.GameObjects.Graphics) => {
          target.clear();
          const progress = 1 - target.alpha;
          const r = 5 + progress * radius;
          target.lineStyle(3 - progress * 2, this.heroConfig.color, target.alpha);
          target.strokeCircle(this.x, this.y, r);
        },
        onComplete: () => ring.destroy(),
      });
    }

    for (const enemy of enemies) {
      if (!enemy.alive || !enemy.active || enemy === this.target) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        enemy.takeDamage(Math.floor(this.damage * falloff * 0.6));
      }
    }
  }

  private applyChain(enemies: Enemy[]): void {
    let lastX = this.target.x;
    let lastY = this.target.y;
    const chainRange = 80;
    const chainDamage = Math.floor(this.damage * 0.5);
    const used = new Set<Enemy>([this.target]);

    for (let i = 0; i < this.heroConfig.chain; i++) {
      let closest: Enemy | null = null;
      let closestDist = chainRange;

      for (const enemy of enemies) {
        if (!enemy.alive || !enemy.active || used.has(enemy)) continue;
        const dist = Phaser.Math.Distance.Between(lastX, lastY, enemy.x, enemy.y);
        if (dist < closestDist) {
          closestDist = dist;
          closest = enemy;
        }
      }

      if (closest) {
        used.add(closest);

        if (this.scene) {
          const line = this.scene.add.graphics();
          line.lineStyle(2, 0xffeb3b, 0.8);
          line.beginPath();
          line.moveTo(lastX, lastY);
          const dx = closest.x - lastX;
          const dy = closest.y - lastY;
          const midX = lastX + dx * 0.5 + Phaser.Math.Between(-15, 15);
          const midY = lastY + dy * 0.5 + Phaser.Math.Between(-15, 15);
          line.lineTo(midX, midY);
          line.lineTo(closest.x, closest.y);
          line.strokePath();
          line.setDepth(9);

          this.scene.tweens.add({
            targets: line, alpha: 0, duration: 200,
            onComplete: () => line.destroy(),
          });
        }

        closest.takeDamage(chainDamage);
        lastX = closest.x;
        lastY = closest.y;
      }
    }
  }
}
