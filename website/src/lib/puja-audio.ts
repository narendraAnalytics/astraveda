// Virtual Puja sound engine — everything is synthesised live with the Web Audio
// API (no audio files, no licensing). All sounds go through one shared "temple
// room" (a generated convolution reverb) so they feel like they're in a hall.
//
// Sounds are one function each (`bell`, `conch`, `chime`, `startAarti`,
// `startAmbient`) behind the `pujaAudio` object, so real recordings can replace
// any of them later without touching the UI.
//
// Browsers only allow audio after a user gesture — call `pujaAudio.unlock()`
// from the first click (the "Begin Puja" button does).

import { SA_HZ, type PujaTradition } from "./virtual-puja";

type Engine = {
  ac: AudioContext;
  master: GainNode;
  fx: GainNode; // one-shot effects bus (dry + reverb)
  amb: GainNode; // ambience bus (ducked during aarti)
  noise: AudioBuffer;
};

let E: Engine | null = null;
let muted = false;

function impulse(ac: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function build(): Engine | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();

  const master = ac.createGain();
  master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master.connect(comp);
  comp.connect(ac.destination);

  const dry = ac.createGain();
  dry.gain.value = 0.8;
  dry.connect(master);

  const room = ac.createConvolver();
  room.buffer = impulse(ac, 2.8, 2.4);
  const wet = ac.createGain();
  wet.gain.value = 0.55;
  room.connect(wet);
  wet.connect(master);

  const fx = ac.createGain();
  fx.connect(dry);
  fx.connect(room);

  const amb = ac.createGain();
  amb.gain.value = 1;
  amb.connect(dry);
  amb.connect(room);

  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  return { ac, master, fx, amb, noise };
}

function eng(): Engine | null {
  if (!E) E = build();
  return E;
}

/** Ready-to-use engine, or null when audio is unavailable / not yet unlocked. */
function live(): Engine | null {
  const e = E;
  if (!e || e.ac.state === "closed") return null;
  if (e.ac.state === "suspended") void e.ac.resume();
  return e;
}

// ── Voices ──────────────────────────────────────────────────────────────────

/** Bronze bell: inharmonic partials, each with its own decay, plus detuned twins
 *  for the slow "beating" shimmer, plus a short clapper click. */
function strike(e: Engine, t: number, f0: number, vel: number, ring: number, out: AudioNode) {
  const partials: [number, number, number][] = [
    [0.5, 0.35, 0.9],
    [1, 1, 1],
    [1.19, 0.6, 0.7],
    [1.56, 0.45, 0.55],
    [2.0, 0.5, 0.5],
    [2.51, 0.3, 0.35],
    [2.74, 0.28, 0.3],
    [3.0, 0.2, 0.25],
    [4.07, 0.12, 0.15],
    [5.43, 0.08, 0.1],
  ];
  for (const [ratio, amp, dec] of partials) {
    for (const det of [0, 1.7]) {
      const o = e.ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f0 * ratio + det;
      const g = e.ac.createGain();
      const peak = vel * amp * 0.15 * (det ? 0.65 : 1);
      const len = ring * dec;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    }
  }
  const n = e.ac.createBufferSource();
  n.buffer = e.noise;
  const bp = e.ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 1.2;
  const ng = e.ac.createGain();
  ng.gain.setValueAtTime(vel * 0.45, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  n.connect(bp);
  bp.connect(ng);
  ng.connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.08);
}

function bell() {
  const e = live();
  if (!e) return;
  const t = e.ac.currentTime + 0.02;
  strike(e, t, 660, 1, 5, e.fx);
  strike(e, t + 0.55, 664, 0.8, 4.5, e.fx);
  strike(e, t + 1.15, 658, 0.62, 4, e.fx);
  strike(e, t + 1.9, 662, 0.45, 3.5, e.fx);
}

