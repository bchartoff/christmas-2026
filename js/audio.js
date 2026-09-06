// Pachelbel's ground bass: D A B F# G D G A, at the octaves the cello part
// carries. A voice sings it whenever anyone is held -- it is the most
// recognisable line in the piece, and leaving it merely implied by the
// harmony was most of why the choir did not sound like the Canon.
const GROUND = [50, 45, 47, 42, 43, 38, 43, 45];
const STEP_DUR = 1.25;
const LOOKAHEAD = 0.35;
// 24 units to a ground step: quarter 12, eighth 6, sixteenth 3, triplet 8.
// At 12 a sixteenth was 1.5 units, so neither sixteenths nor triplets could
// be written at all.
const UNITS_PER_STEP = 24;
const CYCLE_UNITS = GROUND.length * UNITS_PER_STEP; // one full ground statement

const CHORD_SETS = {
  2: [2, 6, 9, 11],
  9: [9, 1, 4, 11],
  11: [11, 2, 6, 9],
  6: [6, 9, 1, 4],
  7: [7, 11, 2, 4],
};

// Full D major, not just chord tones. Pachelbel's lines are overwhelmingly
// stepwise, and stepwise motion needs the passing notes between chord tones.
const SCALE_PCS = [2, 4, 6, 7, 9, 11, 1];
const SCALE = [];
for (let m = 38; m <= 93; m += 1) {
  if (SCALE_PCS.includes(m % 12)) SCALE.push(m);
}

