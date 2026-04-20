import * as THREE from 'three';
import { TOWER_TYPES, TowerConfig, TIER_COLORS, TIER_NAMES, TIER_MULTIPLIERS, MAX_TIER, SKILL_MIN_TIER,
  SUMMON_COST_BASE, SUMMON_COST_INC, MAX_SUMMON_LEVEL, SUMMON_UPGRADE_COSTS,
  rollSummonTier, rollSummonType, getTowerDamage, getTowerRange, getTowerFireRate, getTowerSellValue } from '../data/TowerData';
import { ENEMY_DATA, EnemyStats } from '../data/EnemyData';
import { WAVES, TOTAL_WAVES, WaveConfig } from '../data/WaveData';
import { playClick, playPlaceTower, playSell, playMerge, playSummon, playShoot,
  playEnemyHit, playEnemyDeath, playBossDeath, playExplosion, playGoldPickup,
  playLifeLost, playWaveStart, playWaveClear, playVictory, playDefeat,
  playSkill, startBGM, stopBGM } from '../utils/SoundManager';
import { UI } from '../ui/UI';

// ============ CONSTANTS ============
const MAP_RADIUS = 130;
const INNER_RADIUS = 12;
const SPIRAL_TURNS = 2;
const PATH_POINTS = 250;
const SLOT_RINGS = [{ r: 105, count: 12 }, { r: 72, count: 10 }, { r: 42, count: 8 }];
const INITIAL_GOLD = 200;
const INITIAL_LIVES = 20;

// ============ PATH GENERATION ============
function generateSpiralPath(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= PATH_POINTS; i++) {
    const t = i / PATH_POINTS;
    const angle = t * SPIRAL_TURNS * Math.PI * 2;
    const r = MAP_RADIUS - (MAP_RADIUS - INNER_RADIUS) * t;
    pts.push(new THREE.Vector3(r * Math.cos(angle), 0.3, r * Math.sin(angle)));
  }
  return pts;
}

