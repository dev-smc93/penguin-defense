// Procedural sound effects using Web Audio API
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function createGain(ac: AudioContext, vol: number): GainNode {
  const g = ac.createGain();
  g.gain.value = vol;
  g.connect(ac.destination);
  return g;
}

// ====== TOWER SOUNDS ======

export function playShootArcher(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.08);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function playShootCannon(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Low boom
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.15);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.35);
  // Noise burst
  const buf = ac.createBuffer(1, ac.sampleRate * 0.15, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3));
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const ng = createGain(ac, 0.1);
  noise.connect(ng);
  noise.start(now);
  noise.stop(now + 0.15);
}

export function playShootIce(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.06);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.18);
  // Shimmer
  const osc2 = ac.createOscillator();
  const g2 = createGain(ac, 0.03);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(3200, now);
  osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc2.connect(g2);
  osc2.start(now + 0.02);
  osc2.stop(now + 0.15);
}

export function playShootLightning(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Electric zap
  const buf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ac.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * 800) * Math.exp(-t * 12);
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 2;
  const gain = createGain(ac, 0.1);
  noise.connect(filter);
  filter.connect(gain);
  noise.start(now);
  noise.stop(now + 0.2);
}

const shootFns: Record<string, () => void> = {
  archer: playShootArcher,
  cannon: playShootCannon,
  ice: playShootIce,
  lightning: playShootLightning,
};

export function playShoot(type: string): void {
  shootFns[type]?.();
}

// ====== IMPACT SOUNDS ======

export function playExplosion(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.12);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.45);
}

export function playEnemyHit(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const buf = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.2));
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const gain = createGain(ac, 0.04);
  noise.connect(gain);
  noise.start(now);
  noise.stop(now + 0.05);
}

export function playEnemyDeath(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.08);
  osc.type = 'square';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function playBossDeath(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Big low explosion
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.1;
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.1 - i * 0.02);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180 - i * 30, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.55);
  }
}

// ====== UI SOUNDS ======

export function playClick(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.06);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.05);
}

export function playPlaceTower(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.07);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.setValueAtTime(600, now + 0.05);
  osc.frequency.setValueAtTime(800, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function playUpgrade(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  [500, 700, 900, 1200].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.05);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 * (i + 1) + 0.05);
    osc.connect(gain);
    osc.start(now + 0.08 * i);
    osc.stop(now + 0.08 * (i + 1) + 0.05);
  });
}

export function playSell(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.06);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.18);
}

export function playMerge(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Rising chime with sparkle
  [400, 600, 800, 1200, 1600].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.06);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, now + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
    osc.connect(gain);
    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.2);
  });
  // Shimmer overlay
  const osc2 = ac.createOscillator();
  const g2 = createGain(ac, 0.03);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2400, now + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(3200, now + 0.4);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc2.connect(g2);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.5);
}

export function playSummon(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.07);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.2);
  // Pop
  const osc2 = ac.createOscillator();
  const g2 = createGain(ac, 0.05);
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1000, now + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(600, now + 0.18);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc2.connect(g2);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.22);
}

export function playGoldPickup(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.04);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.setValueAtTime(1600, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function playLifeLost(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = createGain(ac, 0.1);
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.45);
}

// ====== WAVE SOUNDS ======

export function playWaveStart(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Horn-like ascending
  [220, 330, 440].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.06);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, now + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
    osc.connect(gain);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.2);
  });
}

export function playWaveClear(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.06);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
    osc.connect(gain);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
}

export function playVictory(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Major arpeggio
  [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.07);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.07, now + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
    osc.connect(gain);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.4);
  });
}

export function playDefeat(): void {
  const ac = getCtx();
  const now = ac.currentTime;
  // Descending minor
  [440, 370, 330, 220].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.06);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, now + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.5);
    osc.connect(gain);
    osc.start(now + i * 0.25);
    osc.stop(now + i * 0.25 + 0.5);
  });
}

// ====== AMBIENT BGM (simple procedural loop) ======

let bgmGain: GainNode | null = null;
let bgmOscs: OscillatorNode[] = [];