/** Shankh (conch): reedy swelling tone with vibrato and a breathy noise layer. */
function conch() {
  const e = live();
  if (!e) return;
  const ac = e.ac;
  const t = ac.currentTime + 0.02;
  const dur = 3.6;
  const f = 293.66;

  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.9, t + 0.6);
  out.gain.setValueAtTime(0.9, t + dur - 1.2);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.linearRampToValueAtTime(2300, t + 0.9);
  lp.frequency.linearRampToValueAtTime(1300, t + dur);
  const reed = ac.createBiquadFilter();
  reed.type = "peaking";
  reed.frequency.value = 1150;
  reed.gain.value = 7;
  reed.Q.value = 1.4;
  lp.connect(reed);
  reed.connect(out);
  out.connect(e.fx);

  const vib = ac.createOscillator();
  vib.frequency.value = 5.2;
  const vibDepth = ac.createGain();
  vibDepth.gain.value = 3.2;
  vib.connect(vibDepth);

  const voices: [OscillatorType, number, number][] = [
    ["sawtooth", 1, 0.32],
    ["triangle", 2, 0.22],
    ["sine", 0.5, 0.4],
  ];
  for (const [type, mult, amp] of voices) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f * mult * 0.94, t);
    o.frequency.linearRampToValueAtTime(f * mult, t + 0.4);
    vibDepth.connect(o.frequency);
    const g = ac.createGain();
    g.gain.value = amp;
    o.connect(g);
    g.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  vib.start(t);
  vib.stop(t + dur + 0.1);

  const n = ac.createBufferSource();
  n.buffer = e.noise;
  n.loop = true;
  const nbp = ac.createBiquadFilter();
  nbp.type = "bandpass";
  nbp.frequency.value = 1800;
  nbp.Q.value = 0.8;
  const ng = ac.createGain();
  ng.gain.value = 0.16;
  n.connect(nbp);
  nbp.connect(ng);
  ng.connect(out);
  n.start(t);
  n.stop(t + dur + 0.1);
}

/** Soft offering "ting". */
function chime() {
  const e = live();
  if (!e) return;
  const t = e.ac.currentTime + 0.01;
  for (const [ratio, amp, len] of [
    [1, 1, 1.8],
    [2.76, 0.4, 1.0],
    [5.4, 0.18, 0.6],
  ] as const) {
    const o = e.ac.createOscillator();
    o.type = "sine";
    o.frequency.value = 1760 * ratio;
    const g = e.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    g.connect(e.fx);
    o.start(t);
    o.stop(t + len + 0.05);
  }
}

/** Aarti percussion: hand-bell every beat, a temple gong + tabla-like thump on
 *  the accents, a cymbal wash on the off-beats. Scheduled a little ahead. */
function startAarti(): () => void {
  const e = live();
  if (!e) return () => {};
  const beat = 0.42;
  let next = e.ac.currentTime + 0.1;
  let n = 0;
  const schedule = () => {
    const now = e.ac.currentTime;
    while (next < now + 0.8) {
      const accent = n % 8 === 0;
      strike(e, next, 1180, accent ? 0.7 : 0.4 + (n % 2) * 0.12, 1.3, e.fx);
      if (accent) strike(e, next, 110, 0.9, 5, e.fx);
      if (n % 4 === 0 || n % 4 === 2) {
        const o = e.ac.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(150, next);
        o.frequency.exponentialRampToValueAtTime(70, next + 0.16);
        const g = e.ac.createGain();
        g.gain.setValueAtTime(0.5, next);
        g.gain.exponentialRampToValueAtTime(0.0001, next + 0.22);
        o.connect(g);
        g.connect(e.fx);
        o.start(next);
        o.stop(next + 0.25);
      }
      if (n % 2 === 1) {
        const s = e.ac.createBufferSource();
        s.buffer = e.noise;
        const hp = e.ac.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 6500;
        const g = e.ac.createGain();
        g.gain.setValueAtTime(0.09, next);
        g.gain.exponentialRampToValueAtTime(0.0001, next + 0.12);
        s.connect(hp);
        hp.connect(g);
        g.connect(e.fx);
        s.start(next, Math.random());
        s.stop(next + 0.15);
      }
      next += beat;
      n++;
    }
  };
  schedule();
  const id = window.setInterval(schedule, 200);
  return () => window.clearInterval(id);
}

