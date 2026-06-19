let audioCtx = null;
const MUTE_KEY = "hooked_muted";
let muted = localStorage.getItem(MUTE_KEY) === "1";
let mixState = null;
let reelSound = null;
let waitDrone = null;
let tabHidden = false;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (!muted && ambientState?.wantsPlay && !ambientState.running) {
    startAmbientMusic();
  } else {
    applyAmbientMuteState();
  }
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

export function loadMutedPreference() {
  muted = localStorage.getItem(MUTE_KEY) === "1";
  return muted;
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function ensureMix() {
  if (mixState) return mixState;
  const ctx = getAudioContext();
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const musicBus = ctx.createGain();
  musicBus.gain.value = 1;
  musicBus.connect(master);

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(master);

  mixState = { master, musicBus, sfxBus };
  return mixState;
}

function duckMusic(duration = 0.4, amount = 0.42) {
  if (!ambientState?.master || isMuted() || tabHidden) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duckTo = AMBIENT_VOLUME * amount;
    ambientState.master.gain.cancelScheduledValues(now);
    ambientState.master.gain.setValueAtTime(ambientState.master.gain.value, now);
    ambientState.master.gain.linearRampToValueAtTime(duckTo, now + 0.05);
    ambientState.master.gain.linearRampToValueAtTime(AMBIENT_VOLUME, now + duration);
  } catch {
    // ignore
  }
}

function getSfxBus() {
  return ensureMix().sfxBus;
}

function createSfxBus(ctx, peak = 0.78) {
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 2400;
  soften.Q.value = 0.5;
  const bus = ctx.createGain();
  bus.gain.value = peak;
  soften.connect(bus);
  bus.connect(getSfxBus());
  return soften;
}

function randPitch(base = 1, spread = 0.12) {
  return base * (1 - spread / 2 + Math.random() * spread);
}

export async function unlockAudio() {
  await resumeAudioContext();
  if (!ambientState) {
    ambientState = { wantsPlay: true, running: false };
  } else {
    ambientState.wantsPlay = true;
  }
  if (!isMuted()) {
    await startAmbientMusic();
  }
}

// Sunny I–IV–V–I in a brighter register (C → F → G → C).
const AMBIENT_CHORDS = [
  [261.63, 329.63, 392.0, 523.25],
  [349.23, 440.0, 523.25, 659.25],
  [392.0, 493.88, 587.33, 783.99],
  [261.63, 329.63, 392.0, 523.25],
];
const AMBIENT_VOLUME = 0.068;
const CHORD_HOLD_SEC = 7;
const MELODY_LOOP_SEC = 3.2;
// Major-pentatonic scale degrees (root, 2nd, 3rd, 5th, 6th, octave).
const SUNNY_SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
const SUNNY_PHRASES = [
  [0, 2, 4, 5, 4, 2, 3, 5],
  [4, 5, 4, 2, 0, 2, 4, 5],
  [0, 2, 4, 2, 4, 5, 4, 2],
  [2, 4, 5, 4, 2, 0, 2, 4],
];

let ambientState = null;

function applyAmbientMuteState() {
  if (!ambientState?.master) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const vol = isMuted() || tabHidden ? 0 : AMBIENT_VOLUME;
    ambientState.master.gain.cancelScheduledValues(now);
    ambientState.master.gain.setValueAtTime(ambientState.master.gain.value, now);
    ambientState.master.gain.linearRampToValueAtTime(vol, now + 0.6);
  } catch {
    // ignore
  }
}

export function pauseAmbientForTab() {
  tabHidden = true;
  applyAmbientMuteState();
}

export function resumeAmbientForTab() {
  tabHidden = false;
  applyAmbientMuteState();
}

function playHappyPluck(ctx, destination, freq, start, level = 0.014, decay = 0.42) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.03, start);
  osc.frequency.exponentialRampToValueAtTime(freq, start + 0.04);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + decay + 0.05);
}