function getPathLength(path: THREE.Vector3[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
  return len;
}

function getPositionOnPath(path: THREE.Vector3[], dist: number): { pos: THREE.Vector3; dir: THREE.Vector3 } {
  let remaining = dist;
  for (let i = 1; i < path.length; i++) {
    const segLen = path[i].distanceTo(path[i - 1]);
    if (remaining <= segLen) {
      const t = remaining / segLen;
      const pos = path[i - 1].clone().lerp(path[i], t);
      const dir = path[i].clone().sub(path[i - 1]).normalize();
      return { pos, dir };
    }
    remaining -= segLen;
  }
  return { pos: path[path.length - 1].clone(), dir: new THREE.Vector3(0, 0, -1) };
}

// ============ TOWER SLOT ============
interface TowerSlot {
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  occupied: boolean;
  tower: TowerEntity | null;
}

// ============ TOWER ENTITY ============
class TowerEntity {
  group: THREE.Group;
  type: string;
  config: TowerConfig;
  tier: number;
  slot: TowerSlot;
  fireTimer = 0;
  skillCooldown = 0;
  private auraPhase = Math.random() * Math.PI * 2;
  private auraMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, type: string, tier: number, slot: TowerSlot) {
    this.type = type;
    this.config = TOWER_TYPES[type];
    this.tier = tier;
    this.slot = slot;
    this.group = new THREE.Group();
    this.group.position.copy(slot.position);
    this.buildMesh();
    scene.add(this.group);
  }

  private buildMesh(): void {
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    }
    this.auraMesh = null;
    const col = this.config.color;
    const emI = Math.min(1, (this.tier - 1) * 0.18);
    const baseH = 3 + this.tier * 1.2;
    const ts = 1 + this.tier * 0.08; // tier scale

    // Ice-stone base platform (all towers)
    const platMat = new THREE.MeshStandardMaterial({ color: 0x3e5c78, roughness: 0.7, metalness: 0.2 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * ts, 4.8 * ts, 1.2, 8), platMat);
    plat.position.y = 0.6;
    plat.castShadow = true;
    this.group.add(plat);

    if (this.type === 'archer') {
      // ICE CROSSBOW TOWER - matching asset tower #8 (ballista)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x5d8aa8, emissive: col, emissiveIntensity: emI, roughness: 0.5, metalness: 0.3 });
      // Tower body: tapered stone cylinder
      const body = new THREE.Mesh(new THREE.CylinderGeometry(3 * ts, 3.8 * ts, baseH, 6), wallMat);
      body.position.y = 1.2 + baseH / 2;
      body.castShadow = true;
      this.group.add(body);
      // Crossbow arm (horizontal bar)
      const armMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 });
      const arm = new THREE.Mesh(new THREE.BoxGeometry(8 * ts, 0.6, 0.8), armMat);
      arm.position.y = 1.2 + baseH + 0.5;
      arm.castShadow = true;
      this.group.add(arm);
      // Crossbow bolt (pointed cylinder)
      const boltMat = new THREE.MeshStandardMaterial({ color: 0x80deea, emissive: 0x29b6f6, emissiveIntensity: 0.4 });
      const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.3, 3, 4), boltMat);
      bolt.position.set(0, 1.2 + baseH + 0.5, 1.5);
      bolt.rotation.x = Math.PI / 2;
      this.group.add(bolt);
      // Conical roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5 * ts, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0xc68c53, roughness: 0.6 }));
      roof.position.y = 1.2 + baseH + 2.5;
      roof.castShadow = true;
      this.group.add(roof);
      // Viewing slit
      const slit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x000000 }));
      slit.position.set(0, 1.2 + baseH * 0.7, 3 * ts + 0.1);
      this.group.add(slit);

    } else if (this.type === 'warrior') {
      // FROST FORTRESS - matching asset tower #2 (fortified)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a9bb5, emissive: col, emissiveIntensity: emI, roughness: 0.5, metalness: 0.4 });
      // Main wall block
      const wall = new THREE.Mesh(new THREE.BoxGeometry(7 * ts, baseH, 7 * ts), wallMat);
      wall.position.y = 1.2 + baseH / 2;
      wall.castShadow = true;
      this.group.add(wall);
      // 4 corner turrets
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const r = 3.8 * ts;
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * ts, 1.5 * ts, baseH + 3, 6), wallMat.clone());
        turret.position.set(Math.cos(a) * r, 1.2 + (baseH + 3) / 2, Math.sin(a) * r);
        turret.castShadow = true;
        this.group.add(turret);
        // Turret cap
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8 * ts, 2, 6),
          new THREE.MeshStandardMaterial({ color: 0x9e3030, roughness: 0.5 }));
        cap.position.set(Math.cos(a) * r, 1.2 + baseH + 4, Math.sin(a) * r);
        this.group.add(cap);
      }
      // Battlements on top
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const bt = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1),
          new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.6 }));
        bt.position.set(Math.cos(a) * 3.2 * ts, 1.2 + baseH + 0.8, Math.sin(a) * 3.2 * ts);
        this.group.add(bt);
      }
      // Shield emblem (front)
      const shield = new THREE.Mesh(new THREE.CircleGeometry(1.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xd32f2f, emissive: 0xd32f2f, emissiveIntensity: 0.3, metalness: 0.6 }));
      shield.position.set(0, 1.2 + baseH * 0.6, 3.6 * ts);
      this.group.add(shield);

    } else if (this.type === 'mage') {
      // WIZARD TOWER - matching asset tower #3 (wizard hat, orb)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5c4a8a, emissive: col, emissiveIntensity: emI, roughness: 0.4, metalness: 0.2 });
      // Tapered tower body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.5 * ts, 3.5 * ts, baseH + 2, 8), stoneMat);
      body.position.y = 1.2 + (baseH + 2) / 2;
      body.castShadow = true;
      this.group.add(body);
      // Wizard hat top (large cone)
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x311b92, emissive: 0x4527a0, emissiveIntensity: 0.3, roughness: 0.5 });
      const hat = new THREE.Mesh(new THREE.ConeGeometry(4 * ts, 6 + this.tier, 8), hatMat);
      hat.position.y = 1.2 + baseH + 4 + this.tier * 0.3;
      hat.castShadow = true;
      this.group.add(hat);
      // Hat brim
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(4.5 * ts, 4.5 * ts, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x311b92, roughness: 0.5 }));
      brim.position.y = 1.2 + baseH + 1.5;
      this.group.add(brim);
      // Floating magic orb
      const orbMat = new THREE.MeshStandardMaterial({ color: 0xce93d8, emissive: 0xab47bc, emissiveIntensity: 0.6 + this.tier * 0.2, transparent: true, opacity: 0.85 });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(1.2 + this.tier * 0.25, 12, 12), orbMat);
      orb.position.set(0, 1.2 + baseH * 0.6, 3.5 * ts);
      this.group.add(orb);
      // Rune ring around orb
      const runeMat = new THREE.MeshBasicMaterial({ color: 0xab47bc, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const rune = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.2, 16), runeMat);
      rune.position.copy(orb.position);
      rune.rotation.x = -Math.PI / 2;
      this.group.add(rune);
      // Window slits with glow
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5),
          new THREE.MeshBasicMaterial({ color: 0xce93d8 }));
        win.position.set(Math.cos(a) * 2.6 * ts, 1.2 + baseH * 0.5, Math.sin(a) * 2.6 * ts);
        win.lookAt(0, win.position.y, 0);
        this.group.add(win);
      }

    } else if (this.type === 'ice') {
      // CRYSTAL SPIRE - matching asset tower #1 (ice crystal tower)
      const crystMat = new THREE.MeshStandardMaterial({ color: 0x80deea, emissive: 0x00bcd4, emissiveIntensity: 0.35 + this.tier * 0.15, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.1 });
      // Frozen base
      const frozenBase = new THREE.Mesh(new THREE.CylinderGeometry(3.5 * ts, 4 * ts, 2, 6),
        new THREE.MeshStandardMaterial({ color: 0xb2ebf2, roughness: 0.3, metalness: 0.1 }));
      frozenBase.position.y = 1.2 + 1;
      frozenBase.castShadow = true;
      this.group.add(frozenBase);
      // Main crystal (tall octahedron)
      const mainCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.5 * ts, 0), crystMat);
      mainCrystal.position.y = 1.2 + baseH + 2;
      mainCrystal.scale.y = 2;
      mainCrystal.castShadow = true;
      this.group.add(mainCrystal);
      // Surrounding smaller crystals
      const smallCount = 3 + Math.floor(this.tier / 2);
      for (let i = 0; i < smallCount; i++) {
        const a = (i / smallCount) * Math.PI * 2;
        const r = 2.5 * ts;
        const h = 2 + Math.random() * 3 + this.tier * 0.5;
        const sc = new THREE.Mesh(new THREE.OctahedronGeometry(0.8 + Math.random() * 0.5, 0), crystMat.clone());
        sc.position.set(Math.cos(a) * r, 1.2 + h, Math.sin(a) * r);
        sc.scale.y = 1.5 + Math.random();
        sc.rotation.y = Math.random() * Math.PI;
        sc.rotation.z = (Math.random() - 0.5) * 0.3;
        this.group.add(sc);
      }
      // Ice mist ring at base
      const mistMat = new THREE.MeshBasicMaterial({ color: 0xb2ebf2, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
      const mist = new THREE.Mesh(new THREE.RingGeometry(3, 5.5 * ts, 20), mistMat);
      mist.rotation.x = -Math.PI / 2;
      mist.position.y = 1.5;
      this.group.add(mist);

    } else if (this.type === 'thunder') {
      // STORM PILLAR - matching asset thunder bolt style
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, emissive: col, emissiveIntensity: emI, roughness: 0.4, metalness: 0.5 });
      // Stone pillar
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2 * ts, 3 * ts, baseH + 2, 6), pillarMat);
      pillar.position.y = 1.2 + (baseH + 2) / 2;
      pillar.castShadow = true;
      this.group.add(pillar);
      // Lightning rod (thin tall spike)
      const rodMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, emissive: 0xfdd835, emissiveIntensity: 0.5 + this.tier * 0.2, metalness: 0.8 });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 5 + this.tier, 4), rodMat);
      rod.position.y = 1.2 + baseH + 4 + this.tier * 0.3;
      this.group.add(rod);
      // Coil rings at multiple heights
      const coilCount = 2 + Math.floor(this.tier / 2);
      for (let i = 0; i < coilCount; i++) {
        const coilY = 1.2 + 2 + i * (baseH / coilCount);
        const coil = new THREE.Mesh(new THREE.TorusGeometry(2.5 * ts, 0.25 + this.tier * 0.05, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xfdd835, emissive: 0xfbc02d, emissiveIntensity: 0.4 + this.tier * 0.15 }));
        coil.position.y = coilY;
        coil.rotation.x = Math.PI / 2;
        this.group.add(coil);
      }
      // Spark orb at top
      const sparkMat = new THREE.MeshStandardMaterial({ color: 0xfff59d, emissive: 0xfdd835, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 });
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.8 + this.tier * 0.2, 8, 8), sparkMat);
      spark.position.y = 1.2 + baseH + 7 + this.tier * 0.5;
      this.group.add(spark);
      // Electric arc lines (simple cylinders)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 3),
          new THREE.MeshBasicMaterial({ color: 0xfdd835 }));
        arc.position.set(Math.cos(a) * 1.5, 1.2 + baseH + 3, Math.sin(a) * 1.5);
        arc.rotation.z = (Math.random() - 0.5) * 0.8;
        this.group.add(arc);
      }
    }

    // Tier 3+ aura ring (enhanced)
    if (this.tier >= SKILL_MIN_TIER) {
      const auraMat = new THREE.MeshBasicMaterial({ color: TIER_COLORS[this.tier - 1], transparent: true, opacity: 0.25, side: THREE.DoubleSide });
      this.auraMesh = new THREE.Mesh(new THREE.RingGeometry(5, 7.5, 32), auraMat);
      this.auraMesh.rotation.x = -Math.PI / 2;
      this.auraMesh.position.y = 0.5;
      this.group.add(this.auraMesh);
      // Inner aura glow
      const innerAura = new THREE.Mesh(new THREE.RingGeometry(3, 5, 32),
        new THREE.MeshBasicMaterial({ color: TIER_COLORS[this.tier - 1], transparent: true, opacity: 0.1, side: THREE.DoubleSide }));
      innerAura.rotation.x = -Math.PI / 2;
      innerAura.position.y = 0.6;
      this.group.add(innerAura);
    }

    // Tier 4+ crown
    if (this.tier >= 4) {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 1.8, 5), crownMat);
      const topY = this.type === 'warrior' ? 1.2 + baseH + 6 : this.type === 'mage' ? 1.2 + baseH + 6 + this.tier :
        this.type === 'ice' ? 1.2 + baseH + 6 : this.type === 'thunder' ? 1.2 + baseH + 8 + this.tier : 1.2 + baseH + 5;
      crown.position.y = topY;
      this.group.add(crown);
      // Crown jewel
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.5 }));
      jewel.position.y = topY + 1;
      this.group.add(jewel);
    }

    // Tier 5 mythic particle ring
    if (this.tier >= 5) {
      const mythicMat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      const mythicRing = new THREE.Mesh(new THREE.RingGeometry(6, 9, 32), mythicMat);
      mythicRing.rotation.x = -Math.PI / 2;
      mythicRing.position.y = 1;
      this.group.add(mythicRing);
    }
  }

  getDamage(): number { return getTowerDamage(this.type, this.tier); }
  getRange(): number { return getTowerRange(this.type, this.tier); }
  getFireRate(): number { return getTowerFireRate(this.type, this.tier); }
  getSellValue(): number { return getTowerSellValue(this.tier); }
  getKey(): string { return `${this.type}_${this.tier}`; }

  upgradeTier(): void {
    if (this.tier >= MAX_TIER) return;
    this.tier++;
    this.buildMesh();
  }

  update(delta: number, monsters: MonsterEntity[], projectiles: ProjectileEntity[], scene: THREE.Scene): void {
    this.fireTimer += delta;
    if (this.skillCooldown > 0) this.skillCooldown -= delta / 1000;
    // Aura animation
    if (this.auraMesh) {
      this.auraPhase += delta * 0.003;
      this.auraMesh.rotation.z += delta * 0.001;
      (this.auraMesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(this.auraPhase) * 0.08;
    }
    // Auto-attack
    const interval = 1000 / this.getFireRate();
    if (this.fireTimer < interval) return;
    const range = this.getRange();
    let bestTarget: MonsterEntity | null = null;
    let bestProgress = -1;
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const d = this.group.position.distanceTo(m.group.position);
      if (d <= range && m.distanceTraveled > bestProgress) {
        bestProgress = m.distanceTraveled;
        bestTarget = m;
      }
    }
    if (!bestTarget) return;
    this.fireTimer = 0;
    const proj = new ProjectileEntity(scene, this.group.position.clone().add(new THREE.Vector3(0, 6, 0)),
      bestTarget, this.getDamage(), this.config);
    projectiles.push(proj);
    const shootType = this.type === 'warrior' ? 'cannon' : this.type === 'thunder' ? 'lightning' : this.type;
    playShoot(shootType);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } });
  }
}

// ============ MONSTER ENTITY ============
class MonsterEntity {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  type: string;
  stats: EnemyStats;
  hp: number;
  maxHp: number;
  speed: number;
  distanceTraveled = 0;
  slowTimer = 0;
  slowFactor = 1;
  alive = true;
  private animPhase: number;
  private hpBarGroup: THREE.Group;
  private hpBar: THREE.Mesh;
  private hpBarBg: THREE.Mesh;
  private selfLight: THREE.PointLight;
  private leftArm: THREE.Object3D | null = null;
  private rightArm: THREE.Object3D | null = null;
  private leftLeg: THREE.Object3D | null = null;
  private rightLeg: THREE.Object3D | null = null;
  private baseArmLZ = 0;
  private baseArmRZ = 0;

  constructor(scene: THREE.Scene, type: string, path: THREE.Vector3[]) {
    this.type = type;
    this.stats = ENEMY_DATA[type];
    this.hp = this.stats.hp;
    this.maxHp = this.stats.hp;
    this.speed = this.stats.speed;
    this.animPhase = Math.random() * Math.PI * 2;
    this.group = new THREE.Group();
    this.group.position.copy(path[0]);

    // Body container (for bobbing motion)
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);
    this.buildMesh();

    // Self-illumination light
    const lightColor = type === 'boss' ? 0xff4444 : type === 'dragon' ? 0xb388ff :
      type === 'troll' ? 0xffd54f : type === 'orc' ? 0x64b5f6 : 0x81c784;
    this.selfLight = new THREE.PointLight(lightColor, 0.8, 25);
    const s = this.stats.size * 0.3;
    this.selfLight.position.y = s * 1.5;
    this.group.add(this.selfLight);

