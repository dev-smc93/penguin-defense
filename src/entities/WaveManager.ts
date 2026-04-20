import * as Phaser from 'phaser';
import { WAVES, WaveConfig, TOTAL_WAVES } from '../data/WaveData';
import { Enemy } from './Enemy';
import { PathPoint } from '../utils/PathFollower';

export class WaveManager {
  public currentWave: number = 0;
  public waveInProgress: boolean = false;
  public allWavesComplete: boolean = false;
  public enemiesAlive: number = 0;
  public totalEnemiesInWave: number = 0;
  public waveReward: number = 0;

  private scene: Phaser.Scene;
  private path: PathPoint[];
  private enemies: Enemy[];
  private spawnTimers: Phaser.Time.TimerEvent[] = [];
  private onEnemyReachEnd: (enemy: Enemy) => void;
  private onEnemyKilled: (enemy: Enemy) => void;

  constructor(
    scene: Phaser.Scene,
    path: PathPoint[],
    enemies: Enemy[],
    onEnemyReachEnd: (enemy: Enemy) => void,
    onEnemyKilled: (enemy: Enemy) => void,
  ) {
    this.scene = scene;
    this.path = path;
    this.enemies = enemies;
    this.onEnemyReachEnd = onEnemyReachEnd;
    this.onEnemyKilled = onEnemyKilled;
  }

  getWaveInfo(): { current: number; total: number } {
    return { current: this.currentWave, total: TOTAL_WAVES };
  }

  startNextWave(): boolean {
    if (this.waveInProgress || this.currentWave >= TOTAL_WAVES) return false;

    this.currentWave++;
    this.waveInProgress = true;

    const waveConfig = WAVES[this.currentWave - 1];
    this.waveReward = waveConfig.reward;
    this.totalEnemiesInWave = waveConfig.enemies.reduce((sum, e) => sum + e.count, 0);
    this.enemiesAlive = this.totalEnemiesInWave;

    this.spawnWave(waveConfig);
    return true;
  }

  private spawnWave(config: WaveConfig): void {
    // HP multiplier increases each wave
    const hpMultiplier = 1 + (this.currentWave - 1) * 0.12;
    let globalDelay = 0;

    for (const enemyGroup of config.enemies) {
      for (let i = 0; i < enemyGroup.count; i++) {
        const delay = globalDelay + i * enemyGroup.delay;
        const timer = this.scene.time.delayedCall(delay, () => {
          if (!this.scene || !this.scene.sys.isActive()) return;
          const enemy = new Enemy(this.scene, this.path, enemyGroup.type, hpMultiplier);
          this.enemies.push(enemy);
        });
        this.spawnTimers.push(timer);
      }
      globalDelay += enemyGroup.count * enemyGroup.delay + 500;
    }
  }

  update(delta: number): void {
    if (!this.waveInProgress) return;

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.active || !enemy.alive) continue;

      const reachedEnd = enemy.update(delta);
      if (reachedEnd) {
        this.onEnemyReachEnd(enemy);
        enemy.alive = false;
        enemy.destroy();
        this.enemies.splice(i, 1);
        this.enemiesAlive--;
      }
    }

    // Clean up dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive && enemy.active) {
        this.onEnemyKilled(enemy);
        this.enemies.splice(i, 1);
        this.enemiesAlive--;
      } else if (!enemy.active) {
        this.enemies.splice(i, 1);
      }
    }

    // Check if wave is complete
    if (this.enemiesAlive <= 0 && this.spawnTimersComplete()) {
      this.waveInProgress = false;
      if (this.currentWave >= TOTAL_WAVES) {
        this.allWavesComplete = true;
      }
    }
  }

  private spawnTimersComplete(): boolean {
    return this.spawnTimers.every(t => t.hasDispatched);
  }

  cleanup(): void {
    for (const timer of this.spawnTimers) {
      timer.remove();
    }
    this.spawnTimers = [];
    for (const enemy of this.enemies) {
      if (enemy.active) enemy.destroy();
    }
    this.enemies.length = 0;
  }
}