function playHappyArpeggio(ctx, destination, rootFreq) {
  if (isMuted() || !ambientState?.running) return;
  const t = ctx.currentTime;
  const pattern = [0, 2, 4, 5, 4, 2];
  const rhythm = [0, 0.22, 0.38, 0.58, 0.78, 1.02];
  pattern.forEach((degree, i) => {
    playHappyPluck(ctx, destination, rootFreq * SUNNY_SCALE[degree], t + rhythm[i], 0.013, 0.36);
  });
}

function playSunshineMelody(ctx, destination) {
  if (isMuted() || !ambientState?.running) return;
  const t = ctx.currentTime;
  const chord = AMBIENT_CHORDS[ambientState.chordIndex];
  const root = chord[0];
  const phrase = SUNNY_PHRASES[ambientState.phraseIndex % SUNNY_PHRASES.length];
  ambientState.phraseIndex = (ambientState.phraseIndex + 1) % SUNNY_PHRASES.length;

  phrase.forEach((degree, i) => {
    const start = t + i * 0.28;
    playHappyPluck(ctx, destination, root * SUNNY_SCALE[degree], start, 0.016, 0.48);
  });
}

function playGentleBounce(ctx, destination, rootFreq) {
  if (isMuted() || !ambientState?.running) return;
  const t = ctx.currentTime;
  [0, 0.5, 1, 1.5].forEach((offset, i) => {
    const start = t + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(rootFreq * 0.5, start);
    osc.frequency.exponentialRampToValueAtTime(rootFreq * 0.47, start + 0.07);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.022 : 0.013, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + 0.2);
  });
}

function advanceAmbientChord() {
  if (!ambientState?.running) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  ambientState.chordIndex = (ambientState.chordIndex + 1) % AMBIENT_CHORDS.length;
  const chord = AMBIENT_CHORDS[ambientState.chordIndex];

  ambientState.pads.forEach((voiceGroup, i) => {
    const target = chord[i] ?? chord[0];
    voiceGroup.forEach((pad) => {
      pad.osc.frequency.cancelScheduledValues(now);
      pad.osc.frequency.setValueAtTime(pad.osc.frequency.value, now);
      pad.osc.frequency.exponentialRampToValueAtTime(target, now + 2.5);
    });
  });

  playHappyArpeggio(ctx, ambientState.melodyBus, chord[0]);
  playGentleBounce(ctx, ambientState.melodyBus, chord[0]);
}

export async function startAmbientMusic() {
  if (ambientState?.running) {
    applyAmbientMuteState();
    return;
  }

  try {
    await resumeAudioContext();
    if (isMuted()) {
      if (!ambientState) ambientState = { wantsPlay: true, running: false };
      else ambientState.wantsPlay = true;
      return;
    }

    const ctx = getAudioContext();
    const t = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(AMBIENT_VOLUME, t + 3);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1680, t);
    filter.Q.value = 0.28;
    filter.connect(master);
    master.connect(ensureMix().musicBus);

    const melodyBus = ctx.createGain();
    melodyBus.gain.value = 1.12;
    melodyBus.connect(filter);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t);

    const pads = AMBIENT_CHORDS[0].map((freq) => {
      const voices = [
        { detune: 0, level: 0.022, type: "sine" },
        { detune: 6, level: 0.014, type: "triangle" },
      ];
      return voices.map(({ detune, level, type }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.value = level;
        osc.connect(gain);
        gain.connect(filter);
        osc.start(t);
        return { osc, gain };
      });
    });

    playHappyArpeggio(ctx, melodyBus, AMBIENT_CHORDS[0][0]);
    playSunshineMelody(ctx, melodyBus);
    playGentleBounce(ctx, melodyBus, AMBIENT_CHORDS[0][0]);

    const chordTimer = setInterval(advanceAmbientChord, CHORD_HOLD_SEC * 1000);
    const melodyTimer = setInterval(() => {
      if (!ambientState?.running) return;
      playSunshineMelody(getAudioContext(), ambientState.melodyBus);
    }, MELODY_LOOP_SEC * 1000);

    ambientState = {
      master,
      filter,
      melodyBus,
      pads,
      lfo,
      chordTimer,
      melodyTimer,
      chordIndex: 0,
      phraseIndex: 0,
      running: true,
      wantsPlay: true,
    };
  } catch {
    ambientState = { wantsPlay: true, running: false };
  }
}