// ── Ambience: tanpura drone + slow pad ──────────────────────────────────────

type Ambient = {
  tradition: PujaTradition;
  bus: GainNode;
  stops: (() => void)[];
  timer: number;
};
let ambient: Ambient | null = null;

function pluck(e: Engine, t: number, f: number, out: AudioNode) {
  for (const det of [0, 0.7]) {
    const o = e.ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f + det;
    const lp = e.ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 2.5;
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 2.6);
    const g = e.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    o.connect(lp);
    lp.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 3.7);
  }
}

function stopAmbient() {
  const a = ambient;
  const e = E;
  if (!a || !e) return;
  ambient = null;
  window.clearInterval(a.timer);
  const t = e.ac.currentTime;
  a.bus.gain.cancelScheduledValues(t);
  a.bus.gain.setValueAtTime(a.bus.gain.value, t);
  a.bus.gain.linearRampToValueAtTime(0, t + 1.4);
  window.setTimeout(() => {
    a.stops.forEach((s) => s());
    a.bus.disconnect();
  }, 1600);
}

function startAmbient(tradition: PujaTradition) {
  const e = live();
  if (!e) return;
  if (ambient?.tradition === tradition) return;
  stopAmbient();

  const sa = SA_HZ[tradition];
  const bus = e.ac.createGain();
  bus.gain.setValueAtTime(0, e.ac.currentTime);
  bus.gain.linearRampToValueAtTime(0.85, e.ac.currentTime + 3);
  bus.connect(e.amb);

  const stops: (() => void)[] = [];
  // Slow pad: Sa (low + mid), Pa, upper Sa, each breathing on its own LFO.
  for (const [mult, amp, lfo] of [
    [0.5, 0.11, 0.07],
    [1, 0.09, 0.05],
    [1.5, 0.05, 0.09],
    [2, 0.04, 0.06],
  ] as const) {
    const o = e.ac.createOscillator();
    o.type = "sine";
    o.frequency.value = sa * mult;
    const g = e.ac.createGain();
    g.gain.value = amp;
    const l = e.ac.createOscillator();
    l.frequency.value = lfo;
    const ld = e.ac.createGain();
    ld.gain.value = amp * 0.45;
    l.connect(ld);
    ld.connect(g.gain);
    o.connect(g);
    g.connect(bus);
    o.start();
    l.start();
    stops.push(() => {
      try {
        o.stop();
        l.stop();
      } catch {
        /* already stopped */
      }
    });
  }

  // Tanpura pluck cycle: Pa · Sa' · Sa' · Sa (low), looping.
  const cycle = [sa * 1.5, sa * 2, sa * 2, sa];
  let step = 0;
  let next = e.ac.currentTime + 0.4;
  const gap = 0.95;
  const tick = () => {
    while (next < e.ac.currentTime + 0.6) {
      pluck(e, next, cycle[step % cycle.length], bus);
      step++;
      next += gap * (step % cycle.length === 0 ? 1.25 : 1);
    }
  };
  tick();
  const timer = window.setInterval(tick, 200);
  ambient = { tradition, bus, stops, timer };
}

function duck(on: boolean) {
  const e = live();
  if (!e) return;
  const t = e.ac.currentTime;
  e.amb.gain.cancelScheduledValues(t);
  e.amb.gain.setValueAtTime(e.amb.gain.value, t);
  e.amb.gain.linearRampToValueAtTime(on ? 0.35 : 1, t + 0.8);
}

export const pujaAudio = {
  /** Create/resume the audio context. Must be called from a user gesture. */
  unlock() {
    const e = eng();
    if (e && e.ac.state === "suspended") void e.ac.resume();
  },
  setMuted(m: boolean) {
    muted = m;
    if (!E) return;
    const t = E.ac.currentTime;
    E.master.gain.cancelScheduledValues(t);
    E.master.gain.setValueAtTime(E.master.gain.value, t);
    E.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, t + 0.15);
  },
  bell,
  conch,
  chime,
  startAarti,
  startAmbient,
  stopAmbient,
  duck,
};