// Every figure below is transcribed from the Canon itself, parsed out of the
// Mutopia Project's edition of the full three-violin score (CC BY 4.0) and cut
// at the ground, which is 192 units here. Statement 0 comes out as
// F# E D C# B A B C#, the opening everyone knows.
//
// The score has one melody line, not three: its own comment reads "It's a canon
// so I'm writing it only once", with the violins differing solely in how many
// bars they rest first. That is why the parts here share a vocabulary and are
// separated only by which figures suit their register and by when they enter.
//
// Twenty-two usable statements survive the parse -- enough that all eighteen
// letters get a different one. Contours are counted in scale steps and centred
// on the voice's own note, so a phrase sits in that singer's register; each note
// is then re-pitched to whatever chord it lands on.
const VARIATIONS = [
  // 0 -- statement 1: 8 notes
  { rhythm: [24, 24, 24, 24, 24, 24, 24, 24],
    contour: [3, 2, 1, 0, -1, -2, -1, -3] },
  // 1 -- statement 10: 8 notes
  { rhythm: [12, -12, 12, -12, 12, -12, 12, -12, 12, -12, 12, -12, 12, -12, 12, -12],
    contour: [4, 3, 2, 4, -3, -3, -3, -2] },
  // 2 -- statement 11: 8 notes
  { rhythm: [-12, 12, -12, 12, -12, 12, -12, 12, -12, 12, -12, 12, -12, 12, -12, 12],
    contour: [0, 0, -2, 0, -1, -2, -1, 4] },
  // 3 -- statement 6: 9 notes
  { rhythm: [12, 12, 24, -12, 12, 24, 24, 24, 24, 24],
    contour: [-7, 0, -1, -2, 0, 3, 2, 3, 4] },
  // 4 -- statement 7: 11 notes
  { rhythm: [12, 12, 24, -12, 12, 24, 36, 12, 12, 12, 12, 12],
    contour: [6, -1, -2, -3, -1, -1, -1, -1, 2, 0, 3] },
  // 5 -- statement 18: 10 notes
  { rhythm: [36, 12, 36, 12, 24, 24, 12, 12, 18, 6],
    contour: [2, 2, -2, 2, 1, 2, 1, -2, -2, -3] },
  // 6 -- statement 24: 10 notes
  { rhythm: [24, 18, 6, 24, 18, 6, 36, 12, 24, 24],
    contour: [5, -2, -3, -4, 3, 2, 1, 1, 1, 0] },
  // 7 -- statement 0: 8 notes
  { rhythm: [24, 24, 24, 24, 24, 24, 24, 24],
    contour: [3, 2, 1, 0, -1, -2, -1, 0] },
  // 8 -- statement 19: 11 notes
  { rhythm: [12, 12, 24, 24, 24, 18, 6, 24, 24, 18, 6],
    contour: [-3, 4, 3, 2, 1, -3, -2, -1, 2, -2, -2] },
  // 9 -- statement 22: 11 notes
  { rhythm: [12, 24, 24, 24, 12, 12, 24, 12, 18, 6, 24],
    contour: [3, 3, 2, 1, 0, 0, -1, -2, -2, -3, -3] },
  // 10 -- statement 2: 16 notes
  { rhythm: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
    contour: [-2, 0, 2, 1, 0, -2, 0, -1, -2, -4, -2, 2, 1, 3, 2, 1] },
  // 11 -- statement 3: 16 notes
  { rhythm: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 18, 6],
    contour: [-3, -5, -4, 1, 2, 4, 6, -1, 0, -2, -1, -3, -5, 2, 2, 1] },
  // 12 -- statement 12: 32 notes
  { rhythm: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    contour: [7, 0, 1, 0, -1, 6, 7, 6, 5, 0, -2, 3, 2, -5, -6, -5, -4, 3, 4, 3, 2, -5, -6, -5, -4, 3, 2, 3, 4, -3, -4, -3] },
  // 13 -- statement 13: 32 notes
  { rhythm: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    contour: [-5, 2, 3, 2, 1, -6, -5, -6, -7, 0, -1, 0, 1, -6, -3, -4, -5, 2, 3, 5, 4, -3, -1, 4, 2, 5, 4, 5, 3, -1, -2, -1] },
  // 14 -- statement 14: 32 notes
  { rhythm: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    contour: [-2, 0, 0, 0, 0, 0, 0, 0, -2, -2, -2, -2, -2, -2, 0, 0, -1, -1, -1, 3, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 4, 2] },
  // 15 -- statement 4: 32 notes
  { rhythm: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    contour: [2, 1, 2, -5, -6, -1, -4, -3, -5, 2, 1, 0, 1, 4, 6, 7, 5, 4, 3, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -2, -3, -4] },
  // 16 -- statement 16: 40 notes
  { rhythm: [6, 3, 3, 6, 6, 6, 3, 3, 6, 6, 6, 3, 3, 6, 6, 6, 3, 3, 6, 6, 6, 3, 3, 6, 6, 6, 3, 3, 6, 6, 6, 3, 3, 6, 6, 6, 3, 3, 6, 6],
    contour: [5, -2, -1, 0, -2, -3, 4, 5, 6, 4, 3, -4, -3, -2, -4, -3, 2, 1, 0, -1, -2, 1, 0, -1, 1, 0, -2, -1, 0, 2, 1, 3, 2, 1, 0, -1, 2, 1, 0, -1] },
  // 17 -- statement 9: 56 notes
  { rhythm: [6, 3, 3, 6, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 3, 3, 6, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 3, 3, 6, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 3, 3, 6, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    contour: [3, 1, 2, 3, 2, 1, 2, 0, 1, 2, 3, 2, 1, 0, 1, -1, 0, 1, -6, -5, -4, -3, -4, -5, -4, 1, 0, 1, -1, 1, 0, -1, -2, -3, -2, -3, -4, -3, -2, -1, 0, 1, -1, 1, 0, 1, 0, -1, 0, 1, 2, 1, 0, 1, -1, 0] },
];

// Sung-vowel formants for /u/, which sit lower and tighter than the spoken
// tables most formant charts give. [hz, bandwidth, gain]
const PARTS = [
  {
    top: 55,
    vowel: [[300, 60, 1.0], [870, 90, 0.16], [2240, 190, 0.02], [2600, 220, 0.008]],
    vars: [0, 1, 2, 3, 4, 5],
    pan: -0.5,
  },
  {
    top: 63,
    vowel: [[300, 60, 1.0], [870, 90, 0.2], [2240, 190, 0.026], [2640, 220, 0.01]],
    vars: [6, 7, 8],
    pan: -0.18,
  },
  {
    top: 71,
    vowel: [[370, 70, 1.0], [950, 100, 0.25], [2670, 200, 0.03], [3060, 240, 0.012]],
    vars: [9, 10, 17, 12, 16],
    pan: 0.18,
  },
  {
    top: 128,
    vowel: [[370, 70, 1.0], [950, 100, 0.3], [2670, 200, 0.04], [3060, 240, 0.015]],
    vars: [14, 15, 13, 11],
    pan: 0.5,
  },
];

