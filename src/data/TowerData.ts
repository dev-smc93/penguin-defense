export interface SkillConfig {
  nameKo: string;
  type: 'volley' | 'earthquake' | 'meteor' | 'blizzard' | 'chain_lightning';
  cooldown: number;
  damage: number;
  radius: number;
  duration?: number;
}

export interface TowerConfig {
  id: string;
  nameKo: string;
  description: string;
  baseDamage: number;
  baseRange: number;
  baseFireRate: number;
  projectileSpeed: number;
  color: number;
  splash?: boolean;
  slow?: number;
  chain?: number;
  skill: SkillConfig;
}

export const TOWER_TYPES: Record<string, TowerConfig> = {
  archer: {
    id: 'archer', nameKo: '궁수탑', description: '빠른 연사, 정밀 사격',
    baseDamage: 12, baseRange: 55, baseFireRate: 1.8, projectileSpeed: 280,
    color: 0xff8f00,
    skill: { nameKo: '화살 폭풍', type: 'volley', cooldown: 18, damage: 8, radius: 55 },
  },
  warrior: {
    id: 'warrior', nameKo: '전사탑', description: '강력한 범위 공격',
    baseDamage: 25, baseRange: 40, baseFireRate: 0.8, projectileSpeed: 200,
    color: 0xd32f2f, splash: true,
    skill: { nameKo: '지진', type: 'earthquake', cooldown: 25, damage: 60, radius: 70, duration: 1.5 },
  },
  mage: {
    id: 'mage', nameKo: '마법탑', description: '마법 스플래시 데미지',
    baseDamage: 18, baseRange: 50, baseFireRate: 1.0, projectileSpeed: 220,
    color: 0x7b1fa2, splash: true,
    skill: { nameKo: '메테오', type: 'meteor', cooldown: 28, damage: 45, radius: 80 },
  },
  ice: {
    id: 'ice', nameKo: '얼음탑', description: '적 이동속도 감소',
    baseDamage: 8, baseRange: 50, baseFireRate: 1.2, projectileSpeed: 240,
    color: 0x00bcd4, slow: 0.4,
    skill: { nameKo: '블리자드', type: 'blizzard', cooldown: 32, damage: 15, radius: 999, duration: 3 },
  },
  thunder: {
    id: 'thunder', nameKo: '번개탑', description: '연쇄 번개 공격',
    baseDamage: 15, baseRange: 48, baseFireRate: 1.1, projectileSpeed: 350,
    color: 0xfdd835, chain: 3,
    skill: { nameKo: '천둥벼락', type: 'chain_lightning', cooldown: 26, damage: 35, radius: 999 },
  },
};

export const TIER_NAMES = ['일반', '정예', '희귀', '전설', '신화'];
export const TIER_COLORS = [0x90a4ae, 0x4fc3f7, 0xab47bc, 0xffa726, 0xff1744];
export const TIER_MULTIPLIERS = [1, 2.5, 6, 15, 40];
export const MAX_TIER = 5;
export const SKILL_MIN_TIER = 3;

export const SUMMON_COST_BASE = 30;
export const SUMMON_COST_INC = 3;
export const MAX_SUMMON_LEVEL = 4;
export const SUMMON_UPGRADE_COSTS = [150, 400, 800];

export function getSummonProbabilities(level: number): number[] {
  const probs = [
    [0.70, 0.25, 0.05, 0, 0],
    [0.50, 0.35, 0.12, 0.03, 0],
    [0.30, 0.35, 0.25, 0.08, 0.02],
    [0.15, 0.30, 0.30, 0.18, 0.07],
  ];
  return probs[Math.min(level, probs.length) - 1];
}

export function rollSummonTier(level: number): number {
  const probs = getSummonProbabilities(level);
  let r = Math.random(), cum = 0;
  for (let i = 0; i < probs.length; i++) { cum += probs[i]; if (r < cum) return i + 1; }
  return 1;
}

export function rollSummonType(): string {
  const types = Object.keys(TOWER_TYPES);
  return types[Math.floor(Math.random() * types.length)];
}

export function getTowerDamage(type: string, tier: number): number {
  return Math.floor(TOWER_TYPES[type].baseDamage * TIER_MULTIPLIERS[tier - 1]);
}
export function getTowerRange(type: string, tier: number): number {
  return TOWER_TYPES[type].baseRange + (tier - 1) * 5;
}
export function getTowerFireRate(type: string, tier: number): number {
  return TOWER_TYPES[type].baseFireRate * (1 + (tier - 1) * 0.15);
}
export function getTowerSellValue(tier: number): number {
  return [10, 25, 75, 200, 500][tier - 1] || 10;
}