function makeNoiseBuffer(ctx, durationSec, decay = 6) {
  const bufferSize = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.exp(-(i / bufferSize) * decay);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buffer;
}

function playNoiseLayer(ctx, t, destination, {
  duration,
  decay,
  filterType,
  filterFreq,
  filterQ = 0.7,
  gainPeak,
  attack = 0.02,
  release,
  delay = 0,
}) {
  const source = ctx.createBufferSource();
  source.buffer = makeNoiseBuffer(ctx, duration, decay);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const gain = ctx.createGain();
  const start = t + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, start + release);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(start);
  source.stop(start + release + 0.05);
}

function createSplashBus(ctx) {
  return createSfxBus(ctx, 0.72);
}

export async function playCastPlop() {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    duckMusic(0.28, 0.55);
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSplashBus(ctx, 0.65);
    const pitch = randPitch(1, 0.18);

    playNoiseLayer(ctx, t, out, {
      duration: 0.14,
      decay: 7,
      filterType: "bandpass",
      filterFreq: 520 * pitch,
      filterQ: 0.8,
      gainPeak: 0.2,
      attack: 0.012,
      release: 0.14,
    });

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(180 * pitch, t);
    thump.frequency.exponentialRampToValueAtTime(95 * pitch, t + 0.1);
    thumpGain.gain.setValueAtTime(0, t);
    thumpGain.gain.linearRampToValueAtTime(0.09, t + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    thump.connect(thumpGain);
    thumpGain.connect(out);
    thump.start(t);
    thump.stop(t + 0.18);
  } catch {
    // ignore
  }
}

export async function playFailBuzz() {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    duckMusic(0.35, 0.5);
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSfxBus(ctx, 0.7);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.42);

    playNoiseLayer(ctx, t, out, {
      duration: 0.12,
      decay: 8,
      filterType: "highpass",
      filterFreq: 900,
      filterQ: 0.6,
      gainPeak: 0.06,
      attack: 0.01,
      release: 0.12,
      delay: 0.05,
    });
  } catch {
    // ignore
  }
}

export async function playUpgradeChime() {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    duckMusic(0.5, 0.38);
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSfxBus(ctx, 0.82);
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((freq, i) => {
      const start = t + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.34);
    });

    playNoiseLayer(ctx, t, out, {
      duration: 0.08,
      decay: 10,
      filterType: "bandpass",
      filterFreq: 2200,
      filterQ: 0.9,
      gainPeak: 0.05,
      attack: 0.008,
      release: 0.1,
      delay: 0.14,
    });
  } catch {
    // ignore
  }
}

export async function playUiClick() {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSfxBus(ctx, 0.45);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    // ignore
  }
}

export function startReelSoundscape() {
  if (isMuted()) return;
  stopReelSoundscape();
  try {
    resumeAudioContext();
    ensureMix();
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 1.2, 1);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(getSfxBus());
    source.start();
    reelSound = { source, filter, gain, mode: "idle" };
  } catch {
    reelSound = null;
  }
}

export function updateReelSoundscape(hit, good) {
  if (!reelSound || isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    if (!hit) {
      reelSound.gain.gain.cancelScheduledValues(now);
      reelSound.gain.gain.linearRampToValueAtTime(0, now + 0.12);
      reelSound.mode = "idle";
      return;
    }
    if (good) {
      reelSound.filter.frequency.cancelScheduledValues(now);
      reelSound.filter.frequency.linearRampToValueAtTime(300, now + 0.08);
      reelSound.gain.gain.cancelScheduledValues(now);
      reelSound.gain.gain.linearRampToValueAtTime(0.02, now + 0.04);
      reelSound.gain.gain.linearRampToValueAtTime(0, now + 0.2);
      reelSound.mode = "good";
    } else {
      reelSound.filter.frequency.cancelScheduledValues(now);
      reelSound.filter.frequency.linearRampToValueAtTime(170, now + 0.08);
      reelSound.gain.gain.cancelScheduledValues(now);
      reelSound.gain.gain.linearRampToValueAtTime(0.028, now + 0.04);
      reelSound.gain.gain.linearRampToValueAtTime(0, now + 0.22);
      reelSound.mode = "bad";
    }
  } catch {
    // ignore
  }
}