let ctx = null;
let choir = null;
let dry = null;
let wet = null;
let breath = null;
let ground = null;
let groundOn = false;
let timer = null;
let nextTime = 0;
let step = 0;
let noteListener = null;
const held = new Map();
const waves = new Map();

// The scheduler already knows when every voice sings; the visuals just listen
// in rather than trying to reconstruct the rhythm on their own.
function setNoteListener(fn) {
  noteListener = fn;
}

function audioTime() {
  return ctx ? ctx.currentTime : 0;
}

// A stone-room impulse: noise under an exponential decay, decorrelated between
// channels so the tail spreads rather than sitting in the middle.
function makeImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Letters sitting a fixed interval apart collide under any linear function of
// their pitch, which is precisely the case for neighbours in the same part.
// Hashing the letter itself is independent of where its note sits.
function hashOf(letter) {
  return Math.imul(letter.charCodeAt(0), 2654435761) >>> 0;
}

function partFor(midi) {
  return PARTS.find((p) => midi <= p.top) || PARTS[PARTS.length - 1];
}

// Deal each part's figures round-robin down its letters rather than hashing
// them. A hash clumps: it put three of the six low voices on one figure while
// leaving others unused, and the opening theme on a single letter.
//
// Pools mostly run slowest to busiest down the part, but the two busiest
// figures are placed on I and L rather than on the top two sopranos. Those
// letters appear in six names each where O and Y appear in four and one, so
// the liveliest writing is heard far more often.
const FIGURE_OF = (() => {
  const seen = new Map();
  const out = new Map();
  LETTER_NOTES.forEach((d) => {
    const part = partFor(d.midi);
    const i = seen.get(part) || 0;
    seen.set(part, i + 1);
    out.set(d.letter, part.vars[i % part.vars.length]);
  });
  return out;
})();

// Build the vowel directly into the oscillator's spectrum instead of filtering
// a sawtooth. Resonant filters ring, and that ringing on a buzzy source is
// what reads as rasp -- here the harmonics are simply weighted and there is
// nothing above them to filter out.
function vowelWave(midi, part) {
  const key = `${part.top}:${midi}`;
  if (waves.has(key)) return waves.get(key);

  const f0 = midiToHz(midi);
  const n = 24;
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  for (let k = 1; k <= n; k += 1) {
    const f = f0 * k;
    let a = 0;
    part.vowel.forEach(([F, B, g]) => {
      a += g / (1 + Math.pow((f - F) / (B / 2), 2));
    });
    a *= Math.pow(k, -1.1); // glottal roll-off
    a *= Math.exp(-Math.pow(f / 2600, 2)); // no energy left in the harsh band
    imag[k] = a;
  }
  const w = ctx.createPeriodicWave(real, imag);
  waves.set(key, w);
  return w;
}

// Strong beats take chord tones, weaker ones may pass through the scale. That
// is the ordinary rule of Baroque part-writing, and it is what lets the lines
// move by step without the result turning sour.
function pitchAt(anchor, unit, offset, len) {
  const s = Math.floor(unit / UNITS_PER_STEP) % GROUND.length;
  const tones = CHORD_SETS[GROUND[s] % 12];
  let base = 0;
  while (base + 1 < SCALE.length && SCALE[base + 1] <= anchor) base += 1;
  let i = Math.min(SCALE.length - 1, Math.max(0, base + offset));
  // Anchor by weight, not just position: anything sustained has to be a chord
  // tone, while quick notes are free to pass between them.
  const structural = len >= 12 || unit % 12 === 0;
  if (structural && !tones.includes(SCALE[i] % 12)) {
    const up = i + 1 < SCALE.length && tones.includes(SCALE[i + 1] % 12);
    i = up ? i + 1 : Math.max(0, i - 1);
  }
  return SCALE[i];
}

