import * as Phaser from 'phaser';
import { MAPS } from '../data/MapData';
import { playClick } from '../utils/SoundManager';

export class MenuScene extends Phaser.Scene {
  private selectedMap: number = 0;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Ice gradient background
    const bgG = this.add.graphics();
    for (let i = 0; i < height; i++) {
      const t = i / height;
      const r = Math.floor(8 + t * 12);
      const g = Math.floor(18 + t * 16);
      const b = Math.floor(40 + t * 30);
      bgG.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      bgG.fillRect(0, i, width, 1);
    }

    // Snow particles
    this.add.particles(width / 2, -10, 'particle_snow', {
      speed: { min: 10, max: 25 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 0.3, end: 0 },
      angle: { min: 85, max: 95 },
      lifespan: 5000,
      frequency: 100,
      gravityY: 10,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-width / 2, 0, width, 10),
        quantity: 1,
      },
    });

    // Floating sparkles
    this.add.particles(width / 2, height / 2, 'particle', {
      speed: { min: 3, max: 12 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.12, end: 0 },
      tint: [0x29b6f6, 0x4fc3f7, 0x81d4fa, 0xffd700],
      lifespan: 4000,
      frequency: 150,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
        quantity: 1,
      },
    });

    // Title glow
    this.add.text(width / 2, 55, '\u{1F427} \uD3AD\uADC4 \uB300\uBAA8\uD5D8 \u{1F427}', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif',
      color: '#81d4fa', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.15).setScale(1.05);

    // Title shadow
    this.add.text(width / 2 + 2, 57, '\u{1F427} \uD3AD\uADC4 \uB300\uBAA8\uD5D8 \u{1F427}', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif',
      color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.4);

    // Title main
    const title = this.add.text(width / 2, 55, '\u{1F427} \uD3AD\uADC4 \uB300\uBAA8\uD5D8 \u{1F427}', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif',
      color: '#e1f5fe', fontStyle: 'bold',
      stroke: '#0277bd', strokeThickness: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: title, y: '+=4', duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Subtitle
    const subY = 95;
    const lineG = this.add.graphics();
    lineG.lineStyle(1, 0x29b6f6, 0.3);
    lineG.beginPath(); lineG.moveTo(width / 2 - 130, subY); lineG.lineTo(width / 2 - 55, subY); lineG.strokePath();
    lineG.beginPath(); lineG.moveTo(width / 2 + 55, subY); lineG.lineTo(width / 2 + 130, subY); lineG.strokePath();

    this.add.text(width / 2, subY, '\u2744  \uAF41\uAF41 \uBC29\uC5B4\uC804  \u2744', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#4fc3f7',
    }).setOrigin(0.5);

    // Map selection
    this.add.text(width / 2, 132, '\u25C6  \uB9F5 \uC120\uD0DD  \u25C6', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#b0bec5', fontStyle: 'bold',
    }).setOrigin(0.5);

    const mapButtons: Phaser.GameObjects.Container[] = [];
    const mapStartY = 165;
    const mapSpacing = 60;
    const mapColors = [0x29b6f6, 0x4fc3f7, 0x0277bd];
    const mapIcons = ['\u2744', '\u{1F3F0}', '\u{1F9CA}'];

    MAPS.forEach((map, index) => {
      const container = this.add.container(width / 2, mapStartY + index * mapSpacing);
      const isSelected = index === this.selectedMap;
      const themeColor = mapColors[index];

      const bg = this.add.graphics();
      this.drawMapButton(bg, isSelected, themeColor);

      const iconText = this.add.text(-105, -1, mapIcons[index], { fontSize: '20px', fontFamily: 'Arial' }).setOrigin(0.5);
      const text = this.add.text(-10, -4, map.nameKo, {
        fontSize: '16px', fontFamily: 'Arial, sans-serif',
        color: isSelected ? '#ffffff' : '#90a4ae', fontStyle: 'bold',
      }).setOrigin(0.5);
      const desc = this.add.text(-10, 14, `${map.cols}\u00d7${map.rows}  \u2022  ${map.path.length} waypoints`, {
        fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#607d8b',
      }).setOrigin(0.5);

      const diffG = this.add.graphics();
      for (let d = 0; d < 3; d++) {
        const filled = d <= index;
        diffG.fillStyle(filled ? themeColor : 0x37474f, filled ? 0.8 : 0.4);
        diffG.fillCircle(80 + d * 10, 0, 3);
      }

      container.add([bg, iconText, text, desc, diffG]);
      container.setSize(260, 48).setInteractive();

      container.on('pointerdown', () => {
        playClick();
        this.selectedMap = index;
        this.refreshMapSelection(mapButtons, mapColors);
      });
      container.on('pointerover', () => {
        if (index !== this.selectedMap) {
          this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 100 });
        }
      });
      container.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
      });

      mapButtons.push(container);
    });

    // Start button
    const startBtn = this.add.container(width / 2, height - 70);
    const startBg = this.add.graphics();
    startBg.fillStyle(0x0277bd, 0.12);
    startBg.fillRoundedRect(-110, -28, 220, 56, 28);
    startBg.fillStyle(0x0277bd, 1);
    startBg.fillRoundedRect(-100, -24, 200, 48, 24);
    startBg.fillStyle(0xffffff, 0.12);
    startBg.fillRoundedRect(-98, -22, 196, 20, { tl: 24, tr: 24, bl: 0, br: 0 });
    startBg.lineStyle(1.5, 0x29b6f6, 0.5);
    startBg.strokeRoundedRect(-100, -24, 200, 48, 24);

    const startText = this.add.text(0, 0, '\u25B6  \uAC8C\uC784 \uC2DC\uC791', {
      fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    startBtn.add([startBg, startText]);
    startBtn.setSize(200, 48).setInteractive();

    startBtn.on('pointerdown', () => {
      playClick();
      this.tweens.add({
        targets: startBtn, scaleX: 0.94, scaleY: 0.94,
        duration: 80, yoyo: true,
        onComplete: () => {
          this.cameras.main.fade(300, 0, 0, 0, false, (_cam: unknown, progress: number) => {
            if (progress >= 1) this.scene.start('GameScene', { mapIndex: this.selectedMap });
          });
        },
      });
    });

    this.tweens.add({
      targets: startBtn, scaleX: 1.02, scaleY: 1.02,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.add.text(width - 10, height - 10, 'v2.0', {
      fontSize: '9px', fontFamily: 'Arial', color: '#37474f',
    }).setOrigin(1, 1);

    this.cameras.main.fadeIn(300);
  }

  private drawMapButton(g: Phaser.GameObjects.Graphics, selected: boolean, color: number): void {
    g.clear();
    if (selected) {
      g.fillStyle(color, 0.08);
      g.fillRoundedRect(-132, -26, 264, 52, 10);
      g.fillStyle(0x0a1628, 0.95);
      g.fillRoundedRect(-130, -24, 260, 48, 8);
      g.lineStyle(1.5, color, 0.7);
      g.strokeRoundedRect(-130, -24, 260, 48, 8);
      g.fillStyle(color, 0.8);
      g.fillRoundedRect(-128, -14, 3, 28, 1);
    } else {
      g.fillStyle(0x0d1b30, 0.8);
      g.fillRoundedRect(-130, -24, 260, 48, 8);
      g.lineStyle(1, 0x37474f, 0.4);
      g.strokeRoundedRect(-130, -24, 260, 48, 8);
    }
    g.fillStyle(0xffffff, selected ? 0.04 : 0.02);
    g.fillRoundedRect(-129, -23, 258, 20, { tl: 8, tr: 8, bl: 0, br: 0 });
  }

  private refreshMapSelection(buttons: Phaser.GameObjects.Container[], colors: number[]): void {
    buttons.forEach((container, index) => {
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const text = container.getAt(2) as Phaser.GameObjects.Text;
      const isSelected = index === this.selectedMap;
      this.drawMapButton(bg, isSelected, colors[index]);
      text.setColor(isSelected ? '#ffffff' : '#90a4ae');
    });
  }
}
