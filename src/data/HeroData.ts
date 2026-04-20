// Penguin Hero data for merge defense

export interface HeroTypeConfig {
  type: string;
  nameKo: string;
  baseDamage: number;
  baseRange: number;
  baseFireRate: number;
  projectileSpeed: number;
  color: number;
  projectileColor: number;
  splash: boolean;
  splashRadius: number;
  slow: number;
  slowDuration: number;
  chain: number;
  description: string;
}

export const HERO_TYPES: string[] = ['archer', 'warrior', 'mage', 'ice', 'thunder'];

export const HERO_DATA: Record<string, HeroTypeConfig> = {
  archer: {
    type: 'archer',
    nameKo: '궁수펭',
    baseDamage: 12,
    baseRange: 120,
    baseFireRate: 1.8,
    projectileSpeed: 350,
    color: 0xff9800,
    projectileColor: 0xffcc80,
    splash: false,
    splashRadius: 0,
    slow: 0,
    slowDuration: 0,
    chain: 0,
    description: '빠른 공격, 단일 대상',
  },
  warrior: {
    type: 'warrior',
    nameKo: '전사펭',
    baseDamage: 22,
    baseRange: 65,
    baseFireRate: 1.3,
    projectileSpeed: 450,
    color: 0xf44336,
    projectileColor: 0xff8a80,
    splash: false,
    splashRadius: 0,
    slow: 0,
    slowDuration: 0,
    chain: 0,
    description: '근접 고데미지',
  },
  mage: {
    type: 'mage',
    nameKo: '마법펭',
    baseDamage: 18,
    baseRange: 110,
    baseFireRate: 0.8,
    projectileSpeed: 250,
    color: 0x9c27b0,
    projectileColor: 0xce93d8,
    splash: true,
    splashRadius: 55,
    slow: 0,
    slowDuration: 0,
    chain: 0,
    description: '범위 마법 공격',
  },
  ice: {
    type: 'ice',
    nameKo: '얼음펭',
    baseDamage: 8,
    baseRange: 100,
    baseFireRate: 1.0,
    projectileSpeed: 280,
    color: 0x03a9f4,
    projectileColor: 0x81d4fa,
    splash: false,
    splashRadius: 0,
    slow: 0.35,
    slowDuration: 2000,
    chain: 0,
    description: '적을 감속시킴',
  },
  thunder: {
    type: 'thunder',
    nameKo: '번개펭',
    baseDamage: 15,
    baseRange: 105,
    baseFireRate: 0.7,
    projectileSpeed: 500,
    color: 0xffeb3b,
    projectileColor: 0xfff176,
    splash: false,
    splashRadius: 0,
    slow: 0,
    slowDuration: 0,
    chain: 2,
    description: '연쇄 번개 공격',
  },
};

// Tier system
export const TIER_NAMES = ['일반', '정예', '희귀', '전설', '신화'];
export const TIER_COLORS: number[] = [0x9e9e9e, 0x4caf50, 0x2196f3, 0x9c27b0, 0xffa000];
export const MAX_TIER = 5;

const TIER_MULTIPLIERS = [1, 2.5, 6, 15, 40];

export function getTierMultiplier(tier: number): number {
  return TIER_MULTIPLIERS[tier - 1] || 1;
}

export function getHeroDamage(type: string, tier: number): number {
  return Math.floor(HERO_DATA[type].baseDamage * getTierMultiplier(tier));
}

export function getHeroRange(type: string, tier: number): number {
  return HERO_DATA[type].baseRange + (tier - 1) * 10;
}

export function getHeroFireRate(type: string, tier: number): number {
  return HERO_DATA[type].baseFireRate + (tier - 1) * 0.12;
}

// Summon system
export const BASE_SUMMON_COST = 30;
export const SUMMON_COST_INCREMENT = 3;
export const MAX_SUMMON_LEVEL = 4;
export const SUMMON_UPGRADE_COSTS = [100, 250, 500];

export function getSummonProbabilities(level: number): number[] {
  switch (level) {
    case 1: return [0.80, 0.15, 0.05, 0, 0];
    case 2: return [0.50, 0.35, 0.12, 0.03, 0];
    case 3: return [0.20, 0.35, 0.30, 0.12, 0.03];
    case 4: return [0.05, 0.20, 0.35, 0.30, 0.10];
    default: return [1, 0, 0, 0, 0];
  }
}

export function rollSummonTier(level: number): number {
  const probs = getSummonProbabilities(level);
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (roll < cumulative) return i + 1;
  }
  return 1;
}

export function rollSummonType(): string {
  return HERO_TYPES[Math.floor(Math.random() * HERO_TYPES.length)];
}

export function getHeroSellValue(tier: number): number {
  return Math.floor(BASE_SUMMON_COST * getTierMultiplier(tier) * 0.4);
}