function ensureCtx() {
  if (ctx && ctx.state === "closed") {
    ctx = null;
    held.clear();
    waves.clear();
  }
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3.5;
    comp.knee.value = 22;

    // Damping the top makes the room read as stone rather than glass, and
    // takes the edge off the upper formants at the same time.
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 3200;
    shelf.gain.value = -7;
    shelf.connect(comp).connect(ctx.destination);

    choir = ctx.createGain();
    choir.gain.value = 0.62;

    // A choir is never heard in a small dry room, and a dry synthetic voice
    // reads as synthetic however carefully its spectrum is modelled. The
    // space does as much of the work here as the vowel does.
    dry = ctx.createGain();
    dry.gain.value = 0.5;
    choir.connect(dry).connect(shelf);

    const predelay = ctx.createDelay(0.2);
    predelay.delayTime.value = 0.028;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2400;
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(3.4, 2.4);
    wet = ctx.createGain();
    wet.gain.value = 0.55;
    choir.connect(predelay).connect(damp).connect(verb).connect(wet).connect(shelf);

    const groundChannel = ctx.createGain();
    groundChannel.gain.value = 1.15;
    groundChannel.connect(choir);
    ground = { part: PARTS[0], channel: groundChannel };

    breath = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const air = breath.getChannelData(0);
    for (let i = 0; i < air.length; i += 1) air[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
}

function singOo(midi, at, dur, v) {
  const part = v.part;
  const att = Math.min(0.3, dur * 0.5);
  const rel = Math.min(0.7, dur * 1.1);
  const end = at + dur;
  const peak = 0.16 + 0.07 * Math.min(1, dur / STEP_DUR);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.linearRampToValueAtTime(peak, at + att);
  out.gain.setValueAtTime(peak, Math.max(at + att + 0.01, end - rel * 0.35));
  out.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  out.connect(v.channel);

  // A gently wandering resonance. The vowel is baked into the waveform, so
  // nothing else here moves; without this the tone sits perfectly still,
  // which is the tell that no throat is producing it.
  const wobble = ctx.createBiquadFilter();
  wobble.type = "peaking";
  wobble.frequency.value = part.vowel[1][0];
  wobble.Q.value = 1.6;
  wobble.gain.value = 4.5;
  wobble.connect(out);

  const wLfo = ctx.createOscillator();
  const wDepth = ctx.createGain();
  wLfo.frequency.value = 0.7 + Math.random() * 0.9;
  wDepth.gain.value = 55;
  wLfo.connect(wDepth).connect(wobble.frequency);
  wLfo.start(at);
  wLfo.stop(end + rel + 0.05);

  const vib = ctx.createOscillator();
  const vibGain = ctx.createGain();
  vib.frequency.value = 4.6 + Math.random() * 0.8;
  vibGain.gain.setValueAtTime(0, at);
  vibGain.gain.linearRampToValueAtTime(6, at + Math.min(0.6, dur * 0.9));
  vib.connect(vibGain);
  vib.start(at);
  vib.stop(end + rel + 0.05);

  // Two voices per part rather than one. A single oscillator is a soloist;
  // the small pitch disagreement between two is most of what says "several
  // people are singing this line".
  const wave = vowelWave(midi, part);
  [-6, 6].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.value = midiToHz(midi);
    osc.detune.value = cents + (Math.random() * 5 - 2.5);
    vibGain.connect(osc.detune);
    osc.connect(wobble);
    osc.start(at);
    osc.stop(end + rel + 0.05);
  });

  // Breath. Inaudible on its own; its absence is what sounds airless.
  const air = ctx.createBufferSource();
  air.buffer = breath;
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = "bandpass";
  airFilter.frequency.value = part.vowel[1][0] * 1.4;
  airFilter.Q.value = 0.7;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.05;
  air.connect(airFilter).connect(airGain).connect(out);
  air.start(at);
  air.stop(end + rel + 0.05);
}