export function startBGM(): void {
  stopBGM();
  const ac = getCtx();
  bgmGain = ac.createGain();
  bgmGain.gain.value = 0.02;
  bgmGain.connect(ac.destination);

  // Drone pad
  [130.81, 196.0, 261.63].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.value = 0.3;
    osc.connect(g);
    g.connect(bgmGain!);
    osc.start();
    bgmOscs.push(osc);
  });

  // Slow LFO on volume for movement
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.008;
  lfo.connect(lfoGain);
  lfoGain.connect(bgmGain.gain);
  lfo.start();
  bgmOscs.push(lfo);
}

export function stopBGM(): void {
  bgmOscs.forEach((o) => { try { o.stop(); } catch {} });
  bgmOscs = [];
  bgmGain = null;
}

// ====== SKILL SOUNDS ======

export function playSkillVolley(): void {
  const ac = getCtx(); const now = ac.currentTime;
  for (let i = 0; i < 8; i++) {
    const t = now + i * 0.05;
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.06);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800 + i * 100, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain); osc.start(t); osc.stop(t + 0.1);
  }
}

export function playSkillEarthquake(): void {
  const ac = getCtx(); const now = ac.currentTime;
  // Deep rumble
  const buf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ac.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * 50) * (1 - t / 1.5) * 0.8;
  }
  const noise = ac.createBufferSource(); noise.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120;
  const gain = createGain(ac, 0.2);
  noise.connect(lp); lp.connect(gain); noise.start(now); noise.stop(now + 1.5);
  // Impact
  const osc = ac.createOscillator();
  const g2 = createGain(ac, 0.15);
  osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  osc.connect(g2); osc.start(now); osc.stop(now + 1.0);
}

export function playSkillMeteor(): void {
  const ac = getCtx(); const now = ac.currentTime;
  for (let i = 0; i < 5; i++) {
    const t = now + i * 0.3;
    // Whistle down
    const osc = ac.createOscillator();
    const gain = createGain(ac, 0.08);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain); osc.start(t); osc.stop(t + 0.3);
    // Boom
    const osc2 = ac.createOscillator();
    const g2 = createGain(ac, 0.12);
    osc2.type = 'sawtooth'; osc2.frequency.setValueAtTime(150, t + 0.25);
    osc2.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc2.connect(g2); osc2.start(t + 0.25); osc2.stop(t + 0.65);
  }
}

export function playSkillBlizzard(): void {
  const ac = getCtx(); const now = ac.currentTime;
  // Wind whoosh
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ac.createBufferSource(); noise.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1;
  bp.frequency.setValueAtTime(200, now);
  bp.frequency.exponentialRampToValueAtTime(4000, now + 0.8);
  bp.frequency.exponentialRampToValueAtTime(600, now + 2.0);
  const gain = createGain(ac, 0.12);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 2.0);
  noise.connect(bp); bp.connect(gain); noise.start(now); noise.stop(now + 2.0);
  // Ice crystals
  [3200, 4000, 3600].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = createGain(ac, 0.03);
    osc.type = 'sine'; osc.frequency.value = f;
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.3);
    osc.connect(g); osc.start(now + i * 0.2); osc.stop(now + 0.5 + i * 0.3);
  });
}

export function playSkillChainLightning(): void {
  const ac = getCtx(); const now = ac.currentTime;
  // Big electric burst
  const buf = ac.createBuffer(1, ac.sampleRate * 0.8, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ac.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * 1200) * Math.exp(-t * 3);
  }
  const noise = ac.createBufferSource(); noise.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 3;
  const gain = createGain(ac, 0.15);
  noise.connect(bp); bp.connect(gain); noise.start(now); noise.stop(now + 0.8);
  // Thunder crack
  const osc = ac.createOscillator();
  const g2 = createGain(ac, 0.1);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, now + 0.05);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  osc.connect(g2); osc.start(now + 0.05); osc.stop(now + 0.7);
}

export function playSkill(type: string): void {
  const fns: Record<string, () => void> = {
    volley: playSkillVolley, earthquake: playSkillEarthquake,
    meteor: playSkillMeteor, blizzard: playSkillBlizzard,
    chain_lightning: playSkillChainLightning,
  };
  fns[type]?.();
}
