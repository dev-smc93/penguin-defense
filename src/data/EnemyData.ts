export interface EnemyStats {
  name: string;
  nameKo: string;
  hp: number;
  speed: number;
  reward: number;
  color: number;
  size: number;
  armor: number;
  flying: boolean;
}

export const ENEMY_DATA: Record<string, EnemyStats> = {
  goblin: {
    name: 'Zombie',
    nameKo: '좀비',
    hp: 60,
    speed: 80,
    reward: 10,
    color: 0x66bb6a,
    size: 8,
    armor: 0,
    flying: false,
  },
  orc: {
    name: 'Armored Zombie',
    nameKo: '갑옷 좀비',
    hp: 150,
    speed: 55,
    reward: 20,
    color: 0x546e7a,
    size: 11,
    armor: 3,
    flying: false,
  },
  troll: {
    name: 'Giant Zombie',
    nameKo: '거대 좀비',
    hp: 350,
    speed: 35,
    reward: 40,
    color: 0x5d4037,
    size: 14,
    armor: 8,
    flying: false,
  },
  dragon: {
    name: 'Ghost',
    nameKo: '유령',
    hp: 200,
    speed: 90,
    reward: 50,
    color: 0xb39ddb,
    size: 12,
    armor: 5,
    flying: true,
  },
  boss: {
    name: 'Zombie King',
    nameKo: '좀비 킹',
    hp: 1500,
    speed: 25,
    reward: 150,
    color: 0xd32f2f,
    size: 18,
    armor: 15,
    flying: false,
  },
};
