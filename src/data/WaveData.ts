export interface WaveEnemy {
  type: string;
  count: number;
  delay: number;
}

export interface WaveConfig {
  enemies: WaveEnemy[];
  reward: number;
  timeLimit: number; // seconds
}

function createWaves(): WaveConfig[] {
  const waves: WaveConfig[] = [];

  // Wave 1-3: Zombies only
  waves.push({ enemies: [{ type: 'goblin', count: 8, delay: 800 }], reward: 20, timeLimit: 45 });
  waves.push({ enemies: [{ type: 'goblin', count: 12, delay: 700 }], reward: 25, timeLimit: 50 });
  waves.push({ enemies: [{ type: 'goblin', count: 15, delay: 600 }], reward: 30, timeLimit: 55 });

  // Wave 4-6: + Armored
  waves.push({ enemies: [{ type: 'goblin', count: 10, delay: 700 }, { type: 'orc', count: 4, delay: 1200 }], reward: 40, timeLimit: 55 });
  waves.push({ enemies: [{ type: 'orc', count: 8, delay: 1000 }, { type: 'goblin', count: 8, delay: 600 }], reward: 50, timeLimit: 60 });
  waves.push({ enemies: [{ type: 'goblin', count: 15, delay: 500 }, { type: 'orc', count: 6, delay: 900 }], reward: 55, timeLimit: 60 });

  // Wave 7-9: + Giants
  waves.push({ enemies: [{ type: 'orc', count: 10, delay: 800 }, { type: 'troll', count: 3, delay: 1500 }], reward: 60, timeLimit: 65 });
  waves.push({ enemies: [{ type: 'goblin', count: 12, delay: 500 }, { type: 'orc', count: 8, delay: 800 }, { type: 'troll', count: 4, delay: 1300 }], reward: 70, timeLimit: 70 });
  waves.push({ enemies: [{ type: 'troll', count: 6, delay: 1200 }, { type: 'orc', count: 10, delay: 700 }], reward: 80, timeLimit: 70 });

  // Wave 10: First boss
  waves.push({ enemies: [{ type: 'orc', count: 12, delay: 600 }, { type: 'troll', count: 5, delay: 1000 }, { type: 'boss', count: 1, delay: 2000 }], reward: 150, timeLimit: 80 });

  // Wave 11-14: + Ghosts
  waves.push({ enemies: [{ type: 'dragon', count: 4, delay: 1200 }, { type: 'orc', count: 10, delay: 700 }], reward: 90, timeLimit: 70 });
  waves.push({ enemies: [{ type: 'dragon', count: 6, delay: 1000 }, { type: 'troll', count: 5, delay: 1100 }, { type: 'goblin', count: 15, delay: 400 }], reward: 100, timeLimit: 75 });
  waves.push({ enemies: [{ type: 'troll', count: 8, delay: 900 }, { type: 'dragon', count: 8, delay: 800 }], reward: 110, timeLimit: 75 });
  waves.push({ enemies: [{ type: 'dragon', count: 10, delay: 700 }, { type: 'orc', count: 15, delay: 500 }, { type: 'troll', count: 6, delay: 1000 }], reward: 120, timeLimit: 80 });

  // Wave 15: Double boss
  waves.push({ enemies: [{ type: 'troll', count: 8, delay: 800 }, { type: 'dragon', count: 6, delay: 900 }, { type: 'boss', count: 2, delay: 3000 }], reward: 250, timeLimit: 90 });

  // Wave 16-19: Escalation
  for (let i = 0; i < 4; i++) {
    const m = 1 + i * 0.3;
    waves.push({
      enemies: [
        { type: 'goblin', count: Math.floor(20 * m), delay: Math.max(300, 500 - i * 50) },
        { type: 'orc', count: Math.floor(12 * m), delay: Math.max(400, 700 - i * 50) },
        { type: 'troll', count: Math.floor(6 * m), delay: Math.max(600, 1000 - i * 100) },
        { type: 'dragon', count: Math.floor(5 * m), delay: Math.max(500, 800 - i * 50) },
      ],
      reward: 130 + i * 20, timeLimit: 85 + i * 5,
    });
  }

  // Wave 20: Final boss
  waves.push({ enemies: [{ type: 'dragon', count: 12, delay: 600 }, { type: 'troll', count: 10, delay: 700 }, { type: 'boss', count: 3, delay: 2500 }], reward: 500, timeLimit: 120 });

  return waves;
}

export const WAVES = createWaves();
export const TOTAL_WAVES = WAVES.length;
