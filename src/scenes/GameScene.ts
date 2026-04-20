import * as Phaser from 'phaser';
import { MAPS, MapConfig } from '../data/MapData';
import {
  HERO_DATA, TIER_NAMES, TIER_COLORS, MAX_TIER,
  getHeroDamage, getHeroRange, getHeroFireRate, getHeroSellValue,
  BASE_SUMMON_COST, SUMMON_COST_INCREMENT, MAX_SUMMON_LEVEL, SUMMON_UPGRADE_COSTS,
  rollSummonTier, rollSummonType,
} from '../data/HeroData';
import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { WaveManager } from '../entities/WaveManager';
import { buildPixelPath, PathPoint } from '../utils/PathFollower';
import {
  playClick, playPlaceTower, playSell, playMerge, playSummon,
  playLifeLost, playWaveStart, playWaveClear, playGoldPickup,
  startBGM, stopBGM,
} from '../utils/SoundManager';

const INITIAL_GOLD = 200;
const INITIAL_LIVES = 20;
const HUD_HEIGHT = 44;
const BOTTOM_PANEL_HEIGHT = 80;

export class GameScene extends Phaser.Scene {
  private gold: number = INITIAL_GOLD;
  private lives: number = INITIAL_LIVES;
  private gameSpeed: number = 1;
  private gameOver: boolean = false;

  private mapConfig!: MapConfig;
  private mapOffsetX: number = 0;
  private mapOffsetY: number = 0;
  private path: PathPoint[] = [];
  private gridOccupied: boolean[][] = [];

