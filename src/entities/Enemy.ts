import * as Phaser from 'phaser';
import { ENEMY_DATA, EnemyStats } from '../data/EnemyData';
import { PathPoint, getPositionOnPath } from '../utils/PathFollower';
import { playEnemyDeath, playBossDeath } from '../utils/SoundManager';

export class Enemy extends Phaser.GameObjects.Container {
  public enemyType: string;
  public stats: EnemyStats;
  public hp: number;
  public maxHp: number;
  public distanceTraveled: number = 0;
  public alive: boolean = true;
  public slowAmount: number = 0;
  public slowTimer: number = 0;

  private path: PathPoint[];
  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private hpBarBorder: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    path: PathPoint[],
    enemyType: string,
    waveMultiplier: number = 1,
  ) {
    super(scene, path[0].x, path[0].y);
    this.path = path;
    this.enemyType = enemyType;
    this.stats = { ...ENEMY_DATA[enemyType] };

    this.maxHp = Math.floor(this.stats.hp * waveMultiplier);
    this.hp = this.maxHp;

    // Shadow
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.22);
    this.shadow.fillEllipse(0, this.stats.size * 0.6, this.stats.size * 1.2, this.stats.size * 0.4);
    this.add(this.shadow);

    // Sprite (slightly raised for pseudo-3D)
    this.sprite = scene.add.image(0, -3, `enemy_${enemyType}`);
    this.add(this.sprite);

    const barW = 26;
    const barH = 4;
    const barY = -this.stats.size - 10;

    // HP bar background (dark)
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.fillStyle(0x000000, 0.7);
    this.hpBarBg.fillRoundedRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2, 2);
    this.add(this.hpBarBg);

    // HP bar fill
    this.hpBarFill = scene.add.graphics();
    this.add(this.hpBarFill);

    // HP bar border
    this.hpBarBorder = scene.add.graphics();
    this.hpBarBorder.lineStyle(0.5, 0xffffff, 0.15);
    this.hpBarBorder.strokeRoundedRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2, 2);
    this.add(this.hpBarBorder);

    this.updateHpBar();
    this.setDepth(5);

    // Spawn animation
    this.setScale(0);
    this.setAlpha(0);
    scene.tweens.add({
      targets: this, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200, ease: 'Back.easeOut',
    });

    scene.add.existing(this);
  }

  private updateHpBar(): void {
    this.hpBarFill.clear();
    const ratio = Math.max(0, this.hp / this.maxHp);
    const barW = 26;
    const barH = 4;
    const barY = -this.stats.size - 10;

    // Color gradient based on HP
    let color: number;
    if (ratio > 0.6) {
      color = 0x4caf50;
    } else if (ratio > 0.3) {
      color = 0xff9800;
    } else {
      color = 0xf44336;
    }

    // Fill
    this.hpBarFill.fillStyle(color, 1);
    this.hpBarFill.fillRoundedRect(-barW / 2, barY, barW * ratio, barH, 1);
    // Shine on top
    this.hpBarFill.fillStyle(0xffffff, 0.2);
    this.hpBarFill.fillRect(-barW / 2, barY, barW * ratio, 1);
  }

  takeDamage(amount: number): boolean {
    const effectiveDamage = Math.max(1, amount - this.stats.armor);
    this.hp -= effectiveDamage;
    this.updateHpBar();

    // Hit flash
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
    });

    // Damage number popup
    if (this.scene && effectiveDamage > 10) {
      const dmgText = this.scene.add.text(this.x + Phaser.Math.Between(-8, 8), this.y - this.stats.size - 16, `-${effectiveDamage}`, {
        fontSize: '9px', fontFamily: 'Arial', color: '#ff8a80', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12);
      this.scene.tweens.add({
        targets: dmgText, y: dmgText.y - 15, alpha: 0,
        duration: 500, onComplete: () => dmgText.destroy(),
      });
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.die();
      return true;
    }
    return false;
  }

  applySlow(amount: number, duration: number): void {
    if (amount > this.slowAmount) {
      this.slowAmount = amount;
    }
    this.slowTimer = duration;
    this.sprite.setTint(0x81d4fa);
  }

  private die(): void {
    // Death sound
    if (this.enemyType === 'boss') {
      playBossDeath();
    } else {
      playEnemyDeath();
    }

    if (this.scene) {
      // Death burst particles
      const particles = this.scene.add.particles(this.x, this.y, 'particle', {
        speed: { min: 40, max: 100 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [this.stats.color, 0xffffff],
        lifespan: 500,
        quantity: 10,
        emitting: false,
      });
      particles.explode(10);
      this.scene.time.delayedCall(600, () => particles.destroy());

      // Boss: extra explosion
      if (this.enemyType === 'boss') {
        const bigParticles = this.scene.add.particles(this.x, this.y, 'particle_explosion', {
          speed: { min: 50, max: 120 },
          scale: { start: 0.8, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffd700, 0xff6600],
          lifespan: 700,
          quantity: 15,
          emitting: false,
        });
        bigParticles.explode(15);
        this.scene.time.delayedCall(800, () => bigParticles.destroy());
      }
    }

    this.scene.tweens.add({
      targets: this, alpha: 0, scaleX: 0.3, scaleY: 0.3,
      duration: 180, onComplete: () => this.destroy(),
    });
  }

  update(delta: number): boolean {
    if (!this.alive) return false;

    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      if (this.slowTimer <= 0) {
        this.slowAmount = 0;
        this.sprite.clearTint();
      }
    }

    const speed = this.stats.speed * (1 - this.slowAmount);
    this.distanceTraveled += speed * (delta / 1000);

    const pos = getPositionOnPath(this.path, this.distanceTraveled);
    this.setPosition(pos.x, pos.y);
    this.sprite.setRotation(pos.angle);

    // Flying bob
    if (this.stats.flying) {
      this.sprite.y = Math.sin(this.scene.time.now / 180) * 4 - 6;
    }

    return pos.finished;
  }
}
