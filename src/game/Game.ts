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
    const c = this.config.color;
    const emissiveI = Math.min(1, (this.tier - 1) * 0.15);
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: emissiveI, roughness: 0.4, metalness: 0.3 });

    // Base
    const baseH = 3 + this.tier;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, baseH, 8), mat);
    base.position.y = baseH / 2;
    base.castShadow = true;
    this.group.add(base);

    // Type-specific top
    if (this.type === 'archer') {
      const top = new THREE.Mesh(new THREE.ConeGeometry(3, 4 + this.tier, 8), mat.clone());
      top.position.y = baseH + 2 + this.tier * 0.5;
      top.castShadow = true;
      this.group.add(top);
    } else if (this.type === 'warrior') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(6, 2 + this.tier, 6), mat.clone());
      top.position.y = baseH + 1 + this.tier * 0.3;
      top.castShadow = true;
      this.group.add(top);
      // Battlements
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1.5), mat.clone());
        b.position.set(Math.cos(angle) * 2.5, baseH + 3 + this.tier * 0.3, Math.sin(angle) * 2.5);
        this.group.add(b);
      }
    } else if (this.type === 'mage') {
      const orbMat = new THREE.MeshStandardMaterial({ color: 0xce93d8, emissive: 0xab47bc, emissiveIntensity: 0.5 + this.tier * 0.2, transparent: true, opacity: 0.9 });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(1.5 + this.tier * 0.3, 12, 12), orbMat);
      orb.position.y = baseH + 4 + this.tier * 0.5;
      this.group.add(orb);
    } else if (this.type === 'ice') {
      const iceMat = new THREE.MeshStandardMaterial({ color: 0x80deea, emissive: 0x00bcd4, emissiveIntensity: 0.3 + this.tier * 0.15, transparent: true, opacity: 0.8, roughness: 0.1 });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.5 + this.tier * 0.4, 0), iceMat);
      crystal.position.y = baseH + 3 + this.tier * 0.5;
      crystal.rotation.y = Math.PI / 4;
      this.group.add(crystal);
    } else if (this.type === 'thunder') {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(3, 0.4 + this.tier * 0.1, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xfdd835, emissive: 0xfdd835, emissiveIntensity: 0.4 + this.tier * 0.2 }));
      coil.position.y = baseH + 2;
      coil.rotation.x = Math.PI / 2;
      this.group.add(coil);
    }

    // Tier 3+ aura ring
    if (this.tier >= SKILL_MIN_TIER) {
      const auraMat = new THREE.MeshBasicMaterial({ color: TIER_COLORS[this.tier - 1], transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      this.auraMesh = new THREE.Mesh(new THREE.RingGeometry(4, 6, 24), auraMat);
      this.auraMesh.rotation.x = -Math.PI / 2;
      this.auraMesh.position.y = 0.5;
      this.group.add(this.auraMesh);
    }

    // Tier 4+ crown
    if (this.tier >= 4) {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.5, metalness: 0.8 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 1.5, 6), crownMat);
      crown.position.y = baseH + 8 + this.tier;
      this.group.add(crown);
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
  type: string;
  stats: EnemyStats;
  hp: number;
  maxHp: number;
  speed: number;
  distanceTraveled = 0;
  slowTimer = 0;
  slowFactor = 1;
  alive = true;
  private hpBar: THREE.Mesh;
  private hpBarBg: THREE.Mesh;

  constructor(scene: THREE.Scene, type: string, path: THREE.Vector3[]) {
    this.type = type;
    this.stats = ENEMY_DATA[type];
    this.hp = this.stats.hp;
    this.maxHp = this.stats.hp;
    this.speed = this.stats.speed;
    this.group = new THREE.Group();
    this.group.position.copy(path[0]);
    this.buildMesh();
    // HP bar
    this.hpBarBg = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    this.hpBarBg.position.y = this.stats.size * 0.15 + 5;
    this.hpBarBg.rotation.x = -0.8;
    this.group.add(this.hpBarBg);
    this.hpBar = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), new THREE.MeshBasicMaterial({ color: 0x4caf50 }));
    this.hpBar.position.y = this.stats.size * 0.15 + 5.01;
    this.hpBar.rotation.x = -0.8;
    this.group.add(this.hpBar);
    scene.add(this.group);
  }

  private buildMesh(): void {
    const s = this.stats.size * 0.15;
    const color = this.stats.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });

    if (this.type === 'boss') {
      mat.emissive = new THREE.Color(0x660000);
      mat.emissiveIntensity = 0.3;
    }
    if (this.type === 'dragon') {
      mat.transparent = true;
      mat.opacity = 0.6;
      mat.emissive = new THREE.Color(0x9575cd);
      mat.emissiveIntensity = 0.4;
    }
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
    body.position.y = s + 0.5;
    body.castShadow = true;
    this.group.add(body);
    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.type === 'dragon' ? 0x000000 : 0xff0000 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.2, 6, 6), eyeMat);
      eye.position.set(side * s * 0.4, s + s * 0.3 + 0.5, s * 0.7);
      this.group.add(eye);
    }
    // Type-specific
    if (this.type === 'orc') {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(s * 1.4, s * 0.8, s * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.7, roughness: 0.3 }));
      armor.position.set(0, s + 0.5, s * 0.8);
      this.group.add(armor);
    } else if (this.type === 'boss') {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(s * 0.6, s * 0.8, 5),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 }));
      crown.position.y = s * 2 + 1;
      this.group.add(crown);
    } else if (this.type === 'troll') {
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, s),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
      bone.position.set(s * 0.6, s + 0.5, 0);
      bone.rotation.z = 0.4;
      this.group.add(bone);
    }
  }

  update(delta: number, path: THREE.Vector3[], pathLength: number): boolean {
    if (this.hp <= 0) return false;
    if (this.slowTimer > 0) { this.slowTimer -= delta; } else { this.slowFactor = 1; }
    const speed = this.speed * this.slowFactor * (delta / 1000);
    this.distanceTraveled += speed;
    if (this.distanceTraveled >= pathLength) return true; // reached end
    const { pos, dir } = getPositionOnPath(path, this.distanceTraveled);
    this.group.position.copy(pos);
    if (this.type === 'dragon') this.group.position.y += 4; // float
    this.group.lookAt(pos.clone().add(dir));
    // HP bar
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.scale.x = hpRatio;
    this.hpBar.position.x = -3 * (1 - hpRatio);
    (this.hpBar.material as THREE.MeshBasicMaterial).color.set(hpRatio > 0.5 ? 0x4caf50 : hpRatio > 0.25 ? 0xffc107 : 0xf44336);
    return false;
  }

  takeDamage(amount: number, slow?: number): void {
    const dmg = Math.max(1, amount - this.stats.armor);
    this.hp -= dmg;
    if (slow && slow > 0) { this.slowFactor = 1 - slow; this.slowTimer = 2000; }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } });
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
    this.scene.fog = new THREE.FogExp2(0x0a1628, 0.0015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, 390 / 780, 1, 800);
    this.camera.position.set(0, 280, 170);
    this.camera.lookAt(0, 0, 0);

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

    // Ground preview
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(MAP_RADIUS + 10, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.8 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.menuGroup.add(ground);

    // Spiral path preview
    const pathPts = generateSpiralPath();
    const curve = new THREE.CatmullRomCurve3(pathPts);
    const tubeGeo = new THREE.TubeGeometry(curve, 200, 2, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x29b6f6, emissive: 0x0277bd, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 });
    this.menuGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    // Center base
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x29b6f6, emissiveIntensity: 0.5 });
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 12), baseMat);
    baseMesh.position.y = 3;
    baseMesh.castShadow = true;
    this.menuGroup.add(baseMesh);

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
    const ambient = new THREE.AmbientLight(0x4488cc, 0.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffeedd, 1.2);
    dir.position.set(80, 200, 60);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -160; dir.shadow.camera.right = 160;
    dir.shadow.camera.top = 160; dir.shadow.camera.bottom = -160;
    dir.shadow.camera.near = 50; dir.shadow.camera.far = 500;
    this.scene.add(dir);

    const point = new THREE.PointLight(0x4fc3f7, 1, 200);
    point.position.set(0, 20, 0);
    this.scene.add(point);
  }

  private buildMap(): void {
    // Ground
    const groundGeo = new THREE.CircleGeometry(MAP_RADIUS + 15, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Outer ring decoration
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(MAP_RADIUS + 5, MAP_RADIUS + 15, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1b30, roughness: 0.8 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this.scene.add(ring);

    // Spiral path
    const pathPts = generateSpiralPath();
    const curve = new THREE.CatmullRomCurve3(pathPts);
    const tubeGeo = new THREE.TubeGeometry(curve, 200, 2.5, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x37474f, emissive: 0x263238, emissiveIntensity: 0.2, roughness: 0.7 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.receiveShadow = true;
    this.scene.add(tube);

    // Path edge glow
    const glowTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 200, 3.2, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.08 })
    );
    this.scene.add(glowTube);

    // Center base
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x0288d1, emissiveIntensity: 0.6, metalness: 0.4 });
    this.baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 12), baseMat);
    this.baseMesh.position.y = 3;
    this.baseMesh.castShadow = true;
    this.scene.add(this.baseMesh);
    // Base glow
    const baseGlow = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.15 })
    );
    baseGlow.rotation.x = -Math.PI / 2;
    baseGlow.position.y = 0.2;
    this.scene.add(baseGlow);

    // Tower slots
    this.towerSlots = [];
    const slotGeo = new THREE.CylinderGeometry(3.8, 4, 0.6, 8);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x263238, emissive: 0x37474f, emissiveIntensity: 0.1, roughness: 0.7 });
    for (const ring of SLOT_RINGS) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + (ring.r * 0.01); // slight offset
        const x = ring.r * Math.cos(angle);
        const z = ring.r * Math.sin(angle);
        const mesh = new THREE.Mesh(slotGeo.clone(), slotMat.clone());
        mesh.position.set(x, 0.3, z);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.towerSlots.push({ position: new THREE.Vector3(x, 0, z), mesh, occupied: false, tower: null });
      }
    }

    // Snow particles (using Points)
    const snowCount = 300;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 350;
      snowPos[i * 3 + 1] = Math.random() * 150;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 350;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1, transparent: true, opacity: 0.5 });
    const snow = new THREE.Points(snowGeo, snowMat);
    snow.userData.isSnow = true;
    this.scene.add(snow);
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
    if (skill.type === 'volley') {
      for (const m of this.monsters) {
        if (m.hp > 0 && m.group.position.distanceTo(pos) < skill.radius) {
          m.takeDamage(skill.damage);
        }
      }
    } else if (skill.type === 'earthquake') {
      for (const m of this.monsters) {
        if (m.hp > 0 && m.group.position.distanceTo(pos) < skill.radius) {
          m.takeDamage(skill.damage);
          m.slowFactor = 0; m.slowTimer = (skill.duration || 1.5) * 1000;
        }
      }
      this.camera.position.y += 5;
      setTimeout(() => { this.camera.position.y -= 5; }, 200);
    } else if (skill.type === 'meteor') {
      const targets = this.monsters.filter(m => m.hp > 0).slice(0, 5);
      targets.forEach((m, i) => {
        setTimeout(() => { m.takeDamage(skill.damage); playExplosion(); }, i * 300);
      });
    } else if (skill.type === 'blizzard') {
      for (const m of this.monsters) {
        if (m.hp > 0) {
          m.takeDamage(skill.damage);
          m.slowFactor = 0;
          m.slowTimer = (skill.duration || 3) * 1000;
        }
      }
    } else if (skill.type === 'chain_lightning') {
      for (const m of this.monsters) {
        if (m.hp > 0) m.takeDamage(skill.damage);
      }
    }

    // Visual effect: flash
    const flashGeo = new THREE.SphereGeometry(skill.radius === 999 ? 150 : skill.radius, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({ color: tower.config.color, transparent: true, opacity: 0.3 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(skill.radius === 999 ? new THREE.Vector3(0, 5, 0) : pos.clone().setY(5));
    this.scene.add(flash);
    const startTime = performance.now();
    const animFlash = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed > 500) {
        this.scene.remove(flash);
        flash.geometry.dispose();
        flashMat.dispose();
        return;
      }
      flashMat.opacity = 0.3 * (1 - elapsed / 500);
      flash.scale.setScalar(1 + elapsed / 500);
      requestAnimationFrame(animFlash);
    };
    requestAnimationFrame(animFlash);

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

    // Snow animation
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Points && obj.userData.isSnow) {
        const pos = obj.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - dt * 0.01;
          if (y < 0) y = 150;
          pos.setY(i, y);
          pos.setX(i, pos.getX(i) + Math.sin(y * 0.1) * 0.02);
        }
        pos.needsUpdate = true;
      }
    });

    // Base pulse
    if (this.baseMesh) {
      const pulse = 1 + Math.sin(performance.now() * 0.002) * 0.03;
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
    } else if (this.state === 'playing') {
      this.updateGame(delta);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
