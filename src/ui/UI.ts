import { TOWER_TYPES, TIER_NAMES, TIER_COLORS, SKILL_MIN_TIER } from '../data/TowerData';
import { TOTAL_WAVES } from '../data/WaveData';

export interface TowerLike {
  type: string;
  tier: number;
  config: { nameKo: string; skill: { nameKo: string; cooldown: number } };
  getDamage(): number;
  getRange(): number;
  getFireRate(): number;
  getSellValue(): number;
  skillCooldown: number;
}

export interface GameLike {
  startGame(): void;
  returnToMenu(): void;
  summonTower(): void;
  autoMerge(): void;
  cancelPlacing(): void;
  sellTower(tower: any): void;
  activateSkill(tower: any): void;
  startNextWave(): void;
  upgradeSummonLevel(): void;
  toggleSpeed(): void;
  getSelectedTower(): any;
  getGold(): number;
  isWaveInProgress(): boolean;
  getCurrentWave(): number;
}

function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export class UI {
  private container: HTMLElement;
  private game: GameLike;

  private overlay!: HTMLDivElement;
  private menuEl!: HTMLDivElement;
  private hudEl!: HTMLDivElement;
  private bottomPanel!: HTMLDivElement;
  private towerInfoEl!: HTMLDivElement;
  private placingEl!: HTMLDivElement;
  private announcementEl!: HTMLDivElement;
  private gameOverEl!: HTMLDivElement;

  // HUD elements
  private goldEl!: HTMLSpanElement;
  private livesEl!: HTMLSpanElement;
  private waveEl!: HTMLSpanElement;
  private timerEl!: HTMLSpanElement;
  private speedBtn!: HTMLButtonElement;

  // Bottom panel elements
  private summonBtn!: HTMLButtonElement;
  private mergeBtn!: HTMLButtonElement;
  private waveBtn!: HTMLButtonElement;
  private upgradeBtn!: HTMLButtonElement;

  private announcementTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTower: TowerLike | null = null;

  constructor(container: HTMLElement, game: GameLike) {
    this.container = container;
    this.game = game;
    this.build();
  }

  private build(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'ui-overlay';
    this.overlay.innerHTML = `
      <style>
        #ui-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          font-family: 'Noto Sans KR', Arial, sans-serif;
          color: #e1f5fe;
          z-index: 10;
          display: flex;
          flex-direction: column;
        }
        #ui-overlay * { pointer-events: auto; }
        #ui-overlay button {
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-weight: bold;
          transition: transform 0.1s, opacity 0.1s;
          -webkit-tap-highlight-color: transparent;
        }
        #ui-overlay button:active { transform: scale(0.93); opacity: 0.8; }

        .ui-menu {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          background: rgba(10,22,40,0.85);
        }
        .ui-menu h1 {
          font-size: 28px;
          text-align: center;
          text-shadow: 0 0 20px #4fc3f7;
          line-height: 1.3;
        }
        .ui-menu p { font-size: 13px; opacity: 0.7; text-align: center; padding: 0 20px; }
        .ui-menu .play-btn {
          background: linear-gradient(135deg, #0288d1, #01579b);
          color: #fff;
          font-size: 20px;
          padding: 14px 50px;
          border-radius: 30px;
          box-shadow: 0 4px 20px rgba(2,136,209,0.5);
        }

        .ui-hud {
          display: none;
          padding: 8px 12px;
          background: linear-gradient(180deg, rgba(10,22,40,0.9) 0%, transparent 100%);
          gap: 6px;
        }
        .hud-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          gap: 8px;
        }
        .hud-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .hud-item .label { opacity: 0.6; font-size: 11px; }
        .hud-item .value { font-weight: bold; font-size: 14px; }
        .hud-timer {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          color: #ffd54f;
          text-shadow: 0 0 8px rgba(255,213,79,0.5);
        }
        .hud-timer.urgent { color: #ff5252; animation: pulse 0.5s infinite; }
        @keyframes pulse { 50% { opacity: 0.5; } }
        .speed-btn {
          background: rgba(255,255,255,0.1);
          color: #4fc3f7;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .ui-bottom {
          display: none;
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 10px;
          background: linear-gradient(0deg, rgba(10,22,40,0.95) 0%, transparent 100%);
          padding-top: 30px;
        }
        .bottom-row {
          display: flex;
          gap: 6px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .action-btn {
          flex: 1;
          min-width: 70px;
          max-width: 100px;
          padding: 10px 4px;
          border-radius: 12px;
          font-size: 11px;
          text-align: center;
          line-height: 1.3;
          color: #fff;
        }
        .action-btn .btn-label { display: block; font-size: 10px; opacity: 0.7; margin-top: 2px; }
        .summon-btn { background: linear-gradient(135deg, #1565c0, #0d47a1); }
        .merge-btn { background: linear-gradient(135deg, #6a1b9a, #4a148c); }
        .wave-btn { background: linear-gradient(135deg, #e65100, #bf360c); }
        .upgrade-btn { background: linear-gradient(135deg, #2e7d32, #1b5e20); }

        .ui-tower-info {
          display: none;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(13,27,48,0.95);
          border: 1px solid rgba(79,195,247,0.3);
          border-radius: 16px;
          padding: 16px;
          width: 260px;
          backdrop-filter: blur(8px);
        }
        .tower-info-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .tower-info-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
        }
        .tower-info-name { font-size: 16px; font-weight: bold; }
        .tower-info-tier { font-size: 12px; opacity: 0.7; margin-left: auto; }
        .tower-info-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .tower-info-stats .stat { background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 6px; }
        .tower-info-stats .stat-label { opacity: 0.6; font-size: 10px; display: block; }
        .tower-info-stats .stat-value { font-weight: bold; }
        .tower-info-actions {
          display: flex;
          gap: 8px;
        }
        .tower-info-actions button {
          flex: 1;
          padding: 8px;
          border-radius: 8px;
          font-size: 12px;
          color: #fff;
        }
        .sell-btn { background: #c62828; }
        .skill-btn { background: linear-gradient(135deg, #ff6f00, #e65100); }
        .skill-btn:disabled { background: #333; opacity: 0.5; }
        .close-info-btn { background: rgba(255,255,255,0.1); }

        .ui-placing {
          display: none;
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(13,27,48,0.9);
          border: 1px solid rgba(79,195,247,0.3);
          border-radius: 12px;
          padding: 12px 20px;
          text-align: center;
          font-size: 13px;
        }
        .placing-cancel {
          margin-top: 8px;
          background: #c62828;
          color: #fff;
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 12px;
        }

        .ui-announcement {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 22px;
          font-weight: bold;
          text-align: center;
          text-shadow: 0 0 20px currentColor;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none !important;
        }
        .ui-announcement.visible { opacity: 1; }

        .ui-gameover {
          display: none;
          position: absolute;
          inset: 0;
          background: rgba(10,22,40,0.92);
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .gameover-title { font-size: 32px; font-weight: bold; text-shadow: 0 0 20px currentColor; }
        .gameover-stats { font-size: 14px; opacity: 0.8; text-align: center; line-height: 1.8; }
        .gameover-btn {
          background: linear-gradient(135deg, #0288d1, #01579b);
          color: #fff;
          font-size: 16px;
          padding: 12px 40px;
          border-radius: 24px;
          margin-top: 10px;
        }
      </style>
    `;

    // Menu
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'ui-menu';
    this.menuEl.innerHTML = `
      <h1>펭귄 대모험 3D<br><span style="font-size:16px;opacity:0.7">원형 타워 디펜스</span></h1>
      <p>몬스터가 나선형으로 몰려온다!<br>타워를 소환하고 합성하여 방어하라!</p>
      <button class="play-btn">게임 시작</button>
    `;
    this.menuEl.querySelector('.play-btn')!.addEventListener('click', () => this.game.startGame());
    this.overlay.appendChild(this.menuEl);

    // HUD
    this.hudEl = document.createElement('div');
    this.hudEl.className = 'ui-hud';
    this.hudEl.innerHTML = `
      <div class="hud-row">
        <div class="hud-item"><span class="label">GOLD</span><span class="value gold-val">200</span></div>
        <div class="hud-item"><span class="label">LIVES</span><span class="value lives-val">20</span></div>
        <div class="hud-item"><span class="label">WAVE</span><span class="value wave-val">0/${TOTAL_WAVES}</span></div>
        <button class="speed-btn">x1</button>
      </div>
      <div class="hud-timer">--:--</div>
    `;
    this.goldEl = this.hudEl.querySelector('.gold-val') as HTMLSpanElement;
    this.livesEl = this.hudEl.querySelector('.lives-val') as HTMLSpanElement;
    this.waveEl = this.hudEl.querySelector('.wave-val') as HTMLSpanElement;
    this.timerEl = this.hudEl.querySelector('.hud-timer') as HTMLSpanElement;
    this.speedBtn = this.hudEl.querySelector('.speed-btn') as HTMLButtonElement;
    this.speedBtn.addEventListener('click', () => this.game.toggleSpeed());
    this.overlay.appendChild(this.hudEl);

    // Bottom panel
    this.bottomPanel = document.createElement('div');
    this.bottomPanel.className = 'ui-bottom';
    this.bottomPanel.innerHTML = `
      <div class="bottom-row">
        <button class="action-btn summon-btn">소환<span class="btn-label">30G</span></button>
        <button class="action-btn merge-btn">합성<span class="btn-label">0개</span></button>
        <button class="action-btn wave-btn">출전<span class="btn-label">WAVE</span></button>
        <button class="action-btn upgrade-btn">강화<span class="btn-label">150G</span></button>
      </div>
    `;
    this.summonBtn = this.bottomPanel.querySelector('.summon-btn') as HTMLButtonElement;
    this.mergeBtn = this.bottomPanel.querySelector('.merge-btn') as HTMLButtonElement;
    this.waveBtn = this.bottomPanel.querySelector('.wave-btn') as HTMLButtonElement;
    this.upgradeBtn = this.bottomPanel.querySelector('.upgrade-btn') as HTMLButtonElement;
    this.summonBtn.addEventListener('click', () => this.game.summonTower());
    this.mergeBtn.addEventListener('click', () => this.game.autoMerge());
    this.waveBtn.addEventListener('click', () => this.game.startNextWave());
    this.upgradeBtn.addEventListener('click', () => this.game.upgradeSummonLevel());
    this.overlay.appendChild(this.bottomPanel);

    // Tower info
    this.towerInfoEl = document.createElement('div');
    this.towerInfoEl.className = 'ui-tower-info';
    this.overlay.appendChild(this.towerInfoEl);

    // Placing mode
    this.placingEl = document.createElement('div');
    this.placingEl.className = 'ui-placing';
    this.overlay.appendChild(this.placingEl);

    // Announcement
    this.announcementEl = document.createElement('div');
    this.announcementEl.className = 'ui-announcement';
    this.overlay.appendChild(this.announcementEl);

    // Game over
    this.gameOverEl = document.createElement('div');
    this.gameOverEl.className = 'ui-gameover';
    this.overlay.appendChild(this.gameOverEl);

    this.container.appendChild(this.overlay);
  }

  showMenu(): void {
    this.menuEl.style.display = 'flex';
    this.hudEl.style.display = 'none';
    this.bottomPanel.style.display = 'none';
    this.towerInfoEl.style.display = 'none';
    this.placingEl.style.display = 'none';
    this.gameOverEl.style.display = 'none';
  }

  showGame(): void {
    this.menuEl.style.display = 'none';
    this.hudEl.style.display = 'block';
    this.bottomPanel.style.display = 'block';
    this.towerInfoEl.style.display = 'none';
    this.placingEl.style.display = 'none';
    this.gameOverEl.style.display = 'none';
  }

  showGameOver(victory: boolean, wave: number, gold: number): void {
    this.hudEl.style.display = 'none';
    this.bottomPanel.style.display = 'none';
    this.towerInfoEl.style.display = 'none';
    this.placingEl.style.display = 'none';
    this.gameOverEl.style.display = 'flex';

    const title = victory ? '승리!' : '패배...';
    const color = victory ? '#ffd54f' : '#ef5350';
    this.gameOverEl.innerHTML = `
      <div class="gameover-title" style="color:${color}">${title}</div>
      <div class="gameover-stats">
        Wave ${wave} / ${TOTAL_WAVES}<br>
        최종 골드: ${gold}G
      </div>
      <button class="gameover-btn">메인으로</button>
    `;
    this.gameOverEl.querySelector('.gameover-btn')!.addEventListener('click', () => this.game.returnToMenu());
  }

  updateHUD(gold: number, lives: number, wave: number, totalWaves: number, timer: number, timeLimit: number): void {
    this.goldEl.textContent = `${gold}`;
    this.livesEl.textContent = `${lives}`;
    this.waveEl.textContent = `${wave}/${totalWaves}`;

    if (timeLimit > 0 && timer > 0) {
      const sec = Math.ceil(timer);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      this.timerEl.textContent = `${min}:${s.toString().padStart(2, '0')}`;
      this.timerEl.classList.toggle('urgent', timer <= 10);
    } else {
      this.timerEl.textContent = '--:--';
      this.timerEl.classList.remove('urgent');
    }

    if (lives <= 5) {
      this.livesEl.style.color = '#ff5252';
    } else {
      this.livesEl.style.color = '';
    }
  }

  updateBottomPanel(summonCost: number, mergeCount: number, summonLevel: number, upgradeCostText: string): void {
    const summonLabel = this.summonBtn.querySelector('.btn-label')!;
    summonLabel.textContent = `${summonCost}G`;

    const mergeLabel = this.mergeBtn.querySelector('.btn-label')!;
    mergeLabel.textContent = `${mergeCount}개`;

    const upgradeLabel = this.upgradeBtn.querySelector('.btn-label')!;
    upgradeLabel.textContent = upgradeCostText;

    const waveLabel = this.waveBtn.querySelector('.btn-label')!;
    waveLabel.textContent = this.game.isWaveInProgress() ? '진행중' : `W${this.game.getCurrentWave() + 1}`;
  }

  showTowerInfo(tower: TowerLike): void {
    this.currentTower = tower;
    const tierName = TIER_NAMES[tower.tier - 1];
    const tierColor = hexToCSS(TIER_COLORS[tower.tier - 1]);
    const towerColor = hexToCSS(TOWER_TYPES[tower.type].color);
    const hasSkill = tower.tier >= SKILL_MIN_TIER;
    const skillReady = hasSkill && tower.skillCooldown <= 0;
    const cooldownText = tower.skillCooldown > 0 ? ` (${Math.ceil(tower.skillCooldown)}s)` : '';

    this.towerInfoEl.innerHTML = `
      <div class="tower-info-header">
        <div class="tower-info-dot" style="background:${towerColor};color:${towerColor}"></div>
        <span class="tower-info-name">${tower.config.nameKo}</span>
        <span class="tower-info-tier" style="color:${tierColor}">${tierName}</span>
      </div>
      <div class="tower-info-stats">
        <div class="stat"><span class="stat-label">공격력</span><span class="stat-value">${tower.getDamage()}</span></div>
        <div class="stat"><span class="stat-label">사거리</span><span class="stat-value">${tower.getRange()}</span></div>
        <div class="stat"><span class="stat-label">연사</span><span class="stat-value">${tower.getFireRate().toFixed(1)}/s</span></div>
        <div class="stat"><span class="stat-label">판매가</span><span class="stat-value">${tower.getSellValue()}G</span></div>
      </div>
      <div class="tower-info-actions">
        <button class="sell-btn">판매</button>
        ${hasSkill ? `<button class="skill-btn" ${!skillReady ? 'disabled' : ''}>${tower.config.skill.nameKo}${cooldownText}</button>` : ''}
        <button class="close-info-btn">닫기</button>
      </div>
    `;

    this.towerInfoEl.querySelector('.sell-btn')!.addEventListener('click', () => {
      if (this.currentTower) this.game.sellTower(this.currentTower);
    });
    const skillBtn = this.towerInfoEl.querySelector('.skill-btn');
    if (skillBtn) {
      skillBtn.addEventListener('click', () => {
        if (this.currentTower) this.game.activateSkill(this.currentTower);
        this.hideTowerInfo();
      });
    }
    this.towerInfoEl.querySelector('.close-info-btn')!.addEventListener('click', () => this.hideTowerInfo());

    this.towerInfoEl.style.display = 'block';
  }

  hideTowerInfo(): void {
    this.towerInfoEl.style.display = 'none';
    this.currentTower = null;
  }

  showPlacingMode(type: string, tier: number): void {
    const tierName = TIER_NAMES[tier - 1];
    const towerName = TOWER_TYPES[type].nameKo;
    const tierColor = hexToCSS(TIER_COLORS[tier - 1]);
    this.placingEl.innerHTML = `
      <div style="color:${tierColor};font-weight:bold;font-size:15px">${tierName} ${towerName}</div>
      <div style="margin-top:4px;opacity:0.7;font-size:12px">빈 슬롯을 터치하여 배치</div>
      <button class="placing-cancel">취소</button>
    `;
    this.placingEl.querySelector('.placing-cancel')!.addEventListener('click', () => this.game.cancelPlacing());
    this.placingEl.style.display = 'block';
  }

  hidePlacingMode(): void {
    this.placingEl.style.display = 'none';
  }

  showAnnouncement(text: string, color: number): void {
    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
    this.announcementEl.textContent = text;
    this.announcementEl.style.color = hexToCSS(color);
    this.announcementEl.classList.add('visible');
    this.announcementTimeout = setTimeout(() => {
      this.announcementEl.classList.remove('visible');
    }, 2000);
  }

  updateSpeed(speed: number): void {
    this.speedBtn.textContent = `x${speed}`;
  }
}
