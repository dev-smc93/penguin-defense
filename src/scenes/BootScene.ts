import * as Phaser from 'phaser';
import { generateAssets } from '../utils/AssetGenerator';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a1628');

    const bgG = this.add.graphics();
    for (let i = 0; i < height; i++) {
      const t = i / height;
      bgG.fillStyle(Phaser.Display.Color.GetColor(
        Math.floor(8 + t * 10),
        Math.floor(18 + t * 12),
        Math.floor(40 + t * 20),
      ), 1);
      bgG.fillRect(0, i, width, 1);
    }

    // Penguin emoji
    this.add.text(width / 2, height / 2 - 80, '\u{1F427}', {
      fontSize: '48px', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 30, '\uD3AD\uADC4 \uB300\uBAA8\uD5D8', {
      fontSize: '28px', fontFamily: 'Arial, sans-serif',
      color: '#e1f5fe', fontStyle: 'bold',
      stroke: '#0277bd', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, '\uAF41\uAF41 \uBC29\uC5B4\uC804', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif',
      color: '#4fc3f7',
    }).setOrigin(0.5);

    const barW = 200;
    const barH = 6;
    const barX = width / 2 - barW / 2;
    const barY = height / 2 + 30;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x0d1b30, 1);
    barBg.fillRoundedRect(barX, barY, barW, barH, 3);

    const barFill = this.add.graphics();

    const loadingText = this.add.text(width / 2, height / 2 + 50, '\uB85C\uB529 \uC911...', {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#4fc3f7',
    }).setOrigin(0.5);

    this.tweens.addCounter({
      from: 0, to: 100, duration: 500, ease: 'Linear',
      onUpdate: (tween) => {
        const val = tween.getValue() ?? 0;
        barFill.clear();
        barFill.fillStyle(0x0277bd, 1);
        barFill.fillRoundedRect(barX, barY, barW * (val / 100), barH, 3);
        barFill.fillStyle(0xffffff, 0.2);
        barFill.fillRoundedRect(barX, barY, barW * (val / 100), barH / 2, { tl: 3, tr: 3, bl: 0, br: 0 });
      },
      onComplete: () => {
        generateAssets(this);
        loadingText.setText('\uC644\uB8CC!');
        loadingText.setColor('#69f0ae');

        this.time.delayedCall(250, () => {
          this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
            if (progress >= 1) this.scene.start('MenuScene');
          });
        });
      },
    });
  }
}