    // Shadow disc on ground
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(s * 1.2, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.15;
    this.group.add(shadowDisc);

    // HP bar group (billboarded)
    const barW = 8;
    const barH = 1.4;
    const barY = s * 3.2 + 3;
    this.hpBarGroup = new THREE.Group();
    this.hpBarGroup.position.y = barY;

    // Border
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(barW + 1, barH + 0.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 })
    );
    border.position.z = -0.02;
    this.hpBarGroup.add(border);

    // Background
    this.hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, barH),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
    );
    this.hpBarBg.position.z = -0.01;
    this.hpBarGroup.add(this.hpBarBg);

    // Fill bar
    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(barW, barH),
      new THREE.MeshBasicMaterial({ color: 0x4caf50 })
    );
    this.hpBarGroup.add(this.hpBar);

    this.group.add(this.hpBarGroup);

    scene.add(this.group);
  }

  private buildMesh(): void {
    const s = this.stats.size * 0.3;

    if (this.type === 'goblin') {
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, emissive: 0x2e7d32, emissiveIntensity: 0.25, roughness: 0.6 });
      // Body
      const body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.8, 10, 8), skinMat);
      body.position.y = s * 0.9;
      body.scale.y = 1.1;
      body.castShadow = true;
      this.bodyGroup.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.55, 10, 8), skinMat);
      head.position.y = s * 1.8;
      this.bodyGroup.add(head);
      // Ears
      const earMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, emissive: 0x1b5e20, emissiveIntensity: 0.15 });
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(s * 0.15, s * 0.5, 4), earMat);
        ear.position.set(side * s * 0.5, s * 2, 0);
        ear.rotation.z = side * 0.5;
        this.bodyGroup.add(ear);
      }
      // Eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.14, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
        eye.position.set(side * s * 0.22, s * 1.9, s * 0.45);
        this.bodyGroup.add(eye);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(s * 0.07, 4, 4),
          new THREE.MeshBasicMaterial({ color: 0x000000 }));
        pupil.position.set(side * s * 0.22, s * 1.9, s * 0.55);
        this.bodyGroup.add(pupil);
      }
      // Arms
      const lArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.1, s * 0.08, s * 0.8, 5), skinMat);
      lArm.position.set(-s * 0.7, s * 0.8, 0);
      this.baseArmLZ = -0.4;
      lArm.rotation.z = this.baseArmLZ;
      this.bodyGroup.add(lArm);
      this.leftArm = lArm;
      const rArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.1, s * 0.08, s * 0.8, 5), skinMat);
      rArm.position.set(s * 0.7, s * 0.8, 0);
      this.baseArmRZ = 0.4;
      rArm.rotation.z = this.baseArmRZ;
      this.bodyGroup.add(rArm);
      this.rightArm = rArm;
      // Legs
      const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.1, s * 0.5, 5), skinMat);
      lLeg.position.set(-s * 0.25, s * 0.25, 0);
      this.bodyGroup.add(lLeg);
      this.leftLeg = lLeg;
      const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.1, s * 0.5, 5), skinMat);
      rLeg.position.set(s * 0.25, s * 0.25, 0);
      this.bodyGroup.add(rLeg);
      this.rightLeg = rLeg;

    } else if (this.type === 'orc') {
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x4a6fa5, emissive: 0x1a47a0, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.2 });
      // Torso
      const torso = new THREE.Mesh(new THREE.SphereGeometry(s * 0.9, 10, 8), skinMat);
      torso.position.y = s;
      torso.scale.set(1, 1.1, 0.85);
      torso.castShadow = true;
      this.bodyGroup.add(torso);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.5, 10, 8), skinMat);
      head.position.y = s * 1.9;
      this.bodyGroup.add(head);
      // Horns
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x90caf9, emissive: 0x42a5f5, emissiveIntensity: 0.35, roughness: 0.3 });
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(s * 0.12, s * 0.7, 5), hornMat);
        horn.position.set(side * s * 0.35, s * 2.3, -s * 0.1);
        horn.rotation.z = side * 0.3;
        this.bodyGroup.add(horn);
      }
      // Eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.12, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xff1744 }));
        eye.position.set(side * s * 0.2, s * 2, s * 0.4);
        this.bodyGroup.add(eye);
      }
      // Armor
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.8, roughness: 0.2 });
      const chest = new THREE.Mesh(new THREE.BoxGeometry(s * 1.2, s * 0.7, s * 0.3), armorMat);
      chest.position.set(0, s, s * 0.6);
      this.bodyGroup.add(chest);
      for (const side of [-1, 1]) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 6, 6), armorMat);
        pad.position.set(side * s * 0.9, s * 1.4, 0);
        pad.scale.y = 0.6;
        this.bodyGroup.add(pad);
      }
      // Arms
      const lArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.1, s, 5), skinMat);
      lArm.position.set(-s * 0.85, s * 0.7, 0);
      this.baseArmLZ = -0.2;
      lArm.rotation.z = this.baseArmLZ;
      this.bodyGroup.add(lArm);
      this.leftArm = lArm;
      const rArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.1, s, 5), skinMat);
      rArm.position.set(s * 0.85, s * 0.7, 0);
      this.baseArmRZ = 0.2;
      rArm.rotation.z = this.baseArmRZ;
      this.bodyGroup.add(rArm);
      this.rightArm = rArm;

    } else if (this.type === 'troll') {
      const wrapMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, emissive: 0x4e342e, emissiveIntensity: 0.2, roughness: 0.8 });
      const bandageMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, emissive: 0xa1887f, emissiveIntensity: 0.15, roughness: 0.9 });
      // Body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.7, s * 0.8, s * 1.8, 8), wrapMat);
      body.position.y = s * 0.9;
      body.castShadow = true;
      this.bodyGroup.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.55, 8, 8), wrapMat);
      head.position.y = s * 2;
      this.bodyGroup.add(head);
      // Bandages
      for (let i = 0; i < 5; i++) {
        const wrap = new THREE.Mesh(new THREE.TorusGeometry(s * (0.75 - i * 0.03), 0.15, 4, 12), bandageMat);
        wrap.position.y = s * 0.3 + i * s * 0.35;
        wrap.rotation.x = Math.PI / 2;
        wrap.rotation.y = i * 0.3;
        this.bodyGroup.add(wrap);
      }
      // Eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.14, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffd54f }));
        eye.position.set(side * s * 0.2, s * 2.1, s * 0.45);
        this.bodyGroup.add(eye);
      }
      // Arms + fists
      const lArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.12, s * 1.2, 5), wrapMat);
      lArm.position.set(-s * 0.85, s * 0.8, 0);
      this.baseArmLZ = -0.3;
      lArm.rotation.z = this.baseArmLZ;
      this.bodyGroup.add(lArm);
      this.leftArm = lArm;
      const rArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.12, s * 1.2, 5), wrapMat);
      rArm.position.set(s * 0.85, s * 0.8, 0);
      this.baseArmRZ = 0.3;
      rArm.rotation.z = this.baseArmRZ;
      this.bodyGroup.add(rArm);
      this.rightArm = rArm;
      // Fists
      for (const side of [-1, 1]) {
        const fist = new THREE.Mesh(new THREE.SphereGeometry(s * 0.25, 6, 6), wrapMat);
        fist.position.set(side * s * 1.1, s * 0.2, 0);
        this.bodyGroup.add(fist);
      }

    } else if (this.type === 'dragon') {
      const ghostMat = new THREE.MeshStandardMaterial({
        color: 0xe8eaf6, emissive: 0x9575cd, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.55, roughness: 0.3, side: THREE.DoubleSide
      });
      // Body
      const bodyTop = new THREE.Mesh(new THREE.SphereGeometry(s * 0.8, 12, 8), ghostMat);
      bodyTop.position.y = s * 1.5;
      bodyTop.castShadow = true;
      this.bodyGroup.add(bodyTop);
      // Tail
      const tail = new THREE.Mesh(new THREE.ConeGeometry(s * 0.85, s * 1.5, 8), ghostMat.clone());
      tail.position.y = s * 0.5;
      tail.rotation.x = Math.PI;
      this.bodyGroup.add(tail);
      // Mouth
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(s * 0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.9 }));
      mouth.position.set(0, s * 1.3, s * 0.72);
      this.bodyGroup.add(mouth);
      // Eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.18, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0x000000 }));
        eye.position.set(side * s * 0.3, s * 1.7, s * 0.65);
        this.bodyGroup.add(eye);
      }
      // Inner glow
      const glow = new THREE.Mesh(new THREE.SphereGeometry(s * 1.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x7c4dff, transparent: true, opacity: 0.12 }));
      glow.position.y = s * 1.2;
      this.bodyGroup.add(glow);
      // Tendrils
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, s * 0.18, s * 1, 4),
          new THREE.MeshBasicMaterial({ color: 0xb39ddb, transparent: true, opacity: 0.35 }));
        wisp.position.set(Math.cos(a) * s * 0.5, s * 0.1, Math.sin(a) * s * 0.5);
        wisp.rotation.z = (Math.random() - 0.5) * 0.4;
        this.bodyGroup.add(wisp);
      }

    } else if (this.type === 'boss') {
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x2c0a0a, emissive: 0xb71c1c, emissiveIntensity: 0.45,
        roughness: 0.5, metalness: 0.3
      });
      // Body
      const body = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), darkMat);
      body.position.y = s;
      body.scale.set(1, 1.15, 0.9);
      body.castShadow = true;
      this.bodyGroup.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.6, 10, 8), darkMat);
      head.position.y = s * 2.1;
      this.bodyGroup.add(head);
      // Crown
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.1 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.5, s * 0.5, 6), crownMat);
      crown.position.y = s * 2.7;
      this.bodyGroup.add(crown);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(s * 0.1, s * 0.4, 4), crownMat);
        spike.position.set(Math.cos(a) * s * 0.35, s * 3, Math.sin(a) * s * 0.35);
        this.bodyGroup.add(spike);
      }
      // Eyes
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.18, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xff1744 }));
        eye.position.set(side * s * 0.25, s * 2.2, s * 0.5);
        this.bodyGroup.add(eye);
        const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.25 }));
        eyeGlow.position.copy(eye.position);
        this.bodyGroup.add(eyeGlow);
      }
      // Cape
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(s * 2, s * 2.5),
        new THREE.MeshStandardMaterial({ color: 0x4a0000, emissive: 0x330000, emissiveIntensity: 0.2, side: THREE.DoubleSide }));
      cape.position.set(0, s * 1.2, -s * 0.6);
      cape.rotation.x = 0.15;
      this.bodyGroup.add(cape);
      // Arms
      const lArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.15, s * 1.4, 6), darkMat);
      lArm.position.set(-s * 1, s * 0.8, 0);
      this.baseArmLZ = -0.3;
      lArm.rotation.z = this.baseArmLZ;
      lArm.castShadow = true;
      this.bodyGroup.add(lArm);
      this.leftArm = lArm;
      const rArm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.15, s * 1.4, 6), darkMat);
      rArm.position.set(s * 1, s * 0.8, 0);
      this.baseArmRZ = 0.3;
      rArm.rotation.z = this.baseArmRZ;
      rArm.castShadow = true;
      this.bodyGroup.add(rArm);
      this.rightArm = rArm;
      // Claws
      for (const side of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(s * 0.2, s * 0.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x1a0000, emissive: 0x330000, emissiveIntensity: 0.2, roughness: 0.4 }));
        claw.position.set(side * s * 1.2, s * 0.1, 0);
        claw.rotation.x = Math.PI;
        this.bodyGroup.add(claw);
      }
      // Dark aura
      const aura = new THREE.Mesh(new THREE.SphereGeometry(s * 1.6, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.1 }));
      aura.position.y = s;
      this.bodyGroup.add(aura);
    }
  }

  update(delta: number, path: THREE.Vector3[], pathLength: number): boolean {
    if (this.hp <= 0) return false;
    if (this.slowTimer > 0) { this.slowTimer -= delta; } else { this.slowFactor = 1; }
    const moveSpeed = this.speed * this.slowFactor * (delta / 1000);
    this.distanceTraveled += moveSpeed;
    if (this.distanceTraveled >= pathLength) return true;
    const { pos, dir } = getPositionOnPath(path, this.distanceTraveled);
    this.group.position.copy(pos);

    // Ghost floats higher
    if (this.type === 'dragon') this.group.position.y += 6;

    this.group.lookAt(pos.clone().add(dir));

    // === ANIMATION ===
    this.animPhase += delta * 0.008 * this.speed * this.slowFactor * 0.02;

    if (this.type === 'dragon') {
      // Ghost: floating bob + sway
      this.bodyGroup.position.y = Math.sin(this.animPhase * 2) * 1.2;
      this.bodyGroup.rotation.z = Math.sin(this.animPhase * 1.5) * 0.08;
      this.bodyGroup.rotation.x = Math.sin(this.animPhase) * 0.05;
    } else {
      // Walking bob
      this.bodyGroup.position.y = Math.abs(Math.sin(this.animPhase * 3)) * 0.6;
      // Arm swing
      if (this.leftArm) {
        this.leftArm.rotation.x = Math.sin(this.animPhase * 3) * 0.5;
      }
      if (this.rightArm) {
        this.rightArm.rotation.x = -Math.sin(this.animPhase * 3) * 0.5;
      }
      // Leg swing
      if (this.leftLeg) {
        this.leftLeg.rotation.x = -Math.sin(this.animPhase * 3) * 0.4;
      }
      if (this.rightLeg) {
        this.rightLeg.rotation.x = Math.sin(this.animPhase * 3) * 0.4;
      }
      // Boss menacing sway
      if (this.type === 'boss') {
        this.bodyGroup.rotation.z = Math.sin(this.animPhase * 1.5) * 0.06;
      }
    }

    // === HP BAR (billboard toward camera) ===
    // Reset hpBarGroup world rotation so it always faces a fixed tilt
    this.hpBarGroup.rotation.set(0, 0, 0);
    // Counter-rotate against the group's lookAt so bar stays camera-facing
    this.hpBarGroup.rotation.y = -this.group.rotation.y;
    this.hpBarGroup.rotation.x = -0.6;

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.scale.x = hpRatio;
    this.hpBar.position.x = -4 * (1 - hpRatio);
    const barColor = hpRatio > 0.5 ? 0x4caf50 : hpRatio > 0.25 ? 0xffc107 : 0xf44336;
    (this.hpBar.material as THREE.MeshBasicMaterial).color.set(barColor);

    return false;
  }

  takeDamage(amount: number, slow?: number): void {
    const dmg = Math.max(1, amount - this.stats.armor);
    this.hp -= dmg;
    if (slow && slow > 0) { this.slowFactor = 1 - slow; this.slowTimer = 2000; }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse(c => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
      if (c instanceof THREE.PointLight) c.dispose();
    });
  }
}