export function updateReelTension(inZone, progress) {
  if (!reelSound || isMuted()) return;
  const now = performance.now();
  const key = `${inZone}|${Math.round(progress * 24)}`;
  if (key === updateReelTension._lastKey && now - (updateReelTension._lastAt || 0) < 72) return;
  updateReelTension._lastKey = key;
  updateReelTension._lastAt = now;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const strain = 1 - progress;
    const vol = 0.006 + strain * 0.014 + (inZone ? 0.005 : 0);
    const freq = 200 + strain * 140 + (inZone ? 35 : -15);
    reelSound.filter.frequency.cancelScheduledValues(now);
    reelSound.filter.frequency.linearRampToValueAtTime(freq, now + 0.08);
    reelSound.gain.gain.cancelScheduledValues(now);
    reelSound.gain.gain.linearRampToValueAtTime(vol, now + 0.08);
    reelSound.mode = "tension";
  } catch {
    // ignore
  }
}

export function stopReelSoundscape() {
  if (!reelSound) return;
  try {
    reelSound.source?.stop();
    reelSound.osc?.stop();
  } catch {
    // ignore
  }
  reelSound = null;
}

export function startWaitDrone() {
  if (isMuted() || waitDrone) return;
  try {
    resumeAudioContext();
    ensureMix();
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 52;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 120;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getSfxBus());
    osc.start();
    waitDrone = { osc, filter, gain };
  } catch {
    waitDrone = null;
  }
}

export function primeWaitDrone() {
  if (!waitDrone || isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    waitDrone.gain.gain.cancelScheduledValues(now);
    waitDrone.gain.gain.linearRampToValueAtTime(0.016, now + 0.45);
    waitDrone.osc.frequency.cancelScheduledValues(now);
    waitDrone.osc.frequency.linearRampToValueAtTime(54, now + 0.45);
  } catch {
    // ignore
  }
}

export function updateWaitDrone(tension) {
  if (!waitDrone || isMuted()) return;
  const now = performance.now();
  const key = Math.round(tension * 20);
  if (key === updateWaitDrone._lastKey && now - (updateWaitDrone._lastAt || 0) < 120) return;
  updateWaitDrone._lastKey = key;
  updateWaitDrone._lastAt = now;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const vol = Math.min(0.045, 0.014 + tension * 0.04);
    const freq = 48 + tension * 28;
    waitDrone.gain.gain.cancelScheduledValues(now);
    waitDrone.gain.gain.linearRampToValueAtTime(vol, now + 0.35);
    waitDrone.osc.frequency.cancelScheduledValues(now);
    waitDrone.osc.frequency.linearRampToValueAtTime(freq, now + 0.35);
  } catch {
    // ignore
  }
}

export function stopWaitDrone() {
  if (!waitDrone) return;
  try {
    waitDrone.osc?.stop();
  } catch {
    // ignore
  }
  waitDrone = null;
}

