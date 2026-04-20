import * as Phaser from 'phaser';
import { TOTAL_WAVES } from '../data/WaveData';
import { playVictory, playDefeat, playClick } from '../utils/SoundManager';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: { victory: boolean; wave: number; gold: number }): void {
    const { width, height } = this.scale;

    // Gradient background
    const bgG = this.add.graphics();
    for (let i = 0; i < height; i++) {
      const t = i / height;
      const r = Math.floor(data.victory ? 8 + t * 12 : 18 + t * 10);
      const g = Math.floor(data.victory ? 18 + t * 16 : 5 + t * 8);
      const b = Math.floor(data.victory ? 40 + t * 30 : 20 + t * 15);
      bgG.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      bgG.fillRect(0, i, width, 1);
    }

    if (data.victory) {
      // Snow confetti
      this.add.particles(width / 2, -20, 'particle_snow', {
        speed: { min: 20, max: 60 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 4000,
        frequency: 30,
        angle: { min: 80, max: 100 },
        gravityY: 20,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(-width / 2, 0, width, 10),
          quantity: 1,
        },
      });
      this.add.particles(width / 2, height / 4, 'particle_spark', {
        speed: { min: 10, max: 40 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: [0xffd700, 0x81d4fa, 0xffffff],
        lifespan: 1500,
        frequency: 100,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(-100, -30, 200, 60),
          quantity: 1,
        },
      });
    } else {
      this.add.particles(width / 2, height, 'particle', {
        speed: { min: 10, max: 30 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.15, end: 0 },
        tint: [0xf44336, 0xff5722],
        lifespan: 3000,
        frequency: 200,
        angle: { min: 260, max: 280 },
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(-width / 2, 0, width, 10),
          quantity: 1,
        },
      });
    }

    // Play sound
    if (data.victory) {
      playVictory();
    } else {
      playDefeat();
    }

    // Result text
    const resultY = height * 0.22;
    const resultText = data.victory ? '\u{1F451} \uC2B9\uB9AC! \u{1F451}' : '\u2620 \uD328\uBC30...';
    const resultColor = data.victory ? '#81d4fa' : '#ff5252';

    this.add.text(width / 2, resultY, resultText, {
      fontSize: '42px', fontFamily: 'Arial, sans-serif',
      color: resultColor, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.2).setScale(1.1);

    const mainResult = this.add.text(width / 2, resultY, resultText, {
      fontSize: '42px', fontFamily: 'Arial, sans-serif',
      color: resultColor, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: mainResult, scaleX: 1.05, scaleY: 1.05,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Stats panel
    const panelY = height * 0.45;
    const panelW = 280;
    const panelH = 130;
    const statsG = this.add.graphics();
    statsG.fillStyle(0x0a1628, 0.85);
    statsG.fillRoundedRect(width / 2 - panelW / 2, panelY - panelH / 2, panelW, panelH, 12);
    statsG.lineStyle(1, 0x29b6f6, 0.3);
    statsG.strokeRoundedRect(width / 2 - panelW / 2, panelY - panelH / 2, panelW, panelH, 12);
    statsG.fillStyle(0xffffff, 0.03);
    statsG.fillRoundedRect(width / 2 - panelW / 2 + 1, panelY - panelH / 2 + 1, panelW - 2, 25, { tl: 12, tr: 12, bl: 0, br: 0 });

    const sLeft = width / 2 - panelW / 2 + 25;
    const sRight = width / 2 + panelW / 2 - 25;

    this.add.text(sLeft, panelY - 45, '\uB3C4\uB2EC \uC6E8\uC774\uBE0C', {
      fontSize: '12px', fontFamily: 'Arial', color: '#78909c',
    });
    this.add.text(sRight, panelY - 45, `${data.wave} / ${TOTAL_WAVES}`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#e0e0e0', fontStyle: 'bold',
    }).setOrigin(1, 0);

    statsG.fillStyle(0x29b6f6, 0.15);
    statsG.fillRect(width / 2 - panelW / 2 + 20, panelY - 18, panelW - 40, 1);

    this.add.text(sLeft, panelY - 10, '\uB0A8\uC740 \uACE8\uB4DC', {
      fontSize: '12px', fontFamily: 'Arial', color: '#78909c',
    });
    this.add.text(sRight, panelY - 10, `${data.gold}G`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(1, 0);

    statsG.fillStyle(0x29b6f6, 0.15);
    statsG.fillRect(width / 2 - panelW / 2 + 20, panelY + 18, panelW - 40, 1);

    const stars = data.victory ? 3 : data.wave >= 15 ? 2 : data.wave >= 10 ? 1 : 0;
    this.add.text(sLeft, panelY + 28, '\uD3C9\uAC00', {
      fontSize: '12px', fontFamily: 'Arial', color: '#78909c',
    });
    let starStr = '';
    for (let i = 0; i < 3; i++) starStr += i < stars ? '\u2605 ' : '\u2606 ';
    this.add.text(sRight, panelY + 26, starStr.trim(), {
      fontSize: '18px', fontFamily: 'Arial', color: stars > 0 ? '#ffd700' : '#455a64',
    }).setOrigin(1, 0);

    // Buttons
    const createBtn = (x: number, y: number, label: string, color: number, action: () => void) => {
      const btn = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(color, 0.12);
      bg.fillRoundedRect(-85, -22, 170, 44, 22);
      bg.fillStyle(color, 0.9);
      bg.fillRoundedRect(-80, -18, 160, 36, 18);
      bg.fillStyle(0xffffff, 0.1);
      bg.fillRoundedRect(-79, -17, 158, 16, { tl: 18, tr: 18, bl: 0, br: 0 });
      bg.lineStyle(1, Phaser.Display.Color.GetColor(
        Math.min(255, ((color >> 16) & 0xff) + 40),
        Math.min(255, ((color >> 8) & 0xff) + 40),
        Math.min(255, (color & 0xff) + 40),
      ), 0.4);
      bg.strokeRoundedRect(-80, -18, 160, 36, 18);
      const text = this.add.text(0, 0, label, {
        fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      btn.add([bg, text]);
      btn.setSize(160, 36).setInteractive();
      btn.on('pointerdown', () => {
        this.tweens.add({
          targets: btn, scaleX: 0.95, scaleY: 0.95,
          duration: 60, yoyo: true,
          onComplete: () => {
            this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, p: number) => {
              if (p >= 1) action();
            });
          },
        });
      });
      btn.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 80 }));
      btn.on('pointerout', () => this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }));
      return btn;
    };

    createBtn(width / 2, height - 100, '\u{1F504}  \uB2E4\uC2DC \uB3C4\uC804', 0x0277bd, () => { playClick(); this.scene.start('MenuScene'); });
    createBtn(width / 2, height - 50, '\u{1F3E0}  \uBA54\uC778 \uBA54\uB274', 0x455a64, () => { playClick(); this.scene.start('MenuScene'); });

    this.cameras.main.fadeIn(400);
  }
}