// ============ PROJECTILE ENTITY ============
class ProjectileEntity {
  mesh: THREE.Mesh;
  target: MonsterEntity;
  damage: number;
  config: TowerConfig;
  speed: number;
  alive = true;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, target: MonsterEntity, damage: number, config: TowerConfig) {
    this.target = target;
    this.damage = damage;
    this.config = config;
    this.speed = config.projectileSpeed;
    const mat = new THREE.MeshBasicMaterial({ color: config.color });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), mat);
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
  }

  update(delta: number, monsters: MonsterEntity[], scene: THREE.Scene): void {
    if (!this.alive) return;
    if (this.target.hp <= 0) { this.alive = false; return; }
    const dir = this.target.group.position.clone().sub(this.mesh.position).normalize();
    this.mesh.position.add(dir.multiplyScalar(this.speed * delta / 1000));
    const dist = this.mesh.position.distanceTo(this.target.group.position);
    if (dist < 3) {
      this.target.takeDamage(this.damage, this.config.slow);
      playEnemyHit();
      if (this.config.splash) {
        for (const m of monsters) {
          if (m !== this.target && m.hp > 0 && m.group.position.distanceTo(this.mesh.position) < 15) {
            m.takeDamage(Math.floor(this.damage * 0.5));
          }
        }
        playExplosion();
      }
      if (this.config.chain) {
        let prev = this.target;
        for (let c = 0; c < this.config.chain; c++) {
          let nearest: MonsterEntity | null = null;
          let nearDist = 30;
          for (const m of monsters) {
            if (m === prev || m.hp <= 0) continue;
            const d = m.group.position.distanceTo(prev.group.position);
            if (d < nearDist) { nearDist = d; nearest = m; }
          }
          if (nearest) { nearest.takeDamage(Math.floor(this.damage * 0.6)); prev = nearest; }
        }
      }
      this.alive = false;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ============ GAME STATE ============
type GameState = 'menu' | 'playing' | 'gameover';

// ============ MAIN GAME CLASS ============
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private ui: UI;
  private clock = new THREE.Clock();
  private state: GameState = 'menu';
  private container: HTMLElement;

  // Map
  private spiralPath: THREE.Vector3[] = [];
  private pathLength = 0;
  private towerSlots: TowerSlot[] = [];
  private baseMesh!: THREE.Mesh;

  // Entities
  private towers: TowerEntity[] = [];
  private monsters: MonsterEntity[] = [];
  private projectiles: ProjectileEntity[] = [];

  // Game state
  private gold = INITIAL_GOLD;
  private lives = INITIAL_LIVES;
  private gameSpeed = 1;
  private currentWave = 0;
  private waveTimer = 0;
  private waveTimeLimit = 0;
  private waveInProgress = false;
  private spawnQueue: { type: string; delay: number; timer: number }[] = [];
  private summonLevel = 1;
  private summonCount = 0;
  private selectedTower: TowerEntity | null = null;

  // Placement mode
  private placingTower: { type: string; tier: number; preview: THREE.Group } | null = null;

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // Menu
  private menuGroup: THREE.Group | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);
    this.scene.fog = new THREE.FogExp2(0x0a1628, 0.001);

    // Camera — lowered for better monster visibility
    this.camera = new THREE.PerspectiveCamera(50, 390 / 780, 1, 800);
    this.camera.position.set(0, 220, 160);
    this.camera.lookAt(0, 0, 10);

    // UI
    this.ui = new UI(container, this);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));

    this.showMenu();
    this.animate();
  }

  private resize(): void {
    const aspect = 390 / 780;
    const wa = this.container.clientWidth / this.container.clientHeight;
    let w: number, h: number;
    if (wa > aspect) { h = this.container.clientHeight; w = h * aspect; }
    else { w = this.container.clientWidth; h = w / aspect; }
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.marginLeft = `${(this.container.clientWidth - w) / 2}px`;
    this.renderer.domElement.style.marginTop = `${(this.container.clientHeight - h) / 2}px`;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // ============ MENU ============
  private showMenu(): void {
    this.state = 'menu';
    this.clearScene();
    this.setupLights();
    this.menuGroup = new THREE.Group();

    // Ground with gradient rings
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(MAP_RADIUS + 20, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d1b2a, roughness: 0.85 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.menuGroup.add(ground);
    // Decorative rings
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(20 + i * 22, 22 + i * 22, 48),
        new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.1;
      this.menuGroup.add(r);
    }

    // Spiral path (glowing)
    const pathPts = generateSpiralPath();
    const curve = new THREE.CatmullRomCurve3(pathPts);
    const tubeGeo = new THREE.TubeGeometry(curve, 250, 2.5, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.4, transparent: true, opacity: 0.7 });
    this.menuGroup.add(new THREE.Mesh(tubeGeo, tubeMat));
    // Path glow
    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 250, 3.5, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.08 })
    );
    this.menuGroup.add(glow);

    // Center fortress
    const basePlat = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 2, 12),
      new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.5, metalness: 0.3 }));
    basePlat.position.y = 1;
    this.menuGroup.add(basePlat);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x29b6f6, emissiveIntensity: 0.6, metalness: 0.4 });
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 7, 8), baseMat);
    baseMesh.position.y = 5.5;
    baseMesh.castShadow = true;
    this.menuGroup.add(baseMesh);
    // Crystal spire
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xb3e5fc, emissive: 0x4fc3f7, emissiveIntensity: 0.5, transparent: true, opacity: 0.8, roughness: 0.05 });
    const spire = new THREE.Mesh(new THREE.OctahedronGeometry(3, 0), spireMat);
    spire.position.y = 13;
    spire.scale.y = 2;
    this.menuGroup.add(spire);

    // Perimeter ice crystals
    const crystMat = new THREE.MeshStandardMaterial({ color: 0xb2ebf2, emissive: 0x4dd0e1, emissiveIntensity: 0.3, transparent: true, opacity: 0.7, roughness: 0.05 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = MAP_RADIUS + 5;
      const h = 4 + Math.random() * 6;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1 + Math.random(), 0), crystMat.clone());
      c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      c.scale.y = h / 2;
      c.rotation.y = Math.random() * Math.PI;
      this.menuGroup.add(c);
    }

    // Menu snow particles
    const snowCount = 400;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 400;
      snowPos[i * 3 + 1] = Math.random() * 180;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const menuSnow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.5 }));
    menuSnow.userData.isSnow = true;
    this.menuGroup.add(menuSnow);

    this.scene.add(this.menuGroup);
    this.ui.showMenu();
  }

  // ============ START GAME ============
  startGame(): void {
    this.state = 'playing';
    this.gold = INITIAL_GOLD;
    this.lives = INITIAL_LIVES;
    this.currentWave = 0;
    this.gameSpeed = 1;
    this.summonLevel = 1;
    this.summonCount = 0;
    this.towers = [];
    this.monsters = [];
    this.projectiles = [];
    this.waveInProgress = false;
    this.selectedTower = null;
    this.placingTower = null;

    this.clearScene();
    this.setupLights();
    this.buildMap();

    this.spiralPath = generateSpiralPath();
    this.pathLength = getPathLength(this.spiralPath);

    this.ui.showGame();
    this.ui.updateHUD(this.gold, this.lives, this.currentWave, TOTAL_WAVES, 0, 0);
    startBGM();
    playClick();
  }

  // ============ MAP BUILDING ============
  private setupLights(): void {
    // Cool moonlit ambient
    const ambient = new THREE.AmbientLight(0x3a6ea5, 0.6);
    this.scene.add(ambient);

    // Main directional (moonlight)
    const dir = new THREE.DirectionalLight(0xc8e6ff, 1.3);
    dir.position.set(80, 220, 60);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -160; dir.shadow.camera.right = 160;
    dir.shadow.camera.top = 160; dir.shadow.camera.bottom = -160;
    dir.shadow.camera.near = 50; dir.shadow.camera.far = 500;
    this.scene.add(dir);

    // Center base glow
    const centerLight = new THREE.PointLight(0x4fc3f7, 1.5, 180);
    centerLight.position.set(0, 25, 0);
    this.scene.add(centerLight);

    // Aurora accent lights (green/purple)
    const auroraGreen = new THREE.PointLight(0x00e676, 0.4, 300);
    auroraGreen.position.set(-80, 120, -60);
    this.scene.add(auroraGreen);
    const auroraPurple = new THREE.PointLight(0xb388ff, 0.35, 300);
    auroraPurple.position.set(60, 110, -80);
    this.scene.add(auroraPurple);

    // Warm rim light from spawn
    const rimLight = new THREE.PointLight(0xff8a65, 0.5, 200);
    rimLight.position.set(MAP_RADIUS, 15, 0);
    this.scene.add(rimLight);
  }

  private buildMap(): void {
    // === GROUND: layered icy terrain with depth ===
    // Abyss below (large dark plane far below)
    const abyss = new THREE.Mesh(
      new THREE.CircleGeometry(300, 32),
      new THREE.MeshBasicMaterial({ color: 0x020810 })
    );
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.y = -15;
    this.scene.add(abyss);

    // Outer cliff wall (vertical cylinder giving depth)
    const cliffMat = new THREE.MeshStandardMaterial({ color: 0x0d1f33, roughness: 0.8, metalness: 0.1 });
    const cliff = new THREE.Mesh(
      new THREE.CylinderGeometry(MAP_RADIUS + 8, MAP_RADIUS + 12, 12, 48, 1, true),
      cliffMat
    );
    cliff.position.y = -6;
    this.scene.add(cliff);

    // Outer ring lip (elevated edge)
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x1a3050, emissive: 0x0d47a1, emissiveIntensity: 0.08, roughness: 0.6, metalness: 0.2 });
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(MAP_RADIUS + 6, 3, 6, 48),
      lipMat
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.5;
    this.scene.add(lip);

    // Main ground disc (raised platform feel)
    const groundGeo = new THREE.CircleGeometry(MAP_RADIUS + 5, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x15253a, roughness: 0.85, metalness: 0.05 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Inner terrain rings (slight elevation steps)
    const terrainRings = [
      { r: 110, h: 0.3, color: 0x172d45 },
      { r: 80, h: 0.6, color: 0x1a3352 },
      { r: 50, h: 1.0, color: 0x1e3a5f },
      { r: 25, h: 1.5, color: 0x22426a },
    ];
    for (const tr of terrainRings) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(tr.r, tr.r + 2, tr.h, 48),
        new THREE.MeshStandardMaterial({ color: tr.color, roughness: 0.8 })
      );
      ring.position.y = tr.h / 2;
      ring.receiveShadow = true;
      this.scene.add(ring);
    }

    // Concentric glow rings
    const ringColors = [0x1a3050, 0x1e3858, 0x223e62, 0x1a3050];
    const ringRadii = [110, 85, 55, 30];
    for (let i = 0; i < ringColors.length; i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(ringRadii[i] - 2, ringRadii[i], 64),
        new THREE.MeshStandardMaterial({ color: ringColors[i], emissive: 0x29b6f6, emissiveIntensity: 0.08, roughness: 0.7 })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.1 + i * 0.1;
      this.scene.add(r);
    }

    // === SPIRAL PATH ===
    const pathPts = generateSpiralPath();
    const curve = new THREE.CatmullRomCurve3(pathPts);
    // Path body
    const tubeGeo = new THREE.TubeGeometry(curve, 250, 2.8, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, emissive: 0x1a237e, emissiveIntensity: 0.15, roughness: 0.6, metalness: 0.1 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.receiveShadow = true;
    this.scene.add(tube);
    // Path outer glow (blue)
    const glowTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 250, 3.8, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.06 })
    );
    this.scene.add(glowTube);
    // Path inner glow (white)
    const innerGlow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 250, 1.5, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.08 })
    );
    innerGlow.position.y = 0.3;
    this.scene.add(innerGlow);

    // Rune markers along path (every 25 points)
    const runeColors = [0x29b6f6, 0x4fc3f7, 0x00e5ff, 0x18ffff];
    for (let i = 0; i < pathPts.length; i += 25) {
      const p = pathPts[i];
      const runeMat = new THREE.MeshBasicMaterial({ color: runeColors[i % runeColors.length], transparent: true, opacity: 0.2 });
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.5, 6), runeMat);
      rune.position.set(p.x, 0.4, p.z);
      rune.rotation.x = -Math.PI / 2;
      rune.userData.isRune = true;
      this.scene.add(rune);
    }

    // === CENTER BASE: Ice Fortress ===
    // Base platform (multi-tiered)
    const basePlatMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.5, metalness: 0.3 });
    const basePlat = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 2, 12), basePlatMat);
    basePlat.position.y = 1;
    basePlat.receiveShadow = true;
    this.scene.add(basePlat);
    // Main fortress cylinder
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x0288d1, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.2 });
    this.baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 7, 8), baseMat);
    this.baseMesh.position.y = 5.5;
    this.baseMesh.castShadow = true;
    this.scene.add(this.baseMesh);
    // Fortress top ring
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.5, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x80deea, emissive: 0x4dd0e1, emissiveIntensity: 0.4 }));
    topRing.position.y = 9;
    topRing.rotation.x = Math.PI / 2;
    this.scene.add(topRing);
    // Crystal spire on top
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xb3e5fc, emissive: 0x4fc3f7, emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.05 });
    const spire = new THREE.Mesh(new THREE.OctahedronGeometry(3, 0), spireMat);
    spire.position.y = 13;
    spire.scale.y = 2;
    this.scene.add(spire);
    // Base beacon light
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.4 }));
    beacon.position.y = 15;
    this.scene.add(beacon);
    // Ground glow rings around base
    for (let i = 0; i < 3; i++) {
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(10 + i * 4, 11 + i * 4, 32),
        new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.12 - i * 0.03, side: THREE.DoubleSide })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.15 + i * 0.05;
      this.scene.add(glow);
    }

    // === ICE CRYSTAL FORMATIONS around perimeter ===
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xb2ebf2, emissive: 0x4dd0e1, emissiveIntensity: 0.3, transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.1 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
      const r = MAP_RADIUS + 3 + Math.random() * 5;
      const h = 4 + Math.random() * 8;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1 + Math.random(), 0), crystalMat.clone());
      crystal.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      crystal.scale.y = h / 2;
      crystal.rotation.y = Math.random() * Math.PI;
      crystal.rotation.z = (Math.random() - 0.5) * 0.2;
      crystal.castShadow = true;
      this.scene.add(crystal);
    }

    // === TOWER SLOTS (enhanced ice platforms) ===
    this.towerSlots = [];
    for (const ring of SLOT_RINGS) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + (ring.r * 0.01);
        const x = ring.r * Math.cos(angle);
        const z = ring.r * Math.sin(angle);
        // Platform base
        const slotBase = new THREE.Mesh(
          new THREE.CylinderGeometry(4, 4.5, 0.8, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e3a5f, emissive: 0x263238, emissiveIntensity: 0.1, roughness: 0.6, metalness: 0.2 })
        );
        slotBase.position.set(x, 0.4, z);
        slotBase.receiveShadow = true;
        this.scene.add(slotBase);
        // Slot top indicator ring
        const slotRing = new THREE.Mesh(
          new THREE.RingGeometry(3.5, 4.2, 8),
          new THREE.MeshBasicMaterial({ color: 0x37474f, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        slotRing.position.set(x, 0.85, z);
        slotRing.rotation.x = -Math.PI / 2;
        this.scene.add(slotRing);
        this.towerSlots.push({ position: new THREE.Vector3(x, 0, z), mesh: slotBase, occupied: false, tower: null });
      }
    }

    // === AURORA BOREALIS particles (sky) ===
    const auroraCount = 200;
    const auroraGeo = new THREE.BufferGeometry();
    const auroraPos = new Float32Array(auroraCount * 3);
    const auroraColors = new Float32Array(auroraCount * 3);
    for (let i = 0; i < auroraCount; i++) {
      auroraPos[i * 3] = (Math.random() - 0.5) * 400;
      auroraPos[i * 3 + 1] = 100 + Math.random() * 100;
      auroraPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
      // Green/purple/cyan aurora colors
      const pick = Math.random();
      if (pick < 0.4) { auroraColors[i * 3] = 0; auroraColors[i * 3 + 1] = 0.9; auroraColors[i * 3 + 2] = 0.5; }
      else if (pick < 0.7) { auroraColors[i * 3] = 0.5; auroraColors[i * 3 + 1] = 0.3; auroraColors[i * 3 + 2] = 1; }
      else { auroraColors[i * 3] = 0; auroraColors[i * 3 + 1] = 0.8; auroraColors[i * 3 + 2] = 0.9; }
    }
    auroraGeo.setAttribute('position', new THREE.BufferAttribute(auroraPos, 3));
    auroraGeo.setAttribute('color', new THREE.BufferAttribute(auroraColors, 3));
    const auroraMat = new THREE.PointsMaterial({ size: 3, transparent: true, opacity: 0.4, vertexColors: true });
    const aurora = new THREE.Points(auroraGeo, auroraMat);
    aurora.userData.isAurora = true;
    this.scene.add(aurora);

    // === SNOW PARTICLES (enhanced) ===
    const snowCount = 500;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 400;
      snowPos[i * 3 + 1] = Math.random() * 180;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.6 });
    const snow = new THREE.Points(snowGeo, snowMat);
    snow.userData.isSnow = true;
    this.scene.add(snow);

    // === SPAWN PORTAL (outer edge) ===
    const portalAngle = 0;
    const portalX = (MAP_RADIUS + 2) * Math.cos(portalAngle);
    const portalZ = (MAP_RADIUS + 2) * Math.sin(portalAngle);
    // Portal ring
    const portalMat = new THREE.MeshStandardMaterial({ color: 0xff6e40, emissive: 0xff3d00, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
    const portal = new THREE.Mesh(new THREE.TorusGeometry(5, 0.8, 8, 16), portalMat);
    portal.position.set(portalX, 5, portalZ);
    portal.rotation.y = Math.PI / 2;
    this.scene.add(portal);
    // Portal glow
    const portalGlow = new THREE.Mesh(new THREE.CircleGeometry(4, 16),
      new THREE.MeshBasicMaterial({ color: 0xff6e40, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
    portalGlow.position.set(portalX, 5, portalZ);
    portalGlow.rotation.y = Math.PI / 2;
    this.scene.add(portalGlow);
  }

  private clearScene(): void {
    while (this.scene.children.length) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
      if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (obj.material as THREE.Material).dispose(); }
    }
    this.menuGroup = null;
  }

  // ============ INPUT ============
  private updatePointer(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown(e: PointerEvent): void {
    this.updatePointer(e);
    if (this.state !== 'playing') return;

    if (this.placingTower) {
      // Try to place on nearest slot
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersect = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(groundPlane, intersect);
      if (intersect) {
        let bestSlot: TowerSlot | null = null;
        let bestDist = 8;
        for (const slot of this.towerSlots) {
          if (slot.occupied) continue;
          const d = slot.position.distanceTo(intersect);
          if (d < bestDist) { bestDist = d; bestSlot = slot; }
        }
        if (bestSlot) {
          this.placeTower(bestSlot);
        }
      }
      return;
    }

    // Select tower
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const tower of this.towers) {
      const hits = this.raycaster.intersectObject(tower.group, true);
      if (hits.length > 0) {
        this.selectedTower = tower;
        this.ui.showTowerInfo(tower);
        return;
      }
    }
    this.selectedTower = null;
    this.ui.hideTowerInfo();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.placingTower) return;
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, pt);
    if (pt) this.placingTower.preview.position.copy(pt);
  }

  // ============ SUMMON & PLACE ============
  getSummonCost(): number { return SUMMON_COST_BASE + this.summonCount * SUMMON_COST_INC; }

  summonTower(): void {
    const cost = this.getSummonCost();
    if (this.gold < cost) return;
    if (this.towerSlots.every(s => s.occupied)) return;

    this.gold -= cost;
    this.summonCount++;
    const type = rollSummonType();
    const tier = rollSummonTier(this.summonLevel);

    // Create preview
    const preview = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: TOWER_TYPES[type].color, transparent: true, opacity: 0.5 });
    const previewMesh = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 6, 8), mat);
    previewMesh.position.y = 3;
    preview.add(previewMesh);
    // Range indicator
    const rangeMat = new THREE.MeshBasicMaterial({ color: TOWER_TYPES[type].color, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
    const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0, getTowerRange(type, tier), 24), rangeMat);
    rangeRing.rotation.x = -Math.PI / 2;
    rangeRing.position.y = 0.5;
    preview.add(rangeRing);
    this.scene.add(preview);

    this.placingTower = { type, tier, preview };
    playSummon();
    this.ui.showPlacingMode(type, tier);
    this.updateUI();
  }

  private placeTower(slot: TowerSlot): void {
    if (!this.placingTower) return;
    const { type, tier, preview } = this.placingTower;
    this.scene.remove(preview);
    preview.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } });

    const tower = new TowerEntity(this.scene, type, tier, slot);
    slot.occupied = true;
    slot.tower = tower;
    this.towers.push(tower);
    (slot.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x1b5e20);

    this.placingTower = null;
    playPlaceTower();
    this.ui.hidePlacingMode();

    if (tier >= SKILL_MIN_TIER) {
      const tierName = TIER_NAMES[tier - 1];
      this.ui.showAnnouncement(`★ ${tierName} ${TOWER_TYPES[type].nameKo}! ★`, TIER_COLORS[tier - 1]);
    }
    this.updateUI();
  }

  cancelPlacing(): void {
    if (!this.placingTower) return;
    this.gold += this.getSummonCost() - SUMMON_COST_INC; // refund
    this.summonCount--;
    this.scene.remove(this.placingTower.preview);
    this.placingTower.preview.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } });
    this.placingTower = null;
    this.ui.hidePlacingMode();
    this.updateUI();
  }

  // ============ MERGE ============
  getMergeCount(): number {
    const groups = new Map<string, number>();
    for (const t of this.towers) {
      if (t.tier >= MAX_TIER) continue;
      const key = t.getKey();
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    let count = 0;
    for (const [, n] of groups) count += Math.floor(n / 3);
    return count;
  }

  autoMerge(): void {
    const groups = new Map<string, TowerEntity[]>();
    for (const t of this.towers) {
      if (t.tier >= MAX_TIER) continue;
      const key = t.getKey();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    let merged = false;
    for (const [, list] of groups) {
      while (list.length >= 3) {
        const toMerge = list.splice(0, 3);
        const keeper = toMerge[0];
        for (let i = 1; i < 3; i++) {
          const t = toMerge[i];
          t.slot.occupied = false;
          t.slot.tower = null;
          (t.slot.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x37474f);
          const idx = this.towers.indexOf(t);
          if (idx >= 0) this.towers.splice(idx, 1);
          t.dispose(this.scene);
        }
        keeper.upgradeTier();
        merged = true;
      }
    }
    if (merged) { playMerge(); this.updateUI(); }
  }

  sellTower(tower: TowerEntity): void {
    const value = tower.getSellValue();
    this.gold += value;
    tower.slot.occupied = false;
    tower.slot.tower = null;
    (tower.slot.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x37474f);
    const idx = this.towers.indexOf(tower);
    if (idx >= 0) this.towers.splice(idx, 1);
    tower.dispose(this.scene);
    playSell();
    this.selectedTower = null;
    this.ui.hideTowerInfo();
    this.updateUI();
  }

  // ============ SKILLS ============
  activateSkill(tower: TowerEntity): void {
    if (tower.tier < SKILL_MIN_TIER || tower.skillCooldown > 0) return;
    const skill = tower.config.skill;
    tower.skillCooldown = skill.cooldown;
    playSkill(skill.type);

    const pos = tower.group.position;
    const scene = this.scene;

    // Helper: animated effect cleanup
    const animateEffect = (obj: THREE.Object3D, duration: number, onFrame: (t: number) => void) => {
      const start = performance.now();
      const tick = () => {
        const t = (performance.now() - start) / duration;
        if (t >= 1) {
          scene.remove(obj);
          obj.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } });
          return;
        }
        onFrame(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (skill.type === 'volley') {
      // ICE ARROW STORM: multiple icy projectile trails raining down
      for (const m of this.monsters) {
        if (m.hp > 0 && m.group.position.distanceTo(pos) < skill.radius) {
          m.takeDamage(skill.damage);
        }
      }
      // Volley rain effect: many small falling shards
      const volleyGroup = new THREE.Group();
      for (let i = 0; i < 30; i++) {
        const shard = new THREE.Mesh(
          new THREE.ConeGeometry(0.3, 2, 4),
          new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.8 })
        );
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * skill.radius;
        shard.position.set(pos.x + Math.cos(a) * r, 50 + Math.random() * 20, pos.z + Math.sin(a) * r);
        shard.rotation.x = Math.PI;
        volleyGroup.add(shard);
      }
      scene.add(volleyGroup);
      animateEffect(volleyGroup, 800, (t) => {
        volleyGroup.children.forEach((c, i) => {
          c.position.y -= 1.5;
          (c as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.8 * (1 - t) });
        });
      });
      // Ground impact ring
      const impactRing = new THREE.Mesh(
        new THREE.RingGeometry(0, skill.radius, 32),
        new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
      );
      impactRing.position.set(pos.x, 0.5, pos.z);
      impactRing.rotation.x = -Math.PI / 2;
      scene.add(impactRing);
      animateEffect(impactRing, 600, (t) => {
        (impactRing.material as THREE.MeshBasicMaterial).opacity = 0.25 * (1 - t);
      });

    } else if (skill.type === 'earthquake') {
      // SHOCKWAVE: expanding ground ring + rising rock pillars + camera shake
      for (const m of this.monsters) {
        if (m.hp > 0 && m.group.position.distanceTo(pos) < skill.radius) {
          m.takeDamage(skill.damage);
          m.slowFactor = 0; m.slowTimer = (skill.duration || 1.5) * 1000;
        }
      }
      // Expanding shockwave ring
      const shockGroup = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(5, 1.5 - i * 0.3, 6, 32),
          new THREE.MeshBasicMaterial({ color: [0xd32f2f, 0xff5722, 0xff9800][i], transparent: true, opacity: 0.4 })
        );
        ring.position.set(pos.x, 1 + i * 0.3, pos.z);
        ring.rotation.x = Math.PI / 2;
        shockGroup.add(ring);
      }
      scene.add(shockGroup);
      animateEffect(shockGroup, 1000, (t) => {
        shockGroup.children.forEach((c, i) => {
          const ring = c as THREE.Mesh;
          const scale = 1 + t * (skill.radius / 5);
          ring.scale.set(scale, scale, 1);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - t);
        });
      });
      // Rising rock pillars
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
        const r = 10 + Math.random() * (skill.radius - 15);
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(2 + Math.random() * 2, 8 + Math.random() * 6, 2 + Math.random() * 2),
          new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 })
        );
        pillar.position.set(pos.x + Math.cos(a) * r, -5, pos.z + Math.sin(a) * r);
        pillar.rotation.y = Math.random() * Math.PI;
        scene.add(pillar);
        animateEffect(pillar, 1200, (t) => {
          if (t < 0.3) pillar.position.y = -5 + (t / 0.3) * 5;
          else pillar.position.y = 5 * (1 - (t - 0.3) / 0.7) - 5;
          (pillar.material as THREE.MeshStandardMaterial).opacity = 1 - t;
        });
      }
      // Camera shake
      const origY = this.camera.position.y;
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        this.camera.position.y = origY + (Math.random() - 0.5) * 6;
        shakeCount++;
        if (shakeCount > 10) { clearInterval(shakeInterval); this.camera.position.y = origY; }
      }, 50);

    } else if (skill.type === 'meteor') {
      // FIRE SWIRL: descending fire tornadoes + ground explosions
      const targets = this.monsters.filter(m => m.hp > 0).slice(0, 5);
      targets.forEach((m, i) => {
        setTimeout(() => {
          m.takeDamage(skill.damage);
          playExplosion();
          // Fire tornado at impact
          const tornado = new THREE.Group();
          for (let j = 0; j < 6; j++) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(2 + j * 0.5, 0.4, 6, 12),
              new THREE.MeshBasicMaterial({ color: j < 3 ? 0xff3d00 : 0xffab00, transparent: true, opacity: 0.6 })
            );
            ring.position.y = j * 2;
            ring.rotation.x = Math.PI / 2;
            tornado.add(ring);
          }
          tornado.position.copy(m.group.position);
          scene.add(tornado);
          animateEffect(tornado, 700, (t) => {
            tornado.rotation.y += 0.2;
            tornado.scale.setScalar(1 + t);
            tornado.children.forEach(c => {
              (c as THREE.Mesh).material = new THREE.MeshBasicMaterial({
                color: 0xff6e40, transparent: true, opacity: 0.6 * (1 - t)
              });
            });
          });
          // Ground scorch mark
          const scorch = new THREE.Mesh(
            new THREE.CircleGeometry(4, 16),
            new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
          );
          scorch.position.copy(m.group.position).setY(0.3);
          scorch.rotation.x = -Math.PI / 2;
          scene.add(scorch);
          animateEffect(scorch, 1500, (t) => {
            (scorch.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - t);
            scorch.scale.setScalar(1 + t * 0.5);
          });
        }, i * 300);
      });

    } else if (skill.type === 'blizzard') {
      // MIST CLOUD: expanding ice cloud with swirling crystal particles
      for (const m of this.monsters) {
        if (m.hp > 0) {
          m.takeDamage(skill.damage);
          m.slowFactor = 0;
          m.slowTimer = (skill.duration || 3) * 1000;
        }
      }
      // Ice cloud dome
      const cloudGroup = new THREE.Group();
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), cloudMat);
      cloud.scale.y = 0.3;
      cloud.position.y = 5;
      cloudGroup.add(cloud);
      // Ice crystal particles
      for (let i = 0; i < 40; i++) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5 + Math.random() * 0.5, 0),
          new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.6 })
        );
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 80;
        crystal.position.set(Math.cos(a) * r, 2 + Math.random() * 8, Math.sin(a) * r);
        crystal.userData.angle = a;
        crystal.userData.radius = r;
        cloudGroup.add(crystal);
      }
      // Ground frost ring
      const frost = new THREE.Mesh(
        new THREE.RingGeometry(0, 120, 48),
        new THREE.MeshBasicMaterial({ color: 0xe0f7fa, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      );
      frost.rotation.x = -Math.PI / 2;
      frost.position.y = 0.3;
      cloudGroup.add(frost);
      scene.add(cloudGroup);
      animateEffect(cloudGroup, 2500, (t) => {
        cloud.scale.setScalar(1 + t * 5);
        cloud.scale.y = 0.3;
        (cloud.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1 - t);
        cloudGroup.children.forEach((c, i) => {
          if (i === 0 || i === cloudGroup.children.length - 1) return;
          c.rotation.y += 0.05;
          c.rotation.x += 0.03;
          c.position.y += (Math.random() - 0.3) * 0.1;
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
        });
        (frost.material as THREE.MeshBasicMaterial).opacity = 0.15 * (1 - t);
      });

    } else if (skill.type === 'chain_lightning') {
      // VOID NOVA: purple lightning ring expanding + sparks
      for (const m of this.monsters) {
        if (m.hp > 0) m.takeDamage(skill.damage);
      }
      // Expanding energy ring
      const novaGroup = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(8, 0.6 - i * 0.1, 6, 32),
          new THREE.MeshBasicMaterial({ color: [0xfdd835, 0xffee58, 0xfff176, 0xfdd835][i], transparent: true, opacity: 0.5 })
        );
        ring.position.y = 3 + i * 1.5;
        ring.rotation.x = Math.PI / 2;
        novaGroup.add(ring);
      }
      scene.add(novaGroup);
      animateEffect(novaGroup, 1200, (t) => {
        novaGroup.children.forEach((c, i) => {
          const scale = 1 + t * 15;
          c.scale.set(scale, scale, 1);
          (c as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: 0xfdd835, transparent: true, opacity: 0.5 * (1 - t)
          });
        });
      });
      // Lightning bolt lines to random monsters
      const hitTargets = this.monsters.filter(m => m.hp > 0).slice(0, 10);
      hitTargets.forEach(m => {
        const boltGeo = new THREE.BufferGeometry();
        const points: number[] = [];
        const start = pos.clone().setY(10);
        const end = m.group.position.clone().setY(3);
        const mid = start.clone().lerp(end, 0.5);
        mid.x += (Math.random() - 0.5) * 15;
        mid.y += 10 + Math.random() * 10;
        mid.z += (Math.random() - 0.5) * 15;
        for (let t = 0; t <= 1; t += 0.1) {
          const p = new THREE.Vector3();
          p.lerpVectors(start, mid, t * 2 < 1 ? t * 2 : 1);
          if (t > 0.5) p.lerpVectors(mid, end, (t - 0.5) * 2);
          p.x += (Math.random() - 0.5) * 3;
          p.z += (Math.random() - 0.5) * 3;
          points.push(p.x, p.y, p.z);
        }
        boltGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: 0xfdd835, linewidth: 2 }));
        scene.add(bolt);
        const bStart = performance.now();
        const boltAnim = () => {
          const bt = (performance.now() - bStart) / 400;
          if (bt >= 1) { scene.remove(bolt); boltGeo.dispose(); return; }
          (bolt.material as THREE.LineBasicMaterial).opacity = 1 - bt;
          requestAnimationFrame(boltAnim);
        };
        requestAnimationFrame(boltAnim);
      });
      // Camera flash
      const origBg = (scene.background as THREE.Color).clone();
      scene.background = new THREE.Color(0x333322);
      setTimeout(() => { scene.background = origBg; }, 100);
    }

    this.ui.showAnnouncement(`⚡ ${skill.nameKo}!`, tower.config.color);
  }

  // ============ WAVES ============
  startNextWave(): void {
    if (this.waveInProgress || this.currentWave >= TOTAL_WAVES) return;
    this.currentWave++;
    const waveData = WAVES[this.currentWave - 1];
    this.waveTimeLimit = waveData.timeLimit;
    this.waveTimer = waveData.timeLimit;
    this.waveInProgress = true;

    // Build spawn queue
    this.spawnQueue = [];
    for (const group of waveData.enemies) {
      let delay = 500;
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ type: group.type, delay, timer: 0 });
        delay += group.delay;
      }
    }
    // Sort by delay
    this.spawnQueue.sort((a, b) => a.delay - b.delay);
    // Convert absolute delay to relative
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      this.spawnQueue[i].delay -= this.spawnQueue[i - 1].delay;
    }

    playWaveStart();
    this.updateUI();
  }

  upgradeSummonLevel(): void {
    if (this.summonLevel >= MAX_SUMMON_LEVEL) return;
    const cost = SUMMON_UPGRADE_COSTS[this.summonLevel - 1];
    if (this.gold < cost) return;
    this.gold -= cost;
    this.summonLevel++;
    playClick();
    this.updateUI();
  }

  toggleSpeed(): void {
    this.gameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 3 : 1;
    playClick();
    this.ui.updateSpeed(this.gameSpeed);
  }

  // ============ UPDATE ============
  private updateUI(): void {
    this.ui.updateHUD(this.gold, this.lives, this.currentWave, TOTAL_WAVES, this.waveTimer, this.waveTimeLimit);
    this.ui.updateBottomPanel(this.getSummonCost(), this.getMergeCount(), this.summonLevel,
      this.summonLevel >= MAX_SUMMON_LEVEL ? 'MAX' : `${SUMMON_UPGRADE_COSTS[this.summonLevel - 1]}G`);
  }

  private updateGame(delta: number): void {
    const dt = delta * this.gameSpeed;

    // Wave timer
    if (this.waveInProgress) {
      this.waveTimer -= dt / 1000;
      if (this.waveTimer <= 0) {
        // Time's up - remaining monsters damage lives
        const remaining = this.monsters.filter(m => m.hp > 0).length;
        this.lives -= remaining;
        for (const m of this.monsters) { if (m.hp > 0) { m.hp = 0; m.dispose(this.scene); } }
        this.monsters = [];
        this.waveInProgress = false;
        this.spawnQueue = [];
        if (this.lives <= 0) { this.endGame(false); return; }
        playLifeLost();
      }
    }

    // Spawn enemies
    if (this.spawnQueue.length > 0) {
      this.spawnQueue[0].timer += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].timer >= this.spawnQueue[0].delay) {
        const spawn = this.spawnQueue.shift()!;
        const monster = new MonsterEntity(this.scene, spawn.type, this.spiralPath);
        this.monsters.push(monster);
        if (this.spawnQueue.length > 0) this.spawnQueue[0].timer = 0;
      }
    }

    // Update monsters
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (m.hp <= 0) {
        const reward = m.stats.reward;
        this.gold += reward;
        playGoldPickup();
        if (m.type === 'boss') playBossDeath(); else playEnemyDeath();
        m.dispose(this.scene);
        this.monsters.splice(i, 1);
        continue;
      }
      const reached = m.update(dt, this.spiralPath, this.pathLength);
      if (reached) {
        this.lives--;
        playLifeLost();
        m.dispose(this.scene);
        this.monsters.splice(i, 1);
        if (this.lives <= 0) { this.endGame(false); return; }
      }
    }

    // Update towers
    for (const tower of this.towers) {
      tower.update(dt, this.monsters, this.projectiles, this.scene);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this.monsters, this.scene);
      if (!p.alive) { p.dispose(this.scene); this.projectiles.splice(i, 1); }
    }

    // Wave complete check
    if (this.waveInProgress && this.spawnQueue.length === 0 && this.monsters.length === 0) {
      this.waveInProgress = false;
      const waveData = WAVES[this.currentWave - 1];
      const timeBonus = Math.floor(this.waveTimer * 2);
      this.gold += waveData.reward + timeBonus;
      playWaveClear();
      this.ui.showAnnouncement(`★ Wave ${this.currentWave} Clear! +${waveData.reward + timeBonus}G ★`, 0xffd700);
      if (this.currentWave >= TOTAL_WAVES) { this.endGame(true); return; }
    }

    // Particle & environment animations
    const now = performance.now();
    this.scene.traverse(obj => {
      // Snow falling
      if (obj instanceof THREE.Points && obj.userData.isSnow) {
        const pos = obj.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - dt * 0.012;
          if (y < 0) y = 180;
          pos.setY(i, y);
          pos.setX(i, pos.getX(i) + Math.sin(y * 0.08 + i) * 0.025);
        }
        pos.needsUpdate = true;
      }
      // Aurora shimmer
      if (obj instanceof THREE.Points && obj.userData.isAurora) {
        const pos = obj.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setY(i, pos.getY(i) + Math.sin(now * 0.0005 + i * 0.3) * 0.05);
          pos.setX(i, pos.getX(i) + Math.cos(now * 0.0003 + i * 0.5) * 0.02);
        }
        pos.needsUpdate = true;
        obj.rotation.y += dt * 0.00005;
      }
      // Rune glow pulse
      if (obj instanceof THREE.Mesh && obj.userData.isRune) {
        const mat = obj.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.15 + Math.sin(now * 0.003 + obj.position.x * 0.1) * 0.1;
        obj.rotation.z += dt * 0.001;
      }
    });

    // Base pulse + beacon
    if (this.baseMesh) {
      const pulse = 1 + Math.sin(now * 0.002) * 0.04;
      this.baseMesh.scale.set(pulse, 1, pulse);
    }

    this.updateUI();
  }

  private endGame(victory: boolean): void {
    this.state = 'gameover';
    stopBGM();
    if (victory) playVictory(); else playDefeat();
    this.ui.showGameOver(victory, this.currentWave, this.gold);
  }

  returnToMenu(): void {
    // Cleanup
    for (const t of this.towers) t.dispose(this.scene);
    for (const m of this.monsters) m.dispose(this.scene);
    for (const p of this.projectiles) p.dispose(this.scene);
    this.towers = []; this.monsters = []; this.projectiles = [];
    stopBGM();
    this.showMenu();
  }

  // Getters for UI
  getSelectedTower(): TowerEntity | null { return this.selectedTower; }
  getGold(): number { return this.gold; }
  isWaveInProgress(): boolean { return this.waveInProgress; }
  getCurrentWave(): number { return this.currentWave; }

  // ============ ANIMATION LOOP ============
  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta() * 1000, 50);

    if (this.state === 'menu' && this.menuGroup) {
      this.menuGroup.rotation.y += delta * 0.0003;
      // Animate menu snow
      this.menuGroup.traverse(obj => {
        if (obj instanceof THREE.Points && obj.userData.isSnow) {
          const pos = obj.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            let y = pos.getY(i) - delta * 0.01;
            if (y < 0) y = 180;
            pos.setY(i, y);
            pos.setX(i, pos.getX(i) + Math.sin(y * 0.08 + i) * 0.02);
          }
          pos.needsUpdate = true;
        }
      });
    } else if (this.state === 'playing') {
      this.updateGame(delta);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