export async function playBiteSplash() {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    duckMusic(0.55, 0.35);
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSplashBus(ctx);

    // Soft kerplunk — bobber dipping into water.
    playNoiseLayer(ctx, t, out, {
      duration: 0.22,
      decay: 5.5,
      filterType: "bandpass",
      filterFreq: 480,
      filterQ: 0.75,
      gainPeak: 0.24,
      attack: 0.018,
      release: 0.22,
    });

    // Main splash wash — muffled water movement.
    playNoiseLayer(ctx, t, out, {
      duration: 0.36,
      decay: 4.8,
      filterType: "lowpass",
      filterFreq: 820,
      filterQ: 0.45,
      gainPeak: 0.26,
      attack: 0.022,
      release: 0.32,
      delay: 0.01,
    });

    // Light spray on the surface.
    playNoiseLayer(ctx, t, out, {
      duration: 0.18,
      decay: 9,
      filterType: "highpass",
      filterFreq: 1800,
      filterQ: 0.55,
      gainPeak: 0.09,
      attack: 0.03,
      release: 0.16,
      delay: 0.04,
    });

    // Gentle ripple tail.
    playNoiseLayer(ctx, t, out, {
      duration: 0.24,
      decay: 6,
      filterType: "bandpass",
      filterFreq: 620,
      filterQ: 0.65,
      gainPeak: 0.1,
      attack: 0.035,
      release: 0.2,
      delay: 0.08,
    });

    const bubble = ctx.createOscillator();
    const bubbleGain = ctx.createGain();
    bubble.type = "sine";
    bubble.frequency.setValueAtTime(95, t);
    bubble.frequency.exponentialRampToValueAtTime(62, t + 0.18);
    bubbleGain.gain.setValueAtTime(0, t);
    bubbleGain.gain.linearRampToValueAtTime(0.07, t + 0.02);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    bubble.connect(bubbleGain);
    bubbleGain.connect(out);
    bubble.start(t);
    bubble.stop(t + 0.26);
  } catch {
    // Audio blocked or unavailable — game still works silently.
  }
}

export async function playCatchReward(rarity = "common") {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    const isLegendary = rarity === "legendary";
    const isEpic = rarity === "epic";
    const isRare = rarity === "rare";
    duckMusic(isLegendary ? 0.55 : isEpic ? 0.62 : 0.7, isLegendary ? 0.55 : 0.3);
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSfxBus(ctx, isLegendary ? 1 : 0.85);

    const noteSets = {
      common: [523.25, 659.25, 783.99, 1046.5],
      uncommon: [523.25, 659.25, 783.99, 987.77, 1174.66],
      rare: [440, 554.37, 659.25, 783.99, 987.77, 1174.66],
      epic: [349.23, 440, 554.37, 659.25, 783.99, 987.77, 1174.66],
      legendary: [261.63, 329.63, 392, 523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98],
    };
    const notes = noteSets[rarity] || noteSets.common;
    const spacing = isLegendary ? 0.09 : isEpic ? 0.08 : isRare ? 0.077 : 0.075;
    const noteGain = isLegendary ? 0.26 : isEpic ? 0.23 : 0.2;

    notes.forEach((freq, i) => {
      const start = t + i * spacing;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isLegendary || isEpic ? "triangle" : "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(noteGain, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (isLegendary ? 0.55 : 0.38));

      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + (isLegendary ? 0.6 : 0.42));
    });

    if (isEpic || isLegendary) {
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = "sine";
      bass.frequency.setValueAtTime(isLegendary ? 65.41 : 82.41, t);
      bassGain.gain.setValueAtTime(0, t);
      bassGain.gain.linearRampToValueAtTime(isLegendary ? 0.14 : 0.1, t + 0.04);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + (isLegendary ? 0.9 : 0.65));
      bass.connect(bassGain);
      bassGain.connect(out);
      bass.start(t);
      bass.stop(t + (isLegendary ? 0.95 : 0.7));
    }

    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(isLegendary ? 1046.5 : 784, t + 0.22);
    shimmerGain.gain.setValueAtTime(0, t + 0.22);
    shimmerGain.gain.linearRampToValueAtTime(isLegendary ? 0.12 : 0.08, t + 0.26);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + (isLegendary ? 0.85 : 0.55));
    shimmer.connect(shimmerGain);
    shimmerGain.connect(out);
    shimmer.start(t + 0.22);
    shimmer.stop(t + (isLegendary ? 0.9 : 0.58));
  } catch {
    // Audio blocked or unavailable.
  }
}

export async function playNibblePlop() {
  if (isMuted()) return;
  try {
    await resumeAudioContext();
    ensureMix();
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const out = createSfxBus(ctx, 0.45);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch {
    // Audio blocked or unavailable.
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAmbientForTab();
    else resumeAmbientForTab();
  });
}