  private heroes: Hero[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private waveManager!: WaveManager;

  // Summon system
  private summonLevel: number = 1;
  private summonCount: number = 0;

  // UI
  private selectedHero: Hero | null = null;
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private speedBtn!: Phaser.GameObjects.Container;
  private speedBtnText!: Phaser.GameObjects.Text;
  private summonBtn!: Phaser.GameObjects.Container;
  private summonCostText!: Phaser.GameObjects.Text;
  private summonLvBtn!: Phaser.GameObjects.Container;
  private summonLvText!: Phaser.GameObjects.Text;
  private mergeBtn!: Phaser.GameObjects.Container;
  private mergeBadge!: Phaser.GameObjects.Text;
  private infoPanel!: Phaser.GameObjects.Container;
  private nextWaveBtn!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { mapIndex: number }): void {
    this.gold = INITIAL_GOLD;
    this.lives = INITIAL_LIVES;
    this.gameSpeed = 1;
    this.gameOver = false;
    this.heroes = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedHero = null;
    this.summonLevel = 1;
    this.summonCount = 0;
    this.mapConfig = MAPS[data.mapIndex || 0];
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a1628');

    const mapWidth = this.mapConfig.cols * this.mapConfig.tileSize;
    const mapHeight = this.mapConfig.rows * this.mapConfig.tileSize;
    const availableHeight = height - HUD_HEIGHT - BOTTOM_PANEL_HEIGHT;
    this.mapOffsetX = Math.floor((width - mapWidth) / 2);
    this.mapOffsetY = Math.floor(HUD_HEIGHT + (availableHeight - mapHeight) / 2);

    this.path = buildPixelPath(this.mapConfig, this.mapOffsetX, this.mapOffsetY);

    this.gridOccupied = Array.from({ length: this.mapConfig.rows }, () =>
      Array(this.mapConfig.cols).fill(false),
    );

    this.drawBackground(width, height);
    this.drawMap();

    this.waveManager = new WaveManager(
      this, this.path, this.enemies,
      (enemy) => this.onEnemyReachEnd(enemy),
      (enemy) => this.onEnemyKilled(enemy),
    );

    this.createHUD();
    this.createBottomPanel();
    this.createInfoPanel();
    this.createNextWaveButton();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    // Snow particles
    this.add.particles(width / 2, -10, 'particle_snow', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 0.3, end: 0 },
      angle: { min: 85, max: 95 },
      lifespan: 6000,
      frequency: 200,
      gravityY: 8,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-width / 2, 0, width, 10),
        quantity: 1,
      },
    }).setDepth(-1);

    startBGM();
  }

  private drawBackground(width: number, height: number): void {
    const bg = this.add.graphics();
    for (let i = 0; i < height; i++) {
      const t = i / height;
      const r = Math.floor(10 + t * 8);
      const g = Math.floor(18 + t * 10);
      const b = Math.floor(40 + t * 20);
      bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      bg.fillRect(0, i, width, 1);
    }
    bg.setDepth(-2);

    this.add.particles(width / 2, height / 2, 'particle', {
      speed: { min: 2, max: 8 },
      scale: { start: 0.15, end: 0 },
      alpha: { start: 0.06, end: 0 },
      tint: [0x29b6f6, 0x4fc3f7, 0x81d4fa],
      lifespan: 5000,
      frequency: 800,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
        quantity: 1,
      },
    }).setDepth(-1);
  }

  private drawMap(): void {
    const { cols, rows, tileSize, grid } = this.mapConfig;

    const borderG = this.add.graphics();
    borderG.lineStyle(2, 0x29b6f6, 0.3);
    borderG.strokeRect(this.mapOffsetX - 2, this.mapOffsetY - 2, cols * tileSize + 4, rows * tileSize + 4);
    borderG.lineStyle(1, 0x4fc3f7, 0.15);
    borderG.strokeRect(this.mapOffsetX - 4, this.mapOffsetY - 4, cols * tileSize + 8, rows * tileSize + 8);
    borderG.setDepth(-1);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = this.mapOffsetX + col * tileSize + tileSize / 2;
        const y = this.mapOffsetY + row * tileSize + tileSize / 2;
        const isPath = grid[row][col] === 1;
        this.add.image(x, y, isPath ? 'tile_path' : 'tile_grass').setDepth(0);
      }
    }

    // Path arrows
    for (let i = 0; i < this.path.length - 1; i++) {
      const from = this.path[i];
      const to = this.path[i + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const count = Math.max(1, Math.floor(len / 60));
      const angle = Math.atan2(dy, dx);

      for (let j = 1; j <= count; j++) {
        const t = j / (count + 1);
        const ax = from.x + dx * t;
        const ay = from.y + dy * t;
        const arrow = this.add.graphics();
        arrow.fillStyle(0x81d4fa, 0.2);
        arrow.beginPath();
        arrow.moveTo(ax + Math.cos(angle) * 6, ay + Math.sin(angle) * 6);
        arrow.lineTo(ax + Math.cos(angle + 2.6) * 5, ay + Math.sin(angle + 2.6) * 5);
        arrow.lineTo(ax + Math.cos(angle - 2.6) * 5, ay + Math.sin(angle - 2.6) * 5);
        arrow.closePath();
        arrow.fillPath();
        arrow.setDepth(1);
      }
    }

    // Start/End markers
    const startPt = this.path[0];
    const sg = this.add.graphics();
    sg.fillStyle(0x4caf50, 0.3); sg.fillCircle(startPt.x, startPt.y, 16);
    sg.fillStyle(0x4caf50, 0.15); sg.fillCircle(startPt.x, startPt.y, 22);
    sg.setDepth(1);
    this.add.text(startPt.x, startPt.y - 22, 'START', { fontSize: '9px', fontFamily: 'Arial', color: '#66bb6a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    const endPt = this.path[this.path.length - 1];
    const eg = this.add.graphics();
    eg.fillStyle(0xf44336, 0.3); eg.fillCircle(endPt.x, endPt.y, 16);
    eg.fillStyle(0xf44336, 0.15); eg.fillCircle(endPt.x, endPt.y, 22);
    eg.setDepth(1);
    this.add.text(endPt.x, endPt.y - 22, 'END', { fontSize: '9px', fontFamily: 'Arial', color: '#ef5350', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);
  }

  private createHUD(): void {
    const { width } = this.scale;
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0a1628, 0.9);
    hudBg.fillRect(0, 0, width, HUD_HEIGHT);
    hudBg.fillStyle(0x29b6f6, 0.15);
    hudBg.fillRect(0, HUD_HEIGHT - 1, width, 1);
    hudBg.setDepth(19);

    const hudY = HUD_HEIGHT / 2;

    this.add.image(20, hudY, 'coin').setDepth(20);
    this.goldText = this.add.text(36, hudY, `${this.gold}`, {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20);

    this.add.image(130, hudY, 'heart').setDepth(20);
    this.livesText = this.add.text(146, hudY, `${this.lives}`, {
      fontSize: '15px', fontFamily: 'Arial', color: '#ff5252', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20);

    this.add.image(width / 2 - 50, hudY, 'wave_icon').setDepth(20);
    this.waveText = this.add.text(width / 2 - 34, hudY, 'Wave 0/20', {
      fontSize: '14px', fontFamily: 'Arial', color: '#81d4fa', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(20);

    // Speed button
    this.speedBtn = this.add.container(width - 45, hudY);
    const speedBg = this.add.graphics();
    speedBg.fillStyle(0x0d1b30, 0.9);
    speedBg.fillRoundedRect(-28, -13, 56, 26, 13);
    speedBg.lineStyle(1.5, 0x29b6f6, 0.5);
    speedBg.strokeRoundedRect(-28, -13, 56, 26, 13);
    this.speedBtnText = this.add.text(0, 0, 'x1', {
      fontSize: '13px', fontFamily: 'Arial', color: '#81d4fa', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.speedBtn.add([speedBg, this.speedBtnText]);
    this.speedBtn.setSize(56, 26).setInteractive().setDepth(20);
    this.speedBtn.on('pointerdown', () => this.toggleSpeed());
  }

  private createBottomPanel(): void {
    const { width, height } = this.scale;
    const panelY = height - BOTTOM_PANEL_HEIGHT;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0a1628, 0.92);
    panelBg.fillRect(0, panelY, width, BOTTOM_PANEL_HEIGHT);
    panelBg.fillStyle(0x29b6f6, 0.12);
    panelBg.fillRect(0, panelY, width, 1);
    panelBg.setDepth(19);

    const btnY = panelY + BOTTOM_PANEL_HEIGHT / 2;

    // === SUMMON BUTTON ===
    this.summonBtn = this.add.container(width / 2 - 130, btnY);
    const sumBg = this.add.graphics();
    sumBg.fillStyle(0x29b6f6, 0.12);
    sumBg.fillRoundedRect(-55, -28, 110, 56, 12);
    sumBg.fillStyle(0x0277bd, 0.9);
    sumBg.fillRoundedRect(-50, -24, 100, 48, 10);
    sumBg.fillStyle(0xffffff, 0.08);
    sumBg.fillRoundedRect(-49, -23, 98, 20, { tl: 10, tr: 10, bl: 0, br: 0 });
    sumBg.lineStyle(1.5, 0x4fc3f7, 0.5);
    sumBg.strokeRoundedRect(-50, -24, 100, 48, 10);
    const sumLabel = this.add.text(0, -8, '\u{1F427} 소환', {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.summonCostText = this.add.text(0, 10, `${this.getSummonCost()}G`, {
      fontSize: '11px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.summonBtn.add([sumBg, sumLabel, this.summonCostText]);
    this.summonBtn.setSize(100, 48).setInteractive().setDepth(20);
    this.summonBtn.on('pointerdown', () => this.summonHero());
    this.tweens.add({
      targets: this.summonBtn, scaleX: 1.03, scaleY: 1.03,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // === MERGE BUTTON ===
    this.mergeBtn = this.add.container(width / 2, btnY);
    const mergBg = this.add.graphics();
    mergBg.fillStyle(0x9c27b0, 0.12);
    mergBg.fillRoundedRect(-45, -28, 90, 56, 12);
    mergBg.fillStyle(0x7b1fa2, 0.9);
    mergBg.fillRoundedRect(-40, -24, 80, 48, 10);
    mergBg.fillStyle(0xffffff, 0.08);
    mergBg.fillRoundedRect(-39, -23, 78, 20, { tl: 10, tr: 10, bl: 0, br: 0 });
    mergBg.lineStyle(1.5, 0xce93d8, 0.5);
    mergBg.strokeRoundedRect(-40, -24, 80, 48, 10);
    const mergLabel = this.add.text(0, -6, '\u2728 합성', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.mergeBadge = this.add.text(0, 12, '0', {
      fontSize: '10px', fontFamily: 'Arial', color: '#ce93d8',
    }).setOrigin(0.5);
    this.mergeBtn.add([mergBg, mergLabel, this.mergeBadge]);
    this.mergeBtn.setSize(80, 48).setInteractive().setDepth(20);
    this.mergeBtn.on('pointerdown', () => this.autoMerge());

    // === SUMMON LEVEL UP ===
    this.summonLvBtn = this.add.container(width / 2 + 120, btnY);
    const lvBg = this.add.graphics();
    lvBg.fillStyle(0x4caf50, 0.12);
    lvBg.fillRoundedRect(-50, -28, 100, 56, 12);
    lvBg.fillStyle(0x2e7d32, 0.9);
    lvBg.fillRoundedRect(-45, -24, 90, 48, 10);
    lvBg.fillStyle(0xffffff, 0.08);
    lvBg.fillRoundedRect(-44, -23, 88, 20, { tl: 10, tr: 10, bl: 0, br: 0 });
    lvBg.lineStyle(1.5, 0x66bb6a, 0.5);
    lvBg.strokeRoundedRect(-45, -24, 90, 48, 10);
    this.summonLvText = this.add.text(0, -8, `소환 Lv.${this.summonLevel}`, {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const lvCostText = this.add.text(0, 10, this.getSummonLevelUpCostText(), {
      fontSize: '10px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.summonLvBtn.add([lvBg, this.summonLvText, lvCostText]);
    this.summonLvBtn.setSize(90, 48).setInteractive().setDepth(20);
    this.summonLvBtn.on('pointerdown', () => this.upgradeSummonLevel(lvCostText));
  }

  private createInfoPanel(): void {
    this.infoPanel = this.add.container(0, 0);
    this.infoPanel.setVisible(false);
    this.infoPanel.setDepth(30);
  }

  private showHeroInfo(hero: Hero): void {
    this.infoPanel.removeAll(true);
    const { width, height } = this.scale;
    const panelW = 240;
    const panelH = 210;
    const tierColor = TIER_COLORS[hero.tier - 1];

    const dimmer = this.add.graphics();
    dimmer.fillStyle(0x000000, 0.3);
    dimmer.fillRect(-width / 2, -height / 2, width, height);
    dimmer.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    dimmer.on('pointerdown', () => this.closeHeroInfo());

    const bg = this.add.graphics();
    bg.fillStyle(tierColor, 0.08);
    bg.fillRoundedRect(-panelW / 2 - 4, -panelH / 2 - 4, panelW + 8, panelH + 8, 14);
    bg.fillStyle(0x0a1628, 0.97);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    bg.lineStyle(1.5, tierColor, 0.5);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    bg.fillStyle(0xffffff, 0.04);
    bg.fillRoundedRect(-panelW / 2 + 1, -panelH / 2 + 1, panelW - 2, 30, { tl: 12, tr: 12, bl: 0, br: 0 });
    bg.fillStyle(tierColor, 0.2);
    bg.fillRect(-panelW / 2 + 15, -panelH / 2 + 36, panelW - 30, 1);

    const icon = this.add.image(-panelW / 2 + 28, -panelH / 2 + 18, `hero_${hero.heroType}`).setScale(0.7);

    const nameText = this.add.text(-panelW / 2 + 52, -panelH / 2 + 10, hero.config.nameKo, {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    });

    const tierText = this.add.text(-panelW / 2 + 52, -panelH / 2 + 28, `${TIER_NAMES[hero.tier - 1]} (${'\u2605'.repeat(hero.tier)})`, {
      fontSize: '10px', fontFamily: 'Arial', color: '#' + tierColor.toString(16).padStart(6, '0'),
    });

    const sy = -panelH / 2 + 48;
    const stats = [
      { label: 'ATK', value: `${hero.getCurrentDamage()}`, color: '#ff8a80' },
      { label: 'RNG', value: `${hero.getCurrentRange()}`, color: '#80d8ff' },
      { label: 'SPD', value: `${hero.getCurrentFireRate().toFixed(1)}/s`, color: '#b9f6ca' },
    ];

    const statTexts: Phaser.GameObjects.Text[] = [];
    stats.forEach((s, i) => {
      statTexts.push(
        this.add.text(-panelW / 2 + 18, sy + i * 22, s.label, { fontSize: '10px', fontFamily: 'Arial', color: '#607d8b', fontStyle: 'bold' }),
        this.add.text(-panelW / 2 + 55, sy + i * 22, s.value, { fontSize: '12px', fontFamily: 'Arial', color: s.color, fontStyle: 'bold' }),
      );
    });

    const descText = this.add.text(0, sy + 70, hero.config.description, {
      fontSize: '10px', fontFamily: 'Arial', color: '#78909c',
    }).setOrigin(0.5);

    this.infoPanel.add([dimmer, bg, icon, nameText, tierText, descText, ...statTexts]);

    // Sell button
    const sellVal = hero.getSellValue();
    const sellBtn = this.createPanelButton(0, panelH / 2 - 30, 140, 30, 0xf44336, `\u{1F4B0} \uD310\uB9E4 ${sellVal}G`, () => this.sellHero(hero));
    this.infoPanel.add(sellBtn);

    // Close
    const closeBtn = this.add.text(panelW / 2 - 18, -panelH / 2 + 8, '\u2715', {
      fontSize: '14px', fontFamily: 'Arial', color: '#78909c',
    }).setOrigin(0.5).setInteractive();
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff5252'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#78909c'));
    closeBtn.on('pointerdown', () => this.closeHeroInfo());
    this.infoPanel.add(closeBtn);

    this.infoPanel.setPosition(width / 2, height / 2);
    this.infoPanel.setVisible(true);
    this.infoPanel.setAlpha(0);
    this.tweens.add({ targets: this.infoPanel, alpha: 1, duration: 150 });
  }

  private createPanelButton(
    x: number, y: number, w: number, h: number,
    color: number, label: string, callback: () => void,
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.fillStyle(0xffffff, 0.08);
    bg.fillRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h / 2 - 1, { tl: 6, tr: 6, bl: 0, br: 0 });
    const text = this.add.text(0, 0, label, {
      fontSize: '11px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.add([bg, text]);
    btn.setSize(w, h).setInteractive();
    btn.on('pointerdown', callback);
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 80 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }));
    return btn;
  }

  private closeHeroInfo(): void {
    this.infoPanel.setVisible(false);
    if (this.selectedHero) {
      this.selectedHero.hideRange();
      this.selectedHero = null;
    }
  }

  private createNextWaveButton(): void {
    const { width, height } = this.scale;
    const mapBottom = this.mapOffsetY + this.mapConfig.rows * this.mapConfig.tileSize;
    const btnY = mapBottom + (height - BOTTOM_PANEL_HEIGHT - mapBottom) / 2;

    this.nextWaveBtn = this.add.container(width / 2, btnY);
    const bg = this.add.graphics();
    bg.fillStyle(0xff9800, 0.12);
    bg.fillRoundedRect(-78, -20, 156, 40, 20);
    bg.fillStyle(0xff9800, 0.9);
    bg.fillRoundedRect(-72, -16, 144, 32, 16);
    bg.fillStyle(0xffffff, 0.08);
    bg.fillRoundedRect(-71, -15, 142, 14, { tl: 16, tr: 16, bl: 0, br: 0 });
    bg.lineStyle(1, 0xffb74d, 0.4);
    bg.strokeRoundedRect(-72, -16, 144, 32, 16);

    const text = this.add.text(0, 0, '\u25B6  \uB2E4\uC74C \uC6E8\uC774\uBE0C', {
      fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.nextWaveBtn.add([bg, text]);
    this.nextWaveBtn.setSize(144, 32).setInteractive().setDepth(20);

    this.nextWaveBtn.on('pointerdown', () => {
      if (!this.waveManager.waveInProgress) {
        const started = this.waveManager.startNextWave();
        if (started) {
          playWaveStart();
          this.updateHUD();
          this.nextWaveBtn.setVisible(false);
        }
      }
    });

    this.tweens.add({
      targets: this.nextWaveBtn, scaleX: 1.04, scaleY: 1.04,
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ========== SUMMON SYSTEM ==========

  private getSummonCost(): number {
    return BASE_SUMMON_COST + this.summonCount * SUMMON_COST_INCREMENT;
  }

  private getSummonLevelUpCostText(): string {
    if (this.summonLevel >= MAX_SUMMON_LEVEL) return 'MAX';
    return `${SUMMON_UPGRADE_COSTS[this.summonLevel - 1]}G`;
  }

  private summonHero(): void {
    const cost = this.getSummonCost();
    if (this.gold < cost) return;

    // Find empty slot
    const emptySlots: { col: number; row: number }[] = [];
    for (let row = 0; row < this.mapConfig.rows; row++) {
      for (let col = 0; col < this.mapConfig.cols; col++) {
        if (this.mapConfig.grid[row][col] === 0 && !this.gridOccupied[row][col]) {
          emptySlots.push({ col, row });
        }
      }
    }

    if (emptySlots.length === 0) return;

    this.gold -= cost;
    this.summonCount++;

    const slot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    const type = rollSummonType();
    const tier = rollSummonTier(this.summonLevel);

    const x = this.mapOffsetX + slot.col * this.mapConfig.tileSize + this.mapConfig.tileSize / 2;
    const y = this.mapOffsetY + slot.row * this.mapConfig.tileSize + this.mapConfig.tileSize / 2;

    const hero = new Hero(this, x, y, type, tier, slot.col, slot.row);
    hero.setDepth(3);
    this.heroes.push(hero);
    this.gridOccupied[slot.row][slot.col] = true;

    playSummon();

    // Show tier if rare+
    if (tier >= 3) {
      const tierName = TIER_NAMES[tier - 1];
      const tierColor = TIER_COLORS[tier - 1];
      const announce = this.add.text(x, y - 30, `\u2605 ${tierName}! \u2605`, {
        fontSize: '12px', fontFamily: 'Arial',
        color: '#' + tierColor.toString(16).padStart(6, '0'), fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15);
      this.tweens.add({
        targets: announce, y: announce.y - 25, alpha: 0,
        duration: 1200, onComplete: () => announce.destroy(),
      });
    }

    this.updateHUD();
    this.updateMergeBadge();
  }

  private upgradeSummonLevel(costText: Phaser.GameObjects.Text): void {
    if (this.summonLevel >= MAX_SUMMON_LEVEL) return;
    const cost = SUMMON_UPGRADE_COSTS[this.summonLevel - 1];
    if (this.gold < cost) return;

    this.gold -= cost;
    this.summonLevel++;
    playClick();

    this.summonLvText.setText(`소환 Lv.${this.summonLevel}`);
    costText.setText(this.getSummonLevelUpCostText());
    this.updateHUD();
  }

  // ========== MERGE SYSTEM ==========

  private getMergeableGroups(): Map<string, Hero[]> {
    const groups = new Map<string, Hero[]>();
    for (const hero of this.heroes) {
      if (hero.tier >= MAX_TIER) continue;
      const key = hero.getKey();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(hero);
    }
    // Only return groups with 3+
    const mergeable = new Map<string, Hero[]>();
    for (const [key, list] of groups) {
      if (list.length >= 3) mergeable.set(key, list);
    }
    return mergeable;
  }

  private updateMergeBadge(): void {
    const groups = this.getMergeableGroups();
    let count = 0;
    for (const [, list] of groups) {
      count += Math.floor(list.length / 3);
    }
    this.mergeBadge.setText(count > 0 ? `${count}\uAC1C \uAC00\uB2A5` : '');
  }

  private autoMerge(): void {
    const groups = this.getMergeableGroups();
    if (groups.size === 0) return;

    let merged = false;
    for (const [, list] of groups) {
      while (list.length >= 3) {
        const toMerge = list.splice(0, 3);
        const keeper = toMerge[0];

        // Remove other 2
        for (let i = 1; i < 3; i++) {
          const h = toMerge[i];
          this.gridOccupied[h.gridRow][h.gridCol] = false;
          const idx = this.heroes.indexOf(h);
          if (idx >= 0) this.heroes.splice(idx, 1);

          // Merge animation: fly to keeper
          this.tweens.add({
            targets: h, x: keeper.x, y: keeper.y, alpha: 0, scaleX: 0.3, scaleY: 0.3,
            duration: 250, onComplete: () => h.destroy(),
          });
        }

        // Upgrade keeper after animation
        this.time.delayedCall(260, () => {
          keeper.upgradeTier();
        });

        merged = true;
      }
    }

    if (merged) {
      playMerge();
      this.time.delayedCall(300, () => this.updateMergeBadge());
    }
  }

  // ========== INPUT ==========

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver) return;
    const { height } = this.scale;
    if (pointer.y > height - BOTTOM_PANEL_HEIGHT - 5 || pointer.y < HUD_HEIGHT) return;
    if (this.infoPanel.visible) return;

    const { col, row } = this.screenToGrid(pointer.x, pointer.y);
    const hero = this.getHeroAt(col, row);
    if (hero) {
      this.selectedHero = hero;
      hero.showRange();
      this.showHeroInfo(hero);
    }
  }

  private screenToGrid(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor((x - this.mapOffsetX) / this.mapConfig.tileSize),
      row: Math.floor((y - this.mapOffsetY) / this.mapConfig.tileSize),
    };
  }

  private getHeroAt(col: number, row: number): Hero | null {
    return this.heroes.find(h => h.gridCol === col && h.gridRow === row) || null;
  }

  private sellHero(hero: Hero): void {
    const value = hero.getSellValue();
    this.gold += value;
    playSell();
    this.gridOccupied[hero.gridRow][hero.gridCol] = false;

    const idx = this.heroes.indexOf(hero);
    if (idx >= 0) this.heroes.splice(idx, 1);

    const text = this.add.text(hero.x, hero.y - 20, `+${value}G`, {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: text, y: text.y - 35, alpha: 0,
      duration: 900, onComplete: () => text.destroy(),
    });

    hero.destroy();
    this.closeHeroInfo();
    this.updateHUD();
    this.updateMergeBadge();
  }

  // ========== GAME EVENTS ==========

  private onEnemyReachEnd(enemy: Enemy): void {
    this.lives--;
    playLifeLost();
    this.updateHUD();
    this.cameras.main.shake(200, 0.006);
    this.cameras.main.flash(150, 255, 0, 0, false);

    if (this.lives <= 0) {
      this.endGame(false);
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    const reward = enemy.stats.reward;
    this.gold += reward;
    playGoldPickup();
    this.updateHUD();

    const text = this.add.text(enemy.x, enemy.y - 15, `+${reward}G`, {
      fontSize: '10px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: text, y: text.y - 28, alpha: 0,
      duration: 700, onComplete: () => text.destroy(),
    });
  }

  private toggleSpeed(): void {
    playClick();
    if (this.gameSpeed === 1) {
      this.gameSpeed = 2;
      this.speedBtnText.setText('x2');
      this.speedBtnText.setColor('#69f0ae');
    } else if (this.gameSpeed === 2) {
      this.gameSpeed = 3;
      this.speedBtnText.setText('x3');
      this.speedBtnText.setColor('#ff8a80');
    } else {
      this.gameSpeed = 1;
      this.speedBtnText.setText('x1');
      this.speedBtnText.setColor('#81d4fa');
    }
  }

  private updateHUD(): void {
    this.goldText.setText(`${this.gold}`);
    this.livesText.setText(`${this.lives}`);
    const info = this.waveManager.getWaveInfo();
    this.waveText.setText(`Wave ${info.current}/${info.total}`);
    this.summonCostText.setText(`${this.getSummonCost()}G`);
  }

  private endGame(victory: boolean): void {
    this.gameOver = true;
    stopBGM();
    this.waveManager.cleanup();
    this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress >= 1) {
        this.scene.start('GameOverScene', {
          victory,
          wave: this.waveManager.currentWave,
          gold: this.gold,
        });
      }
    });
  }

  update(time: number, rawDelta: number): void {
    if (this.gameOver) return;

    const delta = rawDelta * this.gameSpeed;

    this.waveManager.update(delta);

    if (!this.waveManager.waveInProgress && !this.waveManager.allWavesComplete) {
      this.nextWaveBtn.setVisible(true);
    }

    for (const hero of this.heroes) {
      hero.update(delta, this.enemies, this.projectiles);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.alive || !proj.active) {
        this.projectiles.splice(i, 1);
        continue;
      }
      proj.update(delta, this.enemies);
      if (!proj.alive) {
        this.projectiles.splice(i, 1);
      }
    }

    if (!this.waveManager.waveInProgress && this.waveManager.waveReward > 0) {
      this.gold += this.waveManager.waveReward;
      playWaveClear();
      this.cameras.main.flash(200, 255, 215, 0, false);

      const { width } = this.scale;
      const bonusText = this.add.text(width / 2, this.mapOffsetY - 10, `\u2605 Wave Clear  +${this.waveManager.waveReward}G \u2605`, {
        fontSize: '16px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20);
      this.tweens.add({
        targets: bonusText, y: bonusText.y - 30, alpha: 0, scaleX: 1.2, scaleY: 1.2,
        duration: 1800, onComplete: () => bonusText.destroy(),
      });

      this.add.particles(width / 2, this.mapOffsetY + (this.mapConfig.rows * this.mapConfig.tileSize) / 2, 'particle_spark', {
        speed: { min: 50, max: 150 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: [0xffd700, 0xffeb3b, 0xffffff],
        lifespan: 1000,
        quantity: 20,
        emitting: false,
      }).explode(20);

      this.waveManager.waveReward = 0;
      this.updateHUD();
    }

    if (this.waveManager.allWavesComplete && this.enemies.length === 0) {
      this.endGame(true);
    }
  }
}