// A figure shorter than the statement simply repeats until the statement is
// full. It still never sounds twice the same, because each note is pitched
// against whichever chord it lands on -- one figure, eight harmonisations,
// which is the Canon's own principle.
function notesForCycle(v) {
  const spec = VARIATIONS[v.variation];
  const span = spec.rhythm.reduce((a, b) => a + Math.abs(b), 0);
  const notes = [];
  let base = 0;
  let n = 0;
  while (base < CYCLE_UNITS) {
    let u = 0;
    spec.rhythm.forEach((len) => {
      if (len > 0) {
        notes.push({ u: base + u, len, off: spec.contour[n % spec.contour.length] });
        n += 1;
      }
      u += Math.abs(len);
    });
    base += span;
  }
  return notes;
}

function scheduleStep(s, at) {
  const unit = STEP_DUR / UNITS_PER_STEP;
  const cycle = Math.floor(s / GROUND.length);
  const local = s % GROUND.length;

  singOo(GROUND[local], at, STEP_DUR * 0.98, ground);

  held.forEach((v, letter) => {
    if (v.cycle !== cycle) {
      v.cycle = cycle;
      v.notes = notesForCycle(v);
    }
    v.notes.forEach((nt) => {
      const u = nt.u;
      if (Math.floor(u / UNITS_PER_STEP) !== local) return;
      const absUnit = cycle * CYCLE_UNITS + u;
      const when = at + (u - local * UNITS_PER_STEP) * unit;
      const dur = nt.len * unit * 0.96;
      singOo(pitchAt(v.midi, absUnit, nt.off, nt.len), when, dur, v);
      if (noteListener) noteListener(letter, when, dur);
    });
  });
}

// Web Audio's clock is sample-accurate but setInterval is not, so schedule
// each step slightly ahead of when it needs to sound rather than on the tick.
function pump() {
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(step, nextTime);
    step += 1;
    nextTime += STEP_DUR;
  }
}

function startEngine() {
  ensureCtx();
  if (timer !== null) return;
  step = 0;
  nextTime = ctx.currentTime + 0.08;
  pump();
  timer = setInterval(pump, 60);
}

function stopEngine() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

function engineRunning() {
  return timer !== null;
}

// The ground can keep going with nobody held, so the piece is already under
// way before the first caroler is lit.
function startGround() {
  ensureCtx();
  groundOn = true;
  startEngine();
}

function stopGround() {
  groundOn = false;
  if (held.size === 0) stopEngine();
}

function holdLetter(letter, midi) {
  ensureCtx();
  const part = partFor(midi);

  // Each singer keeps one panned channel for as long as they are held, rather
  // than every note building its own. Choirs stand in sections, and a line
  // that wandered across the stage between notes would not read as one voice.
  const channel = ctx.createGain();
  const panner = ctx.createStereoPanner();
  panner.pan.value = part.pan + (((hashOf(letter) >>> 16) % 100) / 100 - 0.5) * 0.24;
  channel.connect(panner).connect(choir);

  held.set(letter, {
    midi,
    part,
    channel,
    // Fixed for as long as the letter is held. Rotating between figures left a
    // caroler with no identity -- a voice would set up a run of sixteenths and
    // then abandon it a few bars later for something slower.
    variation: FIGURE_OF.get(letter),
    cycle: -1,
    notes: [],
  });
  startEngine();
}

function releaseLetter(letter) {
  const v = held.get(letter);
  held.delete(letter);
  // Let whatever is still sounding ring out through the room before the
  // channel is torn down.
  if (v) setTimeout(() => v.channel.disconnect(), 5000);
  if (held.size === 0 && !groundOn) stopEngine();
}

function releaseAllLetters() {
  held.forEach((v) => setTimeout(() => v.channel.disconnect(), 5000));
  held.clear();
  if (!groundOn) stopEngine();
}

// Cut everything dead with no release ramp. pagehide covers refresh, navigation
// and tab close, including the bfcache path where unload never fires.
function killAudio() {
  stopEngine();
  groundOn = false;
  held.clear();
  if (ctx && ctx.state !== "closed") ctx.close();
}

window.addEventListener("pagehide", killAudio);
