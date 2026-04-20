export interface WaveEnemy {
  type: string;
  count: number;
  delay: number; // ms between spawns
}

export interface WaveConfig {
  enemies: WaveEnemy[];
  reward: number; // bonus gold for completing wave
}

function createWaves(): WaveConfig[] {
  const waves: WaveConfig[] = [];

  // Wave 1-3: Goblins only
  waves.push({
    enemies: [{ type: 'goblin', count: 8, delay: 800 }],
    reward: 20,
  });
  waves.push({
    enemies: [{ type: 'goblin', count: 12, delay: 700 }],
    reward: 25,
  });
  waves.push({
    enemies: [{ type: 'goblin', count: 15, delay: 600 }],
    reward: 30,
  });

  // Wave 4-6: Goblins + Orcs
  waves.push({
    enemies: [
      { type: 'goblin', count: 10, delay: 700 },
      { type: 'orc', count: 4, delay: 1200 },
    ],
    reward: 40,
  });
  waves.push({
    enemies: [
      { type: 'orc', count: 8, delay: 1000 },
      { type: 'goblin', count: 8, delay: 600 },
    ],
    reward: 50,
  });
  waves.push({
    enemies: [
      { type: 'goblin', count: 15, delay: 500 },
      { type: 'orc', count: 6, delay: 900 },
    ],
    reward: 55,
  });

  // Wave 7-9: + Trolls
  waves.push({
    enemies: [
      { type: 'orc', count: 10, delay: 800 },
      { type: 'troll', count: 3, delay: 1500 },
    ],
    reward: 60,
  });
  waves.push({
    enemies: [
      { type: 'goblin', count: 12, delay: 500 },
      { type: 'orc', count: 8, delay: 800 },
      { type: 'troll', count: 4, delay: 1300 },
    ],
    reward: 70,
  });
  waves.push({
    enemies: [
      { type: 'troll', count: 6, delay: 1200 },
      { type: 'orc', count: 10, delay: 700 },
    ],
    reward: 80,
  });

  // Wave 10: First boss
  waves.push({
    enemies: [
      { type: 'orc', count: 12, delay: 600 },
      { type: 'troll', count: 5, delay: 1000 },
      { type: 'boss', count: 1, delay: 2000 },
    ],
    reward: 150,
  });

  // Wave 11-14: + Dragons
  waves.push({
    enemies: [
      { type: 'dragon', count: 4, delay: 1200 },
      { type: 'orc', count: 10, delay: 700 },
    ],
    reward: 90,
  });
  waves.push({
    enemies: [
      { type: 'dragon', count: 6, delay: 1000 },
      { type: 'troll', count: 5, delay: 1100 },
      { type: 'goblin', count: 15, delay: 400 },
    ],
    reward: 100,
  });
  waves.push({
    enemies: [
      { type: 'troll', count: 8, delay: 900 },
      { type: 'dragon', count: 8, delay: 800 },
    ],
    reward: 110,
  });
  waves.push({
    enemies: [
      { type: 'dragon', count: 10, delay: 700 },
      { type: 'orc', count: 15, delay: 500 },
      { type: 'troll', count: 6, delay: 1000 },
    ],
    reward: 120,
  });

  // Wave 15: Double boss
  waves.push({
    enemies: [
      { type: 'troll', count: 8, delay: 800 },
      { type: 'dragon', count: 6, delay: 900 },
      { type: 'boss', count: 2, delay: 3000 },
    ],
    reward: 250,
  });

  // Wave 16-19: Escalation
  for (let i = 0; i < 4; i++) {
    const mult = 1 + i * 0.3;
    waves.push({
      enemies: [
        { type: 'goblin', count: Math.floor(20 * mult), delay: Math.max(300, 500 - i * 50) },
        { type: 'orc', count: Math.floor(12 * mult), delay: Math.max(400, 700 - i * 50) },
        { type: 'troll', count: Math.floor(6 * mult), delay: Math.max(600, 1000 - i * 100) },
        { type: 'dragon', count: Math.floor(5 * mult), delay: Math.max(500, 800 - i * 50) },
      ],
      reward: 130 + i * 20,
    });
  }

  // Wave 20: Final boss wave
  waves.push({
    enemies: [
      { type: 'dragon', count: 12, delay: 600 },
      { type: 'troll', count: 10, delay: 700 },
      { type: 'boss', count: 3, delay: 2500 },
    ],
    reward: 500,
  });

  return waves;
}

export const WAVES = createWaves();
export const TOTAL_WAVES = WAVES.length;
