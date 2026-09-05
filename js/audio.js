const ATTACK = 0.22;
const RELEASE = 0.55;
// Absolute formant frequencies for an "aah" vowel -- they stay fixed as pitch
// moves, which is what makes the tone read as a voice rather than a synth pad.
const FORMANTS = [
  { hz: 700, q: 7, gain: 1.0 },
  { hz: 1150, q: 9, gain: 0.7 },
  { hz: 2600, q: 11, gain: 0.25 },
];

// Pachelbel's ground bass: D A B F# G D G A, repeating forever.
const GROUND = [50, 45, 47, 42, 43, 38, 43, 45];
const STEP_DUR = 1.25;
const LOOKAHEAD = 0.25;

// The violin melody, one entry per ground-bass step. Entries with two notes
// subdivide the step. Length is a multiple of GROUND.length, so every variation
// stays locked to the chord it was written against no matter how far it loops.
const MELODY = [
  [78], [76], [74], [73], [71], [69], [71], [73],
  [74], [73], [71], [69], [67], [66], [67], [64],
  [74, 78], [81, 79], [78, 74], [78, 76],
  [74, 71], [74, 69], [67, 71], [69, 67],
];

// It's a canon: three violins play that same line, each entering one full
// ground cycle after the one before, so the piece accumulates as it goes.
const VOICE_COUNT = 3;
const CANON_DELAY = GROUND.length;
const PANS = [-0.35, 0.05, 0.4];

let ctx = null;
let master = null;
let bassBus = null;
let violinBuses = [];
let bassTimer = null;
let bassNext = 0;
let bassStep = 0;
const voices = new Map();

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureCtx() {
  if (ctx && ctx.state === "closed") {
    ctx = null;
    master = null;
    voices.clear();
  }
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(comp).connect(ctx.destination);
    bassBus = ctx.createGain();
    bassBus.gain.value = 0.5;
    bassBus.connect(comp);
    violinBuses = PANS.map((pan) => {
      const g = ctx.createGain();
      g.gain.value = 0.3;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(comp);
      return g;
    });
  }
  if (ctx.state === "suspended") ctx.resume();
}

function voiceOn(letter, midi) {
  ensureCtx();
  if (voices.has(letter)) return;

  const now = ctx.currentTime;
  const hz = midiToHz(midi);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.linearRampToValueAtTime(0.22, now + ATTACK);
  out.connect(master);

  const source = ctx.createGain();
  source.gain.value = 0.3;

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3200;
  source.connect(tone);

  FORMANTS.forEach((f) => {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f.hz;
    bp.Q.value = f.q;
    const g = ctx.createGain();
    g.gain.value = f.gain;
    tone.connect(bp).connect(g).connect(out);
  });
  const dry = ctx.createGain();
  dry.gain.value = 0.12;
  tone.connect(dry).connect(out);

  // A little vibrato, detuned slightly per voice so stacked notes shimmer
  // against each other like separate singers instead of locking in phase.
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 4.6 + Math.random() * 1.2;
  lfoGain.gain.value = 5 + Math.random() * 3;
  lfo.connect(lfoGain);
  lfo.start(now);

  const oscs = [-6, 0, 6].map((cents) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = hz;
    osc.detune.value = cents + (Math.random() * 4 - 2);
    lfoGain.connect(osc.detune);
    osc.connect(source);
    osc.start(now);
    return osc;
  });

  voices.set(letter, { out, oscs, lfo });
}

function voiceOff(letter) {
  const v = voices.get(letter);
  if (!v) return;
  voices.delete(letter);

  const now = ctx.currentTime;
  v.out.gain.cancelScheduledValues(now);
  v.out.gain.setValueAtTime(v.out.gain.value, now);
  v.out.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE);
  v.oscs.forEach((o) => o.stop(now + RELEASE + 0.05));
  v.lfo.stop(now + RELEASE + 0.05);
}

function allVoicesOff() {
  [...voices.keys()].forEach(voiceOff);
}

function pluckBass(midi, at) {
  const hz = midiToHz(midi);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.5, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + STEP_DUR * 0.95);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1600, at);
  lp.frequency.exponentialRampToValueAtTime(420, at + 0.7);
  lp.connect(g).connect(bassBus);

  [
    { type: "triangle", detune: 0, gain: 1.0 },
    { type: "sine", detune: -4, gain: 0.6 },
  ].forEach((spec) => {
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = hz;
    osc.detune.value = spec.detune;
    og.gain.value = spec.gain;
    osc.connect(og).connect(lp);
    osc.start(at);
    osc.stop(at + STEP_DUR + 0.1);
  });
}

function bowNote(midi, at, dur, bus) {
  const hz = midiToHz(midi);
  const end = at + dur;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.16, at + 0.07);
  g.gain.setValueAtTime(0.16, end - 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  lp.Q.value = 0.7;
  lp.connect(g).connect(bus);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 5.1;
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain);
  lfo.start(at);
  lfo.stop(end + 0.05);

  [-5, 5].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = hz;
    osc.detune.value = cents;
    lfoGain.connect(osc.detune);
    osc.connect(lp);
    osc.start(at);
    osc.stop(end + 0.05);
  });
}

function scheduleStep(step, at) {
  pluckBass(GROUND[step % GROUND.length], at);

  for (let v = 0; v < VOICE_COUNT; v += 1) {
    const idx = step - CANON_DELAY * (v + 1);
    if (idx < 0) continue;
    const notes = MELODY[idx % MELODY.length];
    const dur = STEP_DUR / notes.length;
    notes.forEach((midi, i) => {
      bowNote(midi, at + i * dur, dur * 0.96, violinBuses[v]);
    });
  }
}

// Web Audio's clock is sample-accurate but setInterval is not, so schedule
// each step slightly ahead of when it needs to sound rather than on the tick.
function pumpBass() {
  while (bassNext < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(bassStep, bassNext);
    bassStep += 1;
    bassNext += STEP_DUR;
  }
}

function bassStart() {
  ensureCtx();
  if (bassTimer !== null) return;
  bassStep = 0;
  bassNext = ctx.currentTime + 0.08;
  pumpBass();
  bassTimer = setInterval(pumpBass, 60);
}

function bassStop() {
  if (bassTimer === null) return;
  clearInterval(bassTimer);
  bassTimer = null;
}

function bassIsPlaying() {
  return bassTimer !== null;
}

// Cut everything dead with no release ramp. pagehide covers refresh, navigation
// and tab close, including the bfcache path where unload never fires.
function killAudio() {
  bassStop();
  voices.forEach((v) => {
    v.oscs.forEach((o) => o.stop());
    v.lfo.stop();
    v.out.disconnect();
  });
  voices.clear();
  if (ctx && ctx.state !== "closed") ctx.close();
}

window.addEventListener("pagehide", killAudio);
