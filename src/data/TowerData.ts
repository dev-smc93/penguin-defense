export interface TowerStats {
  name: string;
  nameKo: string;
  cost: number;
  damage: number;
  range: number;
  fireRate: number; // shots per second
  color: number;
  projectileColor: number;
  projectileSpeed: number;
  splash: boolean;
  splashRadius: number;
  slow: number; // 0-1, percentage slow
  slowDuration: number; // ms
  chain: number; // number of chain targets
  upgradeCost: number[];
  damagePerLevel: number;
  rangePerLevel: number;
  fireRatePerLevel: number;
  description: string;
}

export const TOWER_DATA: Record<string, TowerStats> = {
  archer: {
    name: 'Archer',
    nameKo: '궁수탑',
    cost: 50,
    damage: 15,
    range: 120,
    fireRate: 1.5,
    color: 0x4caf50,
    projectileColor: 0xcddc39,
    projectileSpeed: 400,
    splash: false,
    splashRadius: 0,
    slow: 0,
    slowDuration: 0,
    chain: 0,
    upgradeCost: [40, 80, 150],
    damagePerLevel: 8,
    rangePerLevel: 10,
    fireRatePerLevel: 0.3,
    description: '빠른 공격속도, 단일 대상',
  },
  cannon: {
    name: 'Cannon',
    nameKo: '캐논탑',
    cost: 80,
    damage: 40,
    range: 100,
    fireRate: 0.6,
    color: 0xf44336,
    projectileColor: 0xff5722,
    projectileSpeed: 250,
    splash: true,
    splashRadius: 50,
    slow: 0,
    slowDuration: 0,
    chain: 0,
    upgradeCost: [60, 120, 200],
    damagePerLevel: 20,
    rangePerLevel: 8,
    fireRatePerLevel: 0.1,
    description: '범위 공격, 느린 속도',
  },
  ice: {
    name: 'Ice',
    nameKo: '아이스탑',
    cost: 60,
    damage: 8,
    range: 110,
    fireRate: 1.0,
    color: 0x03a9f4,
    projectileColor: 0x81d4fa,
    projectileSpeed: 350,
    splash: false,
    splashRadius: 0,
    slow: 0.4,
    slowDuration: 2000,
    chain: 0,
    upgradeCost: [50, 100, 180],
    damagePerLevel: 5,
    rangePerLevel: 10,
    fireRatePerLevel: 0.2,
    description: '적을 감속시킴',
  },
  lightning: {
    name: 'Lightning',
    nameKo: '번개탑',
    cost: 100,
    damage: 25,
    range: 130,
    fireRate: 0.8,
    color: 0xffeb3b,
    projectileColor: 0xfff176,
    projectileSpeed: 600,
    splash: false,
    splashRadius: 0,
    slow: 0,
    slowDuration: 0,
    chain: 3,
    upgradeCost: [80, 150, 250],
    damagePerLevel: 12,
    rangePerLevel: 10,
    fireRatePerLevel: 0.15,
    description: '연쇄 번개, 다중 대상',
  },
};

export const TOWER_TYPES = Object.keys(TOWER_DATA);
