import { CONFIG, RARITY_COLORS, getRodVisual, getRodEffect } from "./config.js";
import { getGearEffects } from "./player.js";
import { rollFish, rollCastSurface, getBiteDelayMs } from "./fish.js";
import { drawFishSprite } from "./fish-render.js";

export const GameState = {
  IDLE: "idle",
  CASTING: "casting",
  WAITING: "waiting",
  BITING: "biting",
  REELING: "reeling",
  CAUGHT: "caught",
};

export class FishingGame {
  static BASE_W = 720;
  static BASE_H = 480;
  static CAST_DURATION_MS = 380;

  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    this.callbacks = callbacks;
    this._shadeCache = new Map();
    this._gradients = null;
    this._frame = null;
    this._fishingZone = null;

    this.state = GameState.IDLE;
    this.gear = { rod: 1, line: 1, bait: 1 };
    this.bobber = null;
    this.ripples = [];
    this.fishShadows = [];
    this.pendingFish = null;
    this.biteTimer = null;
    this.biteAutoTimer = null;
    this.caughtReleaseTimer = null;
    this.biteDelayMs = 0;
    this.nibbles = [];
    this.bobberNibble = 0;
    this.reelProgress = 0;
    this.reelMarker = 0.5;
    this.reelPhase = 0;
    this.reelPhaseSpeed = 0.02;
    this.reeling = false;
    this.castAnim = null;
    this.caughtFish = null;
    this.caughtTimer = 0;
    this.hookedFishPos = null;
    this.surfaceFish = null;
    this.fishSurfaced = false;
    this.catchSwing = 0;
    this.reelGrace = 0;
    this.reelHitPulse = 0;
    this.reelMissPulse = 0;
    this._lastReelUiKey = "";
    this._lastWaitPulseKey = "";
    this._skyBucket = -1;
    this._waterBucket = -1;
    this.screenShake = 0;
    this.biteAt = 0;
    this.caughtReward = null;
    this._running = true;
    this._dpr = 1;
    this._resizeObserver = null;

    this.dockY = 0;
    this.waterTop = 0;
    this.fishermanSway = 0;
    this.waterTime = 0;
    this.worldClock = performance.now();
    this._lastFrameTime = this.worldClock;
    this.DAY_MS = 5 * 60 * 1000;
    this.NIGHT_MS = 5 * 60 * 1000;
    this.TRANSITION_MS = 25 * 1000;
    this.RAIN_CYCLE_MS = 15 * 60 * 1000;
    this.RAIN_DURATION_MS = 2 * 60 * 1000;
    this.rainDrops = [];
    this._initRainDrops();
    this.particles = [];
    this.seagulls = [
      { x: 120, yRatio: 0.17, speed: 0.34, flap: Math.random() * 10, dir: 1, size: 1 },
      { x: 380, yRatio: 0.13, speed: 0.26, flap: Math.random() * 10, dir: -1, size: 0.85 },
      { x: 560, yRatio: 0.19, speed: 0.3, flap: Math.random() * 10, dir: 1, size: 0.92 },
    ];
    this.fireflies = Array.from({ length: 16 }, () => ({
      x: Math.random(),
      yRatio: 0.55 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.02,
    }));
    this.bannerPlane = {
      x: -140,
      yRatio: 0.2,
      speed: 1.25,
      dir: 1,
      phase: 0,
      width: 170,
    };

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onResize = this._onResize.bind(this);

    canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("resize", this._onResize);
    document.addEventListener("visibilitychange", this._onVisibilityChange.bind(this));

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(canvas);
    }

    this._spawnFishShadows();
    this.sharkFins = null;
    this._resizeCanvas();
    this._loop = this._loop.bind(this);
    this._rafId = requestAnimationFrame(this._loop);
  }

  setCaughtReward(amount) {
    this.caughtReward = amount;
  }

  setGear(gear) {
    this.gear = gear;
    this._fishingZone = null;
  }

  _onVisibilityChange() {
    this._running = document.visibilityState === "visible";
    if (this._running) {
      this._lastFrameTime = performance.now();
      if (!this._rafId) this._rafId = requestAnimationFrame(this._loop);
    }
  }

  _onResize() {
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const dprCap = window.matchMedia?.("(pointer: coarse)")?.matches ? 1.5 : 1.75;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const bufferW = Math.round(FishingGame.BASE_W * dpr);
    const bufferH = Math.round(FishingGame.BASE_H * dpr);

    if (this.canvas.width !== bufferW || this.canvas.height !== bufferH || this._dpr !== dpr) {
      this.canvas.width = bufferW;
      this.canvas.height = bufferH;
      this._dpr = dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._gradients = null;
      this._fishingZone = null;
      this._skyBucket = -1;
      this._waterBucket = -1;
      this._ensureLayout();
    }
  }

  destroy() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("resize", this._onResize);
    this._resizeObserver?.disconnect();
    clearTimeout(this.biteTimer);
    clearTimeout(this.biteAutoTimer);
  }

  _scheduleWaitNibbles(delayMs) {
    this.nibbles = [];
    const count = delayMs < 8000 ? 1 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      this.nibbles.push({
        at: delayMs * (0.22 + Math.random() * 0.48 + i * 0.12),
        fired: false,
      });
    }
  }

  _getGearFightEase(fish) {
    if (!fish) return 0;
    const { rod, line, bait } = getGearEffects(this.gear);
    const fishWeight = Math.max(0.15, fish.weight ?? 0.5);

    const capacityRatio = line.maxWeight / fishWeight;
    const capacityEase =
      capacityRatio >= 1 ? Math.min(0.24, 0.06 + (capacityRatio - 1) * 0.14) : 0;

    const lineEase = line.reelEase * 2.4;
    const rodEase = rod.rareBonus * 2.2 + Math.min(0.14, (this.gear.rod - 1) * 0.003);
    const baitEase = Math.min(0.1, bait.rewardBonus * 0.25 + (this.gear.bait - 1) * 0.002);

    return Math.min(0.58, lineEase + capacityEase + rodEase + baitEase);
  }

  _getFishFightTier() {
    const fish = this.pendingFish;
    if (!fish) return 0.12;
    const logReward = Math.log10(Math.max(1, fish.reward ?? 1));
    const rewardNorm = Math.min(1, logReward / 3.7);
    const weightNorm = Math.min(1, (fish.weight ?? 0.5) / 13);
    const diffNorm = Math.min(1, (fish.difficulty ?? 0.3) / 0.95);
    const raw = rewardNorm * 0.45 + weightNorm * 0.35 + diffNorm * 0.35;
    const ease = this._getGearFightEase(fish);
    return Math.max(0.03, Math.min(1, raw - ease));
  }

  _getReelZoneBounds() {
    const tier = this._getFishFightTier();
    const ease = this._getGearFightEase(this.pendingFish);
    const halfWidth = Math.max(0.05, 0.12 - tier * 0.075 + ease * 0.04);
    const center = 0.5;
    return { min: center - halfWidth, max: center + halfWidth };
  }

  _isInReelZone(marker, padding = 0) {
    const { min, max } = this._getReelZoneBounds();
    return marker >= min - padding && marker <= max + padding;
  }

  _getReelMarkerSpeed() {
    const tier = this._getFishFightTier();
    const ease = this._getGearFightEase(this.pendingFish);
    const caught = this.callbacks.getCatchCount?.() ?? 0;
    const catchRamp = Math.min(caught / 22, 1) * 0.0042;
    const base = 0.0125 + tier * 0.042 + catchRamp;
    return base * 2.45 * (1 - ease * 0.2);
  }

  _syncReelZoneUi() {
    const { min, max } = this._getReelZoneBounds();
    this.callbacks.onReelZoneChange?.(min, max);
  }

  _addShake(amount) {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  _ensureLayout() {
    const dockY = FishingGame.BASE_H * 0.42;
    const waterTop = dockY + 16;
    if (this.dockY !== dockY || this.waterTop !== waterTop) {
      this.dockY = dockY;
      this.waterTop = waterTop;
      this._gradients = null;
      this._fishingZone = null;
    }
  }

  _ensureGradients() {
    if (this._gradients) return this._gradients;
    const top = this.waterTop;
    const water = this.ctx.createLinearGradient(0, top, 0, FishingGame.BASE_H);
    water.addColorStop(0, "#3db5e8");
    water.addColorStop(0.12, "#2a9fd4");
    water.addColorStop(0.38, "#1a7ab5");
    water.addColorStop(0.68, "#0d5f8f");
    water.addColorStop(1, "#052f4a");
    const waterNight = this.ctx.createLinearGradient(0, top, 0, FishingGame.BASE_H);
    waterNight.addColorStop(0, "#1a6a96");
    waterNight.addColorStop(0.2, "#0d4a6e");
    waterNight.addColorStop(0.55, "#062540");
    waterNight.addColorStop(1, "#021520");
    this._gradients = { water, waterNight };
    return this._gradients;
  }

  _getWorldTime() {
    return performance.now() - this.worldClock;
  }

  _getDayNightMix() {
    const cycle = this.DAY_MS + this.NIGHT_MS;
    const pos = this._getWorldTime() % cycle;
    const transition = Math.min(this.TRANSITION_MS, this.DAY_MS * 0.15, this.NIGHT_MS * 0.15);

    if (pos < this.DAY_MS - transition) return 0;
    if (pos < this.DAY_MS) return (pos - (this.DAY_MS - transition)) / transition;
    if (pos < cycle - transition) return 1;
    return 1 - (pos - (cycle - transition)) / transition;
  }

  _isRaining() {
    const pos = this._getWorldTime() % this.RAIN_CYCLE_MS;
    return pos < this.RAIN_DURATION_MS;
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _lerpColor(c1, c2, t) {
    const parse = (hex) => {
      const n = parseInt(hex.replace("#", ""), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const [r1, g1, b1] = parse(c1);
    const [r2, g2, b2] = parse(c2);
    const r = Math.round(this._lerp(r1, r2, t));
    const g = Math.round(this._lerp(g1, g2, t));
    const b = Math.round(this._lerp(b1, b2, t));
    return `rgb(${r},${g},${b})`;
  }

  _initRainDrops() {
    this.rainDrops = Array.from({ length: 78 }, () => ({
      x: Math.random() * FishingGame.BASE_W,
      y: Math.random() * FishingGame.BASE_H,
      len: 7 + Math.random() * 11,
      speed: 7 + Math.random() * 7,
      alpha: 0.18 + Math.random() * 0.32,
    }));
  }

  _updateRain(dt) {
    if (!this._isRaining()) return;

    const scale = dt / 16.67;
    for (const drop of this.rainDrops) {
      drop.y += drop.speed * scale;
      drop.x += 1.8 * scale;
      if (drop.y > FishingGame.BASE_H + drop.len) {
        drop.y = -drop.len - Math.random() * 40;
        drop.x = Math.random() * FishingGame.BASE_W;
      }
      if (drop.x > FishingGame.BASE_W) drop.x -= FishingGame.BASE_W;
    }

    if (Math.random() < 0.04) {
      this.ripples.push({
        x: Math.random() * FishingGame.BASE_W,
        y: this.waterTop + 12 + Math.random() * (FishingGame.BASE_H - this.waterTop - 24),
        r: 2 + Math.random() * 2,
        alpha: 0.28 + Math.random() * 0.15,
      });
    }
  }

  _drawStars(nightMix) {
    if (nightMix < 0.2) return;

    const t = this._getWorldTime() * 0.001;
    this.ctx.fillStyle = `rgba(255,255,255,${0.15 + nightMix * 0.55})`;
    for (let i = 0; i < 42; i++) {
      const sx = (i * 97 + 30) % FishingGame.BASE_W;
      const sy = (i * 53 + 12) % (this.waterTop - 18);
      const twinkle = 0.55 + Math.sin(t * 2 + i) * 0.45;
      this.ctx.globalAlpha = twinkle * nightMix;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy + 8, i % 3 === 0 ? 1.4 : 0.9, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  _drawCelestialBody(nightMix) {
    const cx = FishingGame.BASE_W * 0.82;
    const cy = this.waterTop * 0.28;

    if (nightMix < 0.85) {
      const sunAlpha = 1 - nightMix;
      this.ctx.fillStyle = `rgba(255, 230, 120, ${sunAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = `rgba(255, 245, 200, ${sunAlpha * 0.35})`;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (nightMix > 0.15) {
      this.ctx.fillStyle = `rgba(230, 235, 255, ${nightMix * 0.9})`;
      this.ctx.beginPath();
      this.ctx.arc(cx - 6, cy - 4, 14, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = `rgba(15, 23, 42, ${nightMix})`;
      this.ctx.beginPath();
      this.ctx.arc(cx + 4, cy - 6, 12, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  _drawEnvironmentBadge() {
    const nightMix = this._getDayNightMix();
    const raining = this._isRaining();
    const icon = raining ? "🌧" : nightMix > 0.5 ? "🌙" : "☀";
    const label = raining ? "Rain" : nightMix > 0.5 ? "Night" : "Day";
    const x = 12;
    const y = 12;
    const badgeW = 72;

    this.ctx.save();
    this.ctx.fillStyle = "rgba(8, 20, 40, 0.78)";
    this.ctx.strokeStyle = "rgba(255,255,255,0.16)";
    this.ctx.lineWidth = 1;
    this._roundRect(x, y, badgeW, 24, 10);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.font = "11px Fredoka, sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(icon, x + 9, y + 12);
    this.ctx.font = "600 11px Fredoka, sans-serif";
    this.ctx.fillStyle = raining ? "#93c5fd" : nightMix > 0.5 ? "#c4b5fd" : "#fde68a";
    this.ctx.fillText(label, x + 26, y + 12);
    this.ctx.restore();
  }

  _drawRainSurfaceSplashes() {
    const wt = this.waterTop;
    const t = this.waterTime;
    this.ctx.save();
    this.ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      const sx = (t * 90 + i * 53) % FishingGame.BASE_W;
      const phase = (t * 2.4 + i * 0.55) % 1;
      if (phase > 0.82) continue;
      const alpha = (1 - phase / 0.82) * 0.42;
      const r = 1.5 + phase * 7;
      this.ctx.strokeStyle = `rgba(210, 235, 255, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.ellipse(sx, wt + 3, r, r * 0.32, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  _drawRain() {
    if (!this._isRaining()) return;

    this.ctx.save();
    this.ctx.lineWidth = 1.1;
    this.ctx.lineCap = "round";
    for (const drop of this.rainDrops) {
      this.ctx.strokeStyle = `rgba(175, 210, 255, ${drop.alpha})`;
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x - 2.5, drop.y + drop.len);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = "rgba(35, 50, 75, 0.16)";
    this.ctx.fillRect(0, 0, FishingGame.BASE_W, FishingGame.BASE_H);
    this._drawRainSurfaceSplashes();
    this.ctx.restore();
  }

  _spawnSplashParticles(x, y) {
    for (let i = 0; i < 14; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const speed = 1.2 + Math.random() * 3.2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        life: 20 + Math.random() * 18,
        maxLife: 38,
        size: 1.2 + Math.random() * 2.2,
        hue: 195 + Math.random() * 25,
        kind: "splash",
      });
    }
  }

  _spawnCelebrateParticles(x, y, hexColor, intensity = 1) {
    const palette = [hexColor, "#ffd24a", "#ffffff", "#38bdf8", "#4ade80"];
    const count = Math.round(28 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 4.5) * (0.85 + intensity * 0.25);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.2 * intensity,
        life: 35 + Math.random() * 40,
        maxLife: 75,
        size: (2 + Math.random() * 3.5) * (intensity > 1.2 ? 1.15 : 1),
        color: palette[i % palette.length],
        kind: "celebrate",
      });
    }
  }

  _updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.kind === "splash" ? 0.14 : 0.06;
      p.vx *= 0.98;
      p.life -= 1;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  _drawParticles() {
    if (!this.particles.length) return;

    this.ctx.save();
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.35));
      if (p.kind === "splash") {
        this.ctx.fillStyle = `hsla(${p.hue}, 80%, 88%, ${alpha * 0.75})`;
      } else {
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = p.color;
      }
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife + 0.3), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
    this.ctx.restore();
  }

  _drawDistantHills(nightMix) {
    const top = this.waterTop;
    const w = FishingGame.BASE_W;
    const back = this._lerpColor("#2a5240", "#0c1828", nightMix);
    const front = this._lerpColor("#3f8a62", "#142636", nightMix);
    const mid = this._lerpColor("#347a58", "#102a38", nightMix);

    this.ctx.fillStyle = back;
    this.ctx.beginPath();
    this.ctx.moveTo(0, top);
    for (let x = 0; x <= w; x += 24) {
      const h = top - 28 - Math.sin(x * 0.006 + 0.4) * 18 - Math.sin(x * 0.015 + 1.2) * 10;
      this.ctx.lineTo(x, h);
    }
    this.ctx.lineTo(w, top);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = mid;
    this.ctx.beginPath();
    this.ctx.moveTo(0, top);
    for (let x = 0; x <= w; x += 20) {
      const h = top - 16 - Math.sin(x * 0.01 + 2.1) * 11 - Math.sin(x * 0.024 + 0.5) * 6;
      this.ctx.lineTo(x, h);
    }
    this.ctx.lineTo(w, top);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = front;
    this.ctx.beginPath();
    this.ctx.moveTo(0, top);
    for (let x = 0; x <= w; x += 18) {
      const h = top - 8 - Math.sin(x * 0.013 + 1.6) * 7 - Math.sin(x * 0.03) * 4;
      this.ctx.lineTo(x, h);
    }
    this.ctx.lineTo(w, top);
    this.ctx.closePath();
    this.ctx.fill();

    const trees = [
      { x: 0.08, scale: 0.9, kind: "pine", offset: 0 },
      { x: 0.14, scale: 1.1, kind: "round", offset: 2 },
      { x: 0.22, scale: 0.75, kind: "pine", offset: 1 },
      { x: 0.31, scale: 1.0, kind: "pine", offset: 3 },
      { x: 0.4, scale: 0.85, kind: "round", offset: 0 },
      { x: 0.5, scale: 1.15, kind: "pine", offset: 2 },
      { x: 0.58, scale: 0.95, kind: "round", offset: 1 },
      { x: 0.66, scale: 1.2, kind: "pine", offset: 0 },
      { x: 0.74, scale: 0.8, kind: "pine", offset: 3 },
      { x: 0.82, scale: 1.05, kind: "round", offset: 2 },
      { x: 0.9, scale: 0.88, kind: "pine", offset: 1 },
      { x: 0.96, scale: 0.7, kind: "round", offset: 0 },
    ];

    for (const tree of trees) {
      const tx = w * tree.x;
      const groundY = top - 6 - tree.offset;
      this._drawBackgroundTree(tx, groundY, tree.scale, tree.kind, nightMix);
    }

    this._drawHillAtmosphere(nightMix);
  }

  _drawHillAtmosphere(nightMix) {
    const top = this.waterTop;
    const w = FishingGame.BASE_W;
    const hazeTop = this.ctx.createLinearGradient(0, top - 100, 0, top + 6);
    hazeTop.addColorStop(0, "rgba(8,18,32,0)");
    hazeTop.addColorStop(
      0.45,
      nightMix > 0.5
        ? `rgba(12, 28, 48, ${0.22 * nightMix})`
        : `rgba(200, 230, 255, ${0.28 * (1 - nightMix)})`
    );
    hazeTop.addColorStop(
      1,
      nightMix > 0.5 ? `rgba(8, 40, 68, ${0.45})` : `rgba(61, 181, 232, ${0.35})`
    );
    this.ctx.fillStyle = hazeTop;
    this.ctx.fillRect(0, top - 100, w, 106);
  }

  _drawBackgroundTree(x, groundY, scale, kind, nightMix) {
    const trunkColor = this._lerpColor("#3d2818", "#1a1208", nightMix);
    const darkFoliage = this._lerpColor("#1a4d32", "#081418", nightMix);
    const midFoliage = this._lerpColor("#2d6b48", "#0f2830", nightMix);
    const lightFoliage = this._lerpColor("#3d8a5c", "#1a3d42", nightMix);

    this.ctx.save();
    this.ctx.translate(x, groundY);

    const trunkW = 3 * scale;
    const trunkH = 10 * scale;
    this.ctx.fillStyle = trunkColor;
    this.ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);

    if (kind === "pine") {
      const tiers = [
        { w: 22 * scale, h: 16 * scale, y: -trunkH - 6 * scale, color: darkFoliage },
        { w: 18 * scale, h: 14 * scale, y: -trunkH - 16 * scale, color: midFoliage },
        { w: 13 * scale, h: 12 * scale, y: -trunkH - 26 * scale, color: lightFoliage },
      ];
      for (const tier of tiers) {
        this.ctx.fillStyle = tier.color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, tier.y - tier.h);
        this.ctx.lineTo(-tier.w / 2, tier.y);
        this.ctx.lineTo(tier.w / 2, tier.y);
        this.ctx.closePath();
        this.ctx.fill();
      }
    } else {
      this.ctx.fillStyle = darkFoliage;
      this.ctx.beginPath();
      this.ctx.ellipse(0, -trunkH - 12 * scale, 11 * scale, 13 * scale, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = midFoliage;
      this.ctx.beginPath();
      this.ctx.ellipse(-3 * scale, -trunkH - 14 * scale, 8 * scale, 9 * scale, -0.2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = lightFoliage;
      this.ctx.beginPath();
      this.ctx.ellipse(4 * scale, -trunkH - 16 * scale, 7 * scale, 8 * scale, 0.15, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  _getFishingZone() {
    if (this._fishingZone) return this._fishingZone;

    const fx = FishingGame.BASE_W * 0.29;
    const waterLine = this.waterTop || FishingGame.BASE_H * 0.44;
    const rod = getRodEffect(this.gear.rod);
    const castWidth = (FishingGame.BASE_W - fx - 20) * rod.castRange;
    this._fishingZone = {
      minX: fx + 8,
      maxX: fx + 8 + castWidth,
      minY: waterLine + 8,
      maxY: FishingGame.BASE_H - 8,
    };
    return this._fishingZone;
  }

  _spawnSharkFins() {
    this.sharkFins = [
      {
        x: FishingGame.BASE_W * 0.52 + Math.random() * 30,
        depth: 0.28,
        size: 44 + Math.random() * 10,
        speed: 0.09 + Math.random() * 0.08,
        dir: 1,
        phase: Math.random() * Math.PI * 2,
        kind: "dorsal",
      },
      {
        x: FishingGame.BASE_W * 0.68 + Math.random() * 40,
        depth: 0.42,
        size: 38 + Math.random() * 12,
        speed: 0.1 + Math.random() * 0.1,
        dir: -1,
        phase: Math.random() * Math.PI * 2,
        kind: "dorsal",
      },
    ];
  }

  _getWaveOffset(x, depth = 0) {
    const t = this.waterTime;
    const damp = Math.max(0.25, 1 - depth * 0.75);
    return (
      Math.sin(x * 0.028 + t * 0.75) * 2.2 * damp +
      Math.sin(x * 0.014 - t * 0.48 + 1.4) * 1.1 * damp
    );
  }

  _getBobberSurfaceY(x) {
    return this.waterTop + 9 + this._getWaveOffset(x, 0);
  }

  _getBobberDisplayPos() {
    if (!this.bobber) return null;

    const bob = Math.sin(this.bobber.bob) * 2.5;
    let extra = 0;
    if (this.state === GameState.BITING) {
      extra = 3 + Math.sin(Date.now() * 0.02) * 3;
    } else if (this.bobberNibble > 0) {
      extra = Math.sin(this.bobberNibble * 0.75) * 5 * (this.bobberNibble / 22);
    }

    if (this.state === GameState.CASTING || this.castAnim) {
      return {
        x: this.bobber.x,
        y: this.bobber.y + bob + extra,
      };
    }

    const surfaceY = this._getBobberSurfaceY(this.bobber.x);
    const nearSurface = this.bobber.y <= surfaceY + 14;
    const y = nearSurface ? surfaceY + bob * 0.55 + extra : this.bobber.y + bob + extra;

    return {
      x: this.bobber.x,
      y,
    };
  }

  _spawnFishShadows() {
    const zone = this._getFishingZone();
    const depthRange = zone.maxY - zone.minY - 40;
    this.fishShadows = Array.from({ length: 10 }, () => {
      const depth = 0.2 + Math.random() * 0.75;
      return {
        x: zone.minX + Math.random() * (zone.maxX - zone.minX),
        y: zone.minY + 30 + depth * depthRange,
        w: 14 + Math.random() * 26,
        speed: 0.15 + Math.random() * 0.35,
        dir: Math.random() > 0.5 ? 1 : -1,
        alpha: 0.12 + Math.random() * 0.18,
        depth,
        phase: Math.random() * Math.PI * 2,
      };
    });
  }

  _drawUnderwaterFishShadow(fish, shadowScale, waveDrift) {
    const sx = fish.x;
    const sy = fish.y + waveDrift;
    const rx = fish.w * shadowScale;
    const ry = fish.w * 0.32 * shadowScale;
    const depth = fish.depth ?? 0.5;
    const depthFade = 0.45 + depth * 0.55;
    const swim = Math.sin(this.waterTime * 0.9 + (fish.phase ?? 0)) * 2;

    this.ctx.save();
    this.ctx.translate(sx + swim * 0.4, sy);

    this.ctx.fillStyle = `rgba(6, 24, 42, ${fish.alpha * 0.22 * depthFade})`;
    this.ctx.beginPath();
    this.ctx.ellipse(2, 3, rx * 1.15, ry * 1.2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(10, 38, 62, ${fish.alpha * 0.5 * depthFade})`;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 1, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(18, 55, 82, ${fish.alpha * 0.35 * depthFade})`;
    this.ctx.beginPath();
    this.ctx.ellipse(-rx * 0.15, -ry * 0.1, rx * 0.55, ry * 0.45, -0.15, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(4, 14, 28, ${fish.alpha * 0.65 * depthFade})`;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, rx * 0.82, ry * 0.78, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  _pointerCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = FishingGame.BASE_W / rect.width;
    const scaleY = FishingGame.BASE_H / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  _onPointerDown(event) {
    if (event.button !== 0) return;
    const { x, y } = this._pointerCoords(event);

    if (this.state === GameState.REELING) {
      event.preventDefault();
      this._attemptReelHit();
      return;
    }
    if (this.state === GameState.IDLE && y > this.waterTop + 6) {
      this._cast(x, y);
    } else if (this.state === GameState.WAITING) {
      this._recallLine();
    } else if (this.state === GameState.BITING) {
      this._startReeling();
    }
  }

  _onPointerUp() {
    // Tap-based reel — handled on pointerdown.
  }

  _onKeyDown(event) {
    if (event.code === "Space") {
      event.preventDefault();
      if (this.state === GameState.IDLE) {
        const zone = this._getFishingZone();
        this._cast(
          (zone.minX + zone.maxX) / 2,
          zone.minY + (zone.maxY - zone.minY) * 0.35
        );
      } else if (this.state === GameState.BITING) {
        this._startReeling();
      } else if (this.state === GameState.REELING) {
        this._attemptReelHit();
      }
    }
  }

  _onKeyUp(event) {
    if (event.code === "Space") {
      event.preventDefault();
    }
  }

  _getReelMarkerPosition() {
    return 0.5 + Math.sin(this.reelPhase) * 0.42;
  }

  _isReelEasy() {
    return Boolean(this.pendingFish?.starter || (this.callbacks.isFirstCatch?.() ?? false));
  }

  _pushReelUi() {
    const inZone = this._isInReelZone(this.reelMarker);
    const hitGood = this.reelHitPulse > 0;
    const hitBad = this.reelMissPulse > 0;
    const key = `${this.reelMarker.toFixed(3)}|${this.reelProgress.toFixed(3)}|${inZone}|${hitGood}|${hitBad}`;
    if (key === this._lastReelUiKey) return;
    this._lastReelUiKey = key;
    this.callbacks.onReelProgress?.(
      this.reelMarker,
      this.reelProgress,
      inZone,
      false,
      hitGood,
      hitBad
    );
  }

  reelTap() {
    if (this.state === GameState.BITING) {
      this._startReeling();
      return;
    }
    if (this.state !== GameState.REELING) return;
    this._attemptReelHit();
  }

  _attemptReelHit() {
    const inZone = this._isInReelZone(this.reelMarker, 0.014);
    const tier = this._getFishFightTier();
    const ease = this._getGearFightEase(this.pendingFish);
    const easy = this._isReelEasy();
    const hitGain = (easy ? 0.2 : 0.16) - tier * 0.1 + ease * 0.03;
    const missPen = Math.max(0.07, 0.11 + tier * 0.17 - ease * 0.03);

    if (inZone) {
      this.reelProgress += hitGain;
      this.reelHitPulse = 14;
      this.reelMissPulse = 0;
    } else {
      this.reelProgress -= missPen;
      this.reelMissPulse = 14;
      this.reelHitPulse = 0;
    }

    this.reelProgress = Math.max(0, Math.min(1, this.reelProgress));
    this._lastReelUiKey = "";
    this._pushReelUi();

    if (this.reelProgress >= 1) {
      this._winCatch();
    } else if (this.reelProgress <= 0 && this.reelGrace <= 0) {
      this._failCatch();
    }
  }

  startReelHold() {
    this.reelTap();
  }

  stopReelHold() {
    // Tap-based reel — no hold state.
  }

  _spawnCastReject(x, y) {
    const clampX = Math.max(0, Math.min(FishingGame.BASE_W, x));
    const clampY = Math.max(this.waterTop, Math.min(FishingGame.BASE_H, y));
    this.ripples.push({ x: clampX, y: clampY, r: 4, alpha: 0.75, reject: true });
    this._addShake(2);
  }

  _cast(targetX, targetY) {
    this._ensureLayout();
    const zone = this._getFishingZone();

    if (targetY < zone.minY) {
      this._spawnCastReject(targetX, targetY);
      this.callbacks.onFail?.("Cast into the water below the dock!");
      return;
    }
    if (targetX < zone.minX || targetX > zone.maxX) {
      this._spawnCastReject(targetX, targetY);
      this.callbacks.onFail?.("Cast in the water in front of you!");
      return;
    }

    const clampedX = Math.min(targetX, zone.maxX);
    const clampedY = Math.max(zone.minY, Math.min(targetY, zone.maxY));

    clearTimeout(this.biteTimer);
    clearTimeout(this.biteAutoTimer);
    this.nibbles = [];
    this.bobberNibble = 0;
    this.surfaceFish = null;
    this.fishSurfaced = false;

    this.state = GameState.CASTING;
    this.callbacks.onStateChange(this.state);

    this.castAnim = {
      elapsed: 0,
      durationMs: FishingGame.CAST_DURATION_MS,
      endX: clampedX,
      endY: clampedY,
    };
  }

  _getCastProgress() {
    if (!this.castAnim) return 0;
    return Math.min(1, this.castAnim.elapsed / this.castAnim.durationMs);
  }

  releaseCaught() {
    this._releaseCaught();
  }

  _releaseCaught() {
    if (this.state !== GameState.CAUGHT) return;
    clearTimeout(this.caughtReleaseTimer);
    this.caughtReleaseTimer = null;
    this.state = GameState.IDLE;
    this.bobber = null;
    this.pendingFish = null;
    this.caughtFish = null;
    this.caughtReward = null;
    this.surfaceFish = null;
    this.fishSurfaced = false;
    this.callbacks.onStateChange(this.state);
  }

  _finishCast() {
    if (!this.castAnim) return;

    const { endX, endY } = this.castAnim;
    this.castAnim = null;
    this.bobber = { x: endX, y: endY, bob: 0 };
    this.ripples.push({
      x: endX,
      y: endY,
      r: endY <= this._getBobberSurfaceY(endX) + 10 ? 5 : 3.5,
      alpha: endY <= this._getBobberSurfaceY(endX) + 10 ? 0.85 : 0.45,
    });
    for (let i = 0; i < 3; i++) {
      this.ripples.push({
        x: endX + (i - 1) * 14,
        y: this._getBobberSurfaceY(endX) + 2,
        r: 2 + i * 1.5,
        alpha: 0.55 - i * 0.12,
      });
    }
    this.state = GameState.WAITING;
    this.callbacks.onStateChange(this.state);

    const isFirstCatch = this.callbacks.isFirstCatch?.() ?? false;
    this.pendingFish = rollFish(this.gear, isFirstCatch);
    const nearSurface = endY <= this._getBobberSurfaceY(endX) + 14;
    const surfaceRoll = rollCastSurface(this.gear.rod);

    if (surfaceRoll && nearSurface) {
      this.fishSurfaced = true;
      this.surfaceFish = { fish: this.pendingFish, x: endX, y: this._getBobberSurfaceY(endX), t: 0 };
    } else {
      this.fishSurfaced = false;
      this.surfaceFish = null;
    }

    const delay = isFirstCatch ? 5000 : getBiteDelayMs(this.gear);
    this.biteDelayMs = delay;
    this.biteAt = performance.now() + delay;
    this._scheduleWaitNibbles(delay);
    this.bobberNibble = 0;
    this.biteTimer = setTimeout(() => {
      if (this.state === GameState.WAITING) {
        this.state = GameState.BITING;
        this._addShake(5);
        const pos = this._getBobberDisplayPos();
        if (pos) this._spawnSplashParticles(pos.x, pos.y);
        this.callbacks.onStateChange(this.state);
        const caught = this.callbacks.getCatchCount?.() ?? 0;
        if (caught === 0) {
          this.biteAutoTimer = setTimeout(() => {
            if (this.state === GameState.BITING) this._startReeling();
          }, 2500);
        }
      }
    }, delay);
  }

  _recallLine() {
    clearTimeout(this.biteTimer);
    clearTimeout(this.biteAutoTimer);
    this.nibbles = [];
    this.bobberNibble = 0;
    this.state = GameState.IDLE;
    this.bobber = null;
    this.pendingFish = null;
    this.surfaceFish = null;
    this.fishSurfaced = false;
    this.callbacks.onStateChange(this.state);
  }

  _startReeling() {
    if (this.state !== GameState.BITING) return;

    clearTimeout(this.biteTimer);
    clearTimeout(this.biteAutoTimer);
    this.state = GameState.REELING;
    this.reeling = false;
    this.reelGrace = 26;
    this.reelHitPulse = 0;
    this.reelMissPulse = 0;

    const easy = this._isReelEasy();

    const tier = this._getFishFightTier();
    const ease = this._getGearFightEase(this.pendingFish);

    let startProgress = Math.max(0.22, 0.38 - tier * 0.1 + ease * 0.05);
    if (easy) startProgress = Math.max(startProgress, 0.48);
    this.reelProgress = startProgress;
    this.reelPhase = Math.random() * Math.PI * 2;
    this.reelMarker = this._getReelMarkerPosition();
    this.reelPhaseSpeed = this._getReelMarkerSpeed();
    if (easy) this.reelPhaseSpeed *= 0.92;
    this._lastReelUiKey = "";
    this._syncReelZoneUi();
    this.callbacks.onReelStart?.(this.pendingFish);
    this.callbacks.onStateChange(this.state);
    this._pushReelUi();
  }

  _failCatch() {
    this.state = GameState.IDLE;
    this.bobber = null;
    this.pendingFish = null;
    this.surfaceFish = null;
    this.fishSurfaced = false;
    this.callbacks.onStateChange(this.state);
    this.callbacks.onFail("The fish got away!");
  }

  _winCatch() {
    this._addShake(7);
    this.caughtFish = this.pendingFish;
    this.state = GameState.CAUGHT;
    this.catchSwing = 0;
    this.bobber = null;
    this.hookedFishPos = null;
    const color = this.caughtFish.color || RARITY_COLORS[this.caughtFish.rarity] || "#ffd24a";
    const intensity =
      this.caughtFish.rarity === "legendary" ? 1.75 : this.caughtFish.rarity === "epic" ? 1.35 : 1;
    this._spawnCelebrateParticles(FishingGame.BASE_W * 0.58, this.waterTop + 55, color, intensity);
    if (this.caughtFish.rarity === "legendary") {
      this._addShake(10);
      this.screenShake = Math.max(this.screenShake, 9);
    }
    this.callbacks.onCatch(this.pendingFish);
    this.callbacks.onStateChange(this.state);
  }

  _getRodBaseAngle() {
    return -1.22;
  }

  _update() {
    this._ensureLayout();

    const now = performance.now();
    const dt = Math.min(48, now - (this._lastFrameTime || now));
    this._lastFrameTime = now;
    const dtScale = Math.min(2.5, dt / 16.67);
    this._frame.nightMix = this._getDayNightMix();
    this._frame.raining = this._isRaining();
    this._frame.reelFocus = this.state === GameState.REELING;

    if (this.castAnim) {
      this.castAnim.elapsed += dt;
      const { endX, endY } = this.castAnim;
      const p = this._getCastProgress();
      const ease = 1 - (1 - p) ** 2;
      const arc = Math.sin(p * Math.PI) * 36;
      const rodTip = this._getRodTip();

      const dx = endX - rodTip.x;
      const dy = endY - rodTip.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      if (p >= 1) {
        this._finishCast();
      } else {
        this.bobber = {
          x: rodTip.x + ux * dist * ease,
          y: rodTip.y + uy * dist * ease - arc,
          bob: 0,
        };
      }
    }

    if (this.bobber) {
      this.bobber.bob += 0.08;
      if (this.state === GameState.WAITING && this.biteAt) {
        const remaining = this.biteAt - performance.now();
        const elapsed = Math.max(0, this.biteDelayMs - remaining);

        for (const nibble of this.nibbles) {
          if (!nibble.fired && elapsed >= nibble.at) {
            nibble.fired = true;
            this.bobberNibble = 28;
            const pos = this._getBobberDisplayPos();
            if (pos) {
              this.ripples.push({ x: pos.x, y: pos.y + 2, r: 4, alpha: 0.62 });
              this.ripples.push({ x: pos.x - 6, y: pos.y + 3, r: 2.5, alpha: 0.4 });
            }
            this._addShake(1.5);
            this.callbacks.onNibble?.();
          }
        }

        if (this.bobberNibble > 0) {
          this.bobberNibble -= dtScale;
        }

        const nibbleTension = this.nibbles.filter((n) => n.fired).length * 0.14;
        if (nibbleTension > 0) {
          this.bobber.bob += nibbleTension * 0.05;
        }
        const waitKey = `${nibbleTension >= 0.08}|${nibbleTension >= 0.28}|${Math.floor(elapsed / 400)}`;
        if (waitKey !== this._lastWaitPulseKey) {
          this._lastWaitPulseKey = waitKey;
          this.callbacks.onWaitPulse?.(nibbleTension, elapsed, this.biteDelayMs);
        }
      }
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      ripple.r += (ripple.reject ? 1.1 : 0.8) * dtScale;
      ripple.alpha -= (ripple.reject ? 0.035 : 0.015) * dtScale;
      if (ripple.alpha <= 0) this.ripples.splice(i, 1);
    }

    const zone = this._getFishingZone();
    for (const fish of this.fishShadows) {
      fish.x += fish.speed * fish.dir;
      if (fish.x < zone.minX || fish.x > zone.maxX) fish.dir *= -1;
    }

    if (!this.sharkFins) this._spawnSharkFins();
    for (const fin of this.sharkFins) {
      fin.x += fin.speed * fin.dir;
      fin.phase += 0.018;
      const minFinX = FishingGame.BASE_W * 0.46;
      const maxFinX = FishingGame.BASE_W * 0.8;
      if (fin.x < minFinX) {
        fin.x = minFinX;
        fin.dir = 1;
      }
      if (fin.x > maxFinX) {
        fin.x = maxFinX;
        fin.dir = -1;
      }
    }

    if (this.state === GameState.REELING) {
      this.hookedFishPos = this._computeHookedFishPos();
      const tier = this._getFishFightTier();
      const ease = this._getGearFightEase(this.pendingFish);

      this.reelPhase += this.reelPhaseSpeed * dtScale;
      this.reelMarker = this._getReelMarkerPosition();

      this.reelProgress -= (0.00185 + tier * 0.0048 - ease * 0.0011) * dtScale;
      if (this.reelGrace > 0) this.reelGrace -= dtScale;
      if (this.reelHitPulse > 0) this.reelHitPulse -= dtScale;
      if (this.reelMissPulse > 0) this.reelMissPulse -= dtScale;

      this.reelProgress = Math.max(0, Math.min(1, this.reelProgress));

      this._pushReelUi();

      if (this.reelProgress >= 1) {
        this._winCatch();
      } else if (this.reelProgress <= 0 && this.reelGrace <= 0) {
        this._failCatch();
      }
    }

    if (this.state !== GameState.REELING) {
      this.hookedFishPos = null;
    }

    if (this.surfaceFish) {
      this.surfaceFish.t += 1;
      this.surfaceFish.y = this._getBobberSurfaceY(this.surfaceFish.x);
      if (this.state === GameState.IDLE || this.state === GameState.CAUGHT) {
        this.surfaceFish = null;
      }
    }

    if (this.state === GameState.CAUGHT) {
      this.catchSwing += 1;
    }

    this.waterTime += 0.04;
    this.fishermanSway += 0.03;
    if (!this._frame.reelFocus) {
      this._updateBannerPlane();
      this._updateSeagulls();
    }
    this._updateParticles();
    this._updateRain(dt);
  }

  _updateSeagulls() {
    const w = FishingGame.BASE_W;
    for (const gull of this.seagulls) {
      gull.x += gull.speed * gull.dir;
      gull.flap += 0.18;
      if (gull.dir > 0 && gull.x > w + 40) gull.x = -40;
      if (gull.dir < 0 && gull.x < -40) gull.x = w + 40;
    }
  }

  _drawSeagulls(nightMix) {
    const alpha = this._lerp(0.55, 0.22, nightMix) * (this._isRaining() ? 0.45 : 1);
    if (alpha < 0.08) return;

    this.ctx.save();
    this.ctx.strokeStyle = `rgba(240, 248, 255, ${alpha})`;
    this.ctx.lineWidth = 1.6;
    this.ctx.lineCap = "round";

    for (const gull of this.seagulls) {
      const y = Math.max(28, this.waterTop * gull.yRatio);
      const flap = Math.sin(gull.flap) * 3 * gull.size;
      const span = 7 * gull.size;
      this.ctx.beginPath();
      this.ctx.moveTo(gull.x - span, y + flap);
      this.ctx.quadraticCurveTo(gull.x, y - 2 - Math.abs(flap) * 0.3, gull.x + span, y + flap);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  _drawDistantBoat(nightMix) {
    const w = FishingGame.BASE_W;
    const top = this.waterTop;
    const x = w * 0.72 + Math.sin(this.waterTime * 0.15) * 6;
    const hullColor = this._lerpColor("#1e3a52", "#0a1520", nightMix);
    const sailColor = this._lerpColor("#dceaf4", "#6a7a8a", nightMix);

    this.ctx.save();
    this.ctx.globalAlpha = this._lerp(0.7, 0.35, nightMix);
    this.ctx.fillStyle = hullColor;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 22, top + 6);
    this.ctx.lineTo(x + 24, top + 6);
    this.ctx.lineTo(x + 18, top + 14);
    this.ctx.lineTo(x - 16, top + 14);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = sailColor;
    this.ctx.beginPath();
    this.ctx.moveTo(x, top - 18);
    this.ctx.lineTo(x + 14, top + 4);
    this.ctx.lineTo(x, top + 4);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = `rgba(255,255,255,${0.12 + (1 - nightMix) * 0.08})`;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, top - 18);
    this.ctx.lineTo(x, top + 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _updateBannerPlane() {
    const plane = this.bannerPlane;
    plane.phase += 0.07;
    plane.x += plane.speed * plane.dir;

    const margin = plane.width;
    if (plane.dir > 0 && plane.x > FishingGame.BASE_W + margin) {
      plane.x = FishingGame.BASE_W + margin;
      plane.dir = -1;
    } else if (plane.dir < 0 && plane.x < -margin) {
      plane.x = -margin;
      plane.dir = 1;
    }
  }

  _computeHookedFishPos() {
    if (!this.bobber) return null;

    const bob = Math.sin(this.bobber.bob) * 3;
    const bobX = this.bobber.x;
    const bobY = this.bobber.y + bob;
    const { gripX, gripY } = this._getFishermanPose();
    const pullT = 0.15 + this.reelProgress * 0.85;
    const struggle = Math.sin(Date.now() * 0.025) * (1 - this.reelProgress) * 12;

    return {
      x: bobX + (gripX + 90 - bobX) * pullT + struggle,
      y: bobY + (gripY + 50 - bobY) * pullT + Math.cos(Date.now() * 0.02) * (1 - this.reelProgress) * 6,
    };
  }

  _getFishermanAnchor() {
    return this._getFishermanPose();
  }

  _getFishermanPose() {
    if (this._frame?.pose) return this._frame.pose;

    const sway = Math.sin(this.fishermanSway) * 1.5;
    const fx = FishingGame.BASE_W * 0.29 + sway;
    const feetY = this.dockY;
    const reeling = this.state === GameState.REELING;
    const reelBob = reeling ? Math.sin(Date.now() * 0.018) * 3 : 0;
    const lean = this.castAnim ? Math.sin(this._getCastProgress() * Math.PI) * 5 : 0;

    const gripX = fx + 36;
    const gripY = feetY - 60 + reelBob - lean * 0.25;

    const pose = {
      fx,
      feetY,
      cx: fx + 17,
      gripX,
      gripY,
      reeling,
      reelBob,
      sway,
      lean,
    };

    if (this._frame) this._frame.pose = pose;
    return pose;
  }

  _getRodStyle() {
    return getRodVisual(this.gear.rod);
  }

  _getRodLength() {
    return 50 + this.gear.rod * 9;
  }

  _getRodAngle() {
    const base = this._getRodBaseAngle();

    if (this.castAnim) {
      const p = this._getCastProgress();
      const windBack = base - 0.18;
      if (p < 0.22) return base + (windBack - base) * (p / 0.22);
      return windBack + (base - windBack) * ((p - 0.22) / 0.78);
    }

    if (this.state === GameState.REELING) {
      return base + Math.sin(Date.now() * 0.015) * 0.05;
    }

    if (this.state === GameState.BITING) {
      return base + Math.sin(Date.now() * 0.03) * 0.04;
    }

    return base + Math.sin(this.fishermanSway * 0.7) * 0.025;
  }

  _getFishDisplayScale() {
    return 0.5 + this.gear.rod * 0.28;
  }

  _getFishRewardSizeMultiplier(fish) {
    if (!fish) return 1;

    const reward = fish.reward || 1;
    const sizeByReward = [
      [1, 0.5],
      [2, 0.62],
      [3, 0.65],
      [4, 0.68],
      [5, 0.78],
      [6, 0.74],
      [7, 0.76],
      [8, 0.9],
      [10, 0.82],
      [12, 0.86],
      [15, 1.0],
      [18, 0.94],
      [20, 0.96],
      [25, 1.12],
      [30, 1.05],
      [35, 1.08],
      [40, 1.1],
      [45, 1.14],
      [50, 1.22],
      [60, 1.18],
      [75, 1.42],
      [100, 1.48],
      [125, 1.55],
      [150, 1.62],
      [175, 1.68],
      [200, 1.72],
      [250, 1.8],
      [300, 1.85],
      [400, 1.92],
      [750, 2.05],
      [1000, 2.2],
      [1500, 2.35],
      [2500, 2.55],
      [3500, 2.65],
      [5000, 2.9],
      [6000, 2.82],
      [8000, 2.95],
      [10000, 3.05],
    ];

    let mult = sizeByReward[0][1];
    for (const [threshold, size] of sizeByReward) {
      if (reward >= threshold) mult = size;
    }

    if (fish.starter) mult *= 0.72;
    return mult;
  }

  _getFishVisualScale(fish, contextMul = 1) {
    return this._getFishDisplayScale() * this._getFishRewardSizeMultiplier(fish) * contextMul;
  }

  _getReelPosition() {
    const pose = this._getFishermanPose();
    const angle = this._getRodAngle();
    const handleLen = 14;
    return {
      x: pose.gripX - Math.cos(angle) * handleLen,
      y: pose.gripY - Math.sin(angle) * handleLen,
      angle,
      pose,
    };
  }

  _getLineEnd() {
    if (!this.bobber && this.state !== GameState.REELING) return null;

    const display = this._getBobberDisplayPos();

    if (this.state === GameState.REELING && this.pendingFish && this.hookedFishPos) {
      return {
        x: this.hookedFishPos.x,
        y: this.hookedFishPos.y,
        isFish: true,
        fish: this.pendingFish,
      };
    }

    if (!display) return null;

    if (this.state === GameState.BITING) {
      return { x: display.x, y: display.y, isFish: false, biting: true };
    }

    return { x: display.x, y: display.y, isFish: false, biting: false };
  }

  _getRodTip() {
    if (this._frame?.rodTip) return this._frame.rodTip;

    const pose = this._getFishermanPose();
    const angle = this._getRodAngle();
    const length = this._getRodLength();
    const reel = this._getReelPosition();
    const gripMidX = (reel.x + pose.gripX) / 2;
    const gripMidY = (reel.y + pose.gripY) / 2;

    const rodTip = {
      x: pose.gripX + Math.cos(angle) * length,
      y: pose.gripY + Math.sin(angle) * length,
      handX: pose.gripX,
      handY: pose.gripY,
      reelX: reel.x,
      reelY: reel.y,
      gripMidX,
      gripMidY,
      angle,
      pose,
    };

    if (this._frame) this._frame.rodTip = rodTip;
    return rodTip;
  }

  _drawSky() {
    const nightMix = this._frame.nightMix ?? this._getDayNightMix();
    const rainDim = (this._frame.raining ?? this._isRaining()) ? 0.12 : 0;
    const mix = Math.min(1, nightMix + rainDim);
    const bucket = Math.round(mix * 32);

    if (this._skyBucket !== bucket) {
      this._skyBucket = bucket;
      const skyTop = this._lerpColor("#6ec8f0", "#0f172a", mix);
      const skyBottom = this._lerpColor("#c8ecff", "#1e3a5f", mix);
      const sky = this.ctx.createLinearGradient(0, 0, 0, this.waterTop);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(1, skyBottom);
      this._skyGrad = sky;
    }

    this.ctx.fillStyle = this._skyGrad;
    this.ctx.fillRect(0, 0, FishingGame.BASE_W, this.waterTop);

    this._drawSkyHorizonHaze(mix);

    this._drawDistantHills(nightMix);
    this._drawStars(nightMix);
    this._drawCelestialBody(nightMix);
    if (!this._frame.reelFocus) {
      this._drawSunRays(nightMix);
    }

    const cloudAlpha = this._lerp(0.75, 0.18, nightMix) * (this._isRaining() ? 0.55 : 1);
    const cw = FishingGame.BASE_W / 720;
    this.ctx.fillStyle = `rgba(255,255,255,${cloudAlpha})`;
    this._cloud(90 * cw, 50, 1);
    this._cloud(280 * cw, 70, 0.8);
    this._cloud(520 * cw, 40, 1.1);

    this._drawSeagulls(nightMix);
    if (!this._frame.reelFocus) {
      this._drawBannerPlane();
    }
  }

  _drawSkyHorizonHaze(mix) {
    const top = this.waterTop;
    const w = FishingGame.BASE_W;
    const haze = this.ctx.createLinearGradient(0, top - 56, 0, top + 4);
    haze.addColorStop(0, `rgba(184, 230, 255, ${0.18 * (1 - mix)})`);
    haze.addColorStop(0.55, `rgba(90, 170, 220, ${0.14 + mix * 0.08})`);
    haze.addColorStop(1, `rgba(26, 122, 181, ${0.32 + mix * 0.12})`);
    this.ctx.fillStyle = haze;
    this.ctx.fillRect(0, top - 56, w, 60);
  }

  _drawSunRays(nightMix) {
    if (nightMix > 0.4 || this._isRaining()) return;

    const cx = FishingGame.BASE_W * 0.82;
    const cy = this.waterTop * 0.28;
    const alpha = (1 - nightMix) * 0.14;
    const w = FishingGame.BASE_W;
    const h = this.waterTop;

    this.ctx.save();
    const glow = this.ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.65);
    glow.addColorStop(0, `rgba(255, 235, 170, ${alpha})`);
    glow.addColorStop(0.45, `rgba(255, 220, 140, ${alpha * 0.35})`);
    glow.addColorStop(1, "rgba(255, 220, 140, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.restore();
  }

  _drawFireflies(nightMix) {
    if (nightMix < 0.45 || this._isRaining()) return;

    const w = FishingGame.BASE_W;
    const top = this.waterTop;
    const dockW = w * 0.55;

    this.ctx.save();
    for (const fly of this.fireflies) {
      fly.phase += fly.speed;
      const x = fly.x * dockW + Math.sin(fly.phase * 1.7) * 18;
      const y = top - 40 - fly.yRatio * 60 + Math.cos(fly.phase) * 8;
      const pulse = 0.35 + Math.sin(fly.phase * 3) * 0.35;
      const alpha = pulse * nightMix;
      this.ctx.fillStyle = `rgba(200, 255, 140, ${alpha * 0.35})`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = `rgba(220, 255, 160, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawShorelineFoam(top, w) {
    const t = this.waterTime;
    const count = this._frame.reelFocus ? 14 : 20;
    this.ctx.save();
    for (let i = 0; i < count; i++) {
      const x = (i / 28) * w + Math.sin(t * 0.5 + i) * 10;
      const foamY = top + 2 + Math.sin(t * 0.8 + i * 0.7) * 1.8;
      const alpha = 0.1 + Math.sin(t + i) * 0.05;
      const size = 8 + (i % 4) * 3;
      this.ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      this.ctx.beginPath();
      this.ctx.ellipse(x, foamY, size, 2.4, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const dockW = w * 0.55;
    for (let i = 0; i < 8; i++) {
      const x = 16 + (i / 7) * (dockW - 32);
      const foamY = top + 4 + Math.sin(t * 0.7 + i * 1.2) * 1.2;
      this.ctx.fillStyle = `rgba(220, 245, 255, ${0.14 + Math.sin(t + i) * 0.04})`;
      this.ctx.beginPath();
      this.ctx.ellipse(x, foamY, 12, 2.8, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawBannerPlane() {
    const plane = this.bannerPlane;
    const y = Math.max(36, this.waterTop * plane.yRatio);
    const bob = Math.sin(plane.phase * 0.55) * 3;
    const tilt = Math.sin(plane.phase * 0.35) * 0.06;
    const flagWave = Math.sin(plane.phase * 1.35) * 5;

    this.ctx.save();
    this.ctx.translate(plane.x, y + bob);
    this.ctx.rotate(tilt * plane.dir);

    this._drawPlaneFlag(flagWave, plane.dir);

    this.ctx.save();
    this.ctx.scale(plane.dir, 1);
    this._drawPlaneBody();
    this.ctx.restore();

    this.ctx.restore();
  }

  _drawPlaneBody() {
    this.ctx.lineWidth = 1.4;
    this.ctx.lineJoin = "round";

    this.ctx.fillStyle = "#b8d4e8";
    this.ctx.strokeStyle = "#3d5a78";
    this.ctx.beginPath();
    this.ctx.ellipse(0, 3, 30, 9, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#e8f4ff";
    this.ctx.beginPath();
    this.ctx.ellipse(2, 0, 24, 8, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#ef4444";
    this.ctx.beginPath();
    this.ctx.moveTo(-20, 0);
    this.ctx.lineTo(-30, -11);
    this.ctx.lineTo(-24, 0);
    this.ctx.lineTo(-30, 10);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#7dd3fc";
    this.ctx.beginPath();
    this.ctx.ellipse(16, -2, 9, 6, 0.15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.strokeStyle = "rgba(255,255,255,0.65)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.ellipse(24, 0, 2, 11, 0, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  _drawPlaneFlag(flagWave, dir) {
    const back = dir > 0 ? -1 : 1;
    const tailX = back * 32;
    const tailY = -1;
    const bannerW = 78;
    const bannerH = 24;
    const bannerEdgeX = tailX + back * 56;

    this.ctx.strokeStyle = "#334155";
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.moveTo(tailX, tailY);
    this.ctx.quadraticCurveTo(
      tailX + back * 28,
      tailY - 10 + flagWave * 0.25,
      bannerEdgeX,
      -bannerH / 2 + flagWave
    );
    this.ctx.moveTo(tailX, tailY);
    this.ctx.quadraticCurveTo(
      tailX + back * 28,
      tailY + 10 - flagWave * 0.25,
      bannerEdgeX,
      bannerH / 2 + flagWave
    );
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.translate(bannerEdgeX, flagWave * 0.35);
    this.ctx.fillStyle = "#0d9488";
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1.6;
    this.ctx.beginPath();

    if (back < 0) {
      this.ctx.moveTo(0, -bannerH / 2);
      this.ctx.lineTo(-bannerW, -bannerH / 2 + 5);
      this.ctx.lineTo(-bannerW, bannerH / 2 - 5);
      this.ctx.lineTo(0, bannerH / 2);
    } else {
      this.ctx.moveTo(0, -bannerH / 2);
      this.ctx.lineTo(bannerW, -bannerH / 2 + 5);
      this.ctx.lineTo(bannerW, bannerH / 2 - 5);
      this.ctx.lineTo(0, bannerH / 2);
    }

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 12px Fredoka, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("$HOOKED", back * (bannerW / 2), 0);
    this.ctx.restore();
  }

  _cloud(x, y, scale) {
    const nightMix = this._getDayNightMix();
    const s = scale;
    this.ctx.save();

    this.ctx.fillStyle = `rgba(70, 100, 130, ${0.07 + nightMix * 0.05})`;
    this.ctx.beginPath();
    this.ctx.arc(x + 4 * s, y + 10 * s, 24 * s, 0, Math.PI * 2);
    this.ctx.arc(x + 28 * s, y + 4 * s, 20 * s, 0, Math.PI * 2);
    this.ctx.arc(x + 52 * s, y + 10 * s, 22 * s, 0, Math.PI * 2);
    this.ctx.fill();

    const cloudGrad = this.ctx.createLinearGradient(x, y - 20 * s, x, y + 14 * s);
    cloudGrad.addColorStop(0, `rgba(255,255,255,${0.95 - nightMix * 0.25})`);
    cloudGrad.addColorStop(0.55, `rgba(245,250,255,${0.88 - nightMix * 0.2})`);
    cloudGrad.addColorStop(1, `rgba(200,215,230,${0.55 - nightMix * 0.15})`);
    this.ctx.fillStyle = cloudGrad;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 24 * s, 0, Math.PI * 2);
    this.ctx.arc(x + 26 * s, y - 10 * s, 20 * s, 0, Math.PI * 2);
    this.ctx.arc(x + 50 * s, y - 2 * s, 22 * s, 0, Math.PI * 2);
    this.ctx.arc(x + 14 * s, y - 14 * s, 16 * s, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - nightMix)})`;
    this.ctx.beginPath();
    this.ctx.arc(x + 8 * s, y - 12 * s, 8 * s, 0, Math.PI * 2);
    this.ctx.arc(x + 34 * s, y - 14 * s, 7 * s, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  _drawSceneLighting() {
    const nightMix = this._getDayNightMix();
    const raining = this._isRaining();
    const dayMix = 1 - nightMix;

    if (dayMix > 0.08 && !raining) {
      const sunX = FishingGame.BASE_W * 0.82;
      const sunY = this.waterTop * 0.28;
      const warm = this.ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, FishingGame.BASE_W * 0.95);
      warm.addColorStop(0, `rgba(255, 220, 150, ${dayMix * 0.1})`);
      warm.addColorStop(0.35, `rgba(255, 200, 120, ${dayMix * 0.04})`);
      warm.addColorStop(1, "rgba(255, 200, 120, 0)");
      this.ctx.fillStyle = warm;
      this.ctx.fillRect(0, 0, FishingGame.BASE_W, FishingGame.BASE_H);
    }

    if (nightMix < 0.04 && !raining) return;

    const mix = Math.min(1, nightMix + (raining ? 0.1 : 0));
    this.ctx.fillStyle = `rgba(4, 8, 24, ${mix * 0.2})`;
    this.ctx.fillRect(0, 0, FishingGame.BASE_W, FishingGame.BASE_H);
  }

  _drawDock() {
    const nightMix = this._getDayNightMix();
    const dockW = FishingGame.BASE_W * 0.55;
    const deckH = 16;
    const deckTop = this.dockY;

    const deckGrad = this.ctx.createLinearGradient(0, deckTop, 0, deckTop + deckH);
    deckGrad.addColorStop(0, this._lerpColor("#a67c52", "#6d5038", nightMix * 0.35));
    deckGrad.addColorStop(0.45, this._lerpColor("#8b5e34", "#5c3f24", nightMix * 0.35));
    deckGrad.addColorStop(1, this._lerpColor("#6d4c2f", "#4a3220", nightMix * 0.35));
    this.ctx.fillStyle = deckGrad;
    this.ctx.fillRect(0, deckTop, dockW, deckH);

    this.ctx.fillStyle = this._lerpColor("#c9a070", "#7a5a3a", nightMix * 0.3);
    this.ctx.fillRect(0, deckTop, dockW, 2);

    this.ctx.strokeStyle = `rgba(45, 28, 14, ${0.28 - nightMix * 0.08})`;
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const plankY = deckTop + 4 + i * 2.2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, plankY);
      this.ctx.lineTo(dockW, plankY);
      this.ctx.stroke();
      if (i % 2 === 0) {
        this.ctx.fillStyle = `rgba(30, 18, 8, ${0.12 + nightMix * 0.05})`;
        this.ctx.fillRect(0, plankY + 0.5, dockW, 0.8);
      }
    }

    const pilingColor = this._lerpColor("#6d4c2f", "#4a3220", nightMix * 0.35);
    const pilingHighlight = this._lerpColor("#9a7048", "#6a4a30", nightMix * 0.35);
    for (let i = 0; i < 8; i++) {
      const px = 20 + i * 48;
      this.ctx.fillStyle = pilingColor;
      this.ctx.fillRect(px, deckTop + deckH, 9, 42);
      this.ctx.fillStyle = pilingHighlight;
      this.ctx.fillRect(px + 1, deckTop + deckH, 2, 42);
      this.ctx.fillStyle = `rgba(20, 12, 6, ${0.35})`;
      this.ctx.beginPath();
      this.ctx.arc(px + 4.5, deckTop + deckH + 4, 1.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.strokeStyle = this._lerpColor("#5c3f24", "#3d2818", nightMix * 0.35);
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(6, deckTop + 3);
    this.ctx.lineTo(dockW - 8, deckTop + 3);
    this.ctx.stroke();

    this.ctx.strokeStyle = this._lerpColor("#8b5e34", "#5c4028", nightMix * 0.3);
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(dockW - 14, deckTop + 5);
    this.ctx.quadraticCurveTo(dockW + 6, deckTop + 14, dockW + 2, deckTop + 28);
    this.ctx.stroke();

    const waterGrad = this.ctx.createLinearGradient(0, deckTop + deckH - 2, 0, deckTop + deckH + 14);
    waterGrad.addColorStop(0, `rgba(61, 181, 232, ${0.22 + nightMix * 0.1})`);
    waterGrad.addColorStop(0.5, `rgba(7, 58, 94, ${0.28 + nightMix * 0.12})`);
    waterGrad.addColorStop(1, "rgba(7, 58, 94, 0)");
    this.ctx.fillStyle = waterGrad;
    this.ctx.fillRect(0, deckTop + deckH - 2, dockW, 16);
  }

  _drawFisherman() {
    const rodTip = this._getRodTip();
    const { pose, angle, gripMidX, gripMidY, reelX, reelY, handX, handY } = rodTip;
    const { fx, feetY, reeling, lean } = pose;
    const rod = this._getRodStyle();

    const leftGrip = {
      x: reelX - Math.sin(angle) * 5,
      y: reelY + Math.cos(angle) * 5,
    };
    const rightGrip = {
      x: handX - Math.sin(angle) * 2,
      y: handY + Math.cos(angle) * 2,
    };
    const shoulderL = { x: fx + 6, y: feetY - 46 };
    const shoulderR = { x: fx + 28, y: feetY - 44 };

    this._drawFishermanShadow(fx, feetY);
    this._drawFishermanLegs(fx, feetY);
    this._drawFishermanTorso(fx, feetY, lean);
    this._drawFishermanHead(fx, feetY, lean);
    this._drawFishermanArm(shoulderL.x, shoulderL.y, leftGrip.x, leftGrip.y, "#d9a87c", 5.5);
    this._drawFishermanArm(shoulderR.x, shoulderR.y, rightGrip.x, rightGrip.y, "#e8b88a", 5.5);
    this._drawRod(rodTip, rod, true);
    const bottomHand = leftGrip.y >= rightGrip.y ? "left" : "right";
    this._drawHandGrip(leftGrip.x, leftGrip.y, angle, "left", true, bottomHand === "left");
    this._drawHandGrip(rightGrip.x, rightGrip.y, angle, "right", true, bottomHand === "right");
    if (reeling) this._drawReelCrank(reelX, reelY, angle);
    this._drawCharacterRimLight(fx, feetY);
  }

  _drawCharacterRimLight(fx, feetY) {
    const nightMix = this._getDayNightMix();
    const dayMix = 1 - nightMix;
    if (dayMix < 0.12) return;

    this.ctx.save();
    const rim = this.ctx.createLinearGradient(fx, feetY - 80, fx + 40, feetY - 20);
    rim.addColorStop(0, `rgba(255, 240, 210, ${dayMix * 0.14})`);
    rim.addColorStop(0.5, `rgba(255, 230, 190, ${dayMix * 0.06})`);
    rim.addColorStop(1, "rgba(255, 230, 190, 0)");
    this.ctx.fillStyle = rim;
    this.ctx.fillRect(fx - 4, feetY - 78, 42, 72);
    this.ctx.restore();
  }

  _drawReelCrank(x, y, angle) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle + Date.now() * 0.01);
    this.ctx.strokeStyle = "#aaa";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 0);
    this.ctx.lineTo(4, 0);
    this.ctx.moveTo(0, -4);
    this.ctx.lineTo(0, 4);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _drawRodGripMark(x, y, angle, thick = false) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.fillStyle = thick ? "rgba(45,30,18,0.55)" : "rgba(55,38,22,0.45)";
    this._roundRect(-4, -(thick ? 5 : 4), 8, thick ? 10 : 8, 2);
    this.ctx.restore();
  }

  _drawFishermanShadow(fx, feetY) {
    this.ctx.fillStyle = "rgba(0,0,0,0.2)";
    this.ctx.beginPath();
    this.ctx.ellipse(fx + 16, feetY + 5, 22, 6, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  _drawFishermanLegs(fx, feetY) {
    const legGrad = this.ctx.createLinearGradient(fx, feetY - 28, fx, feetY);
    legGrad.addColorStop(0, "#3d5a7a");
    legGrad.addColorStop(1, "#2b3f58");

    this.ctx.fillStyle = legGrad;
    this._roundRect(fx + 4, feetY - 28, 13, 28, 4);
    this._roundRect(fx + 20, feetY - 28, 13, 28, 4);

    this.ctx.fillStyle = "#1e3d32";
    this._roundRect(fx + 2, feetY - 7, 16, 8, 3);
    this._roundRect(fx + 18, feetY - 7, 16, 8, 3);

    this.ctx.fillStyle = "rgba(255,255,255,0.15)";
    this.ctx.fillRect(fx + 5, feetY - 6, 5, 2);
    this.ctx.fillRect(fx + 21, feetY - 6, 5, 2);
  }

  _drawFishermanTorso(fx, feetY, lean) {
    const shirtGrad = this.ctx.createLinearGradient(fx, feetY - 58, fx + 34, feetY - 22);
    shirtGrad.addColorStop(0, "#4a8fb8");
    shirtGrad.addColorStop(1, "#2f6488");

    this.ctx.save();
    this.ctx.translate(lean * 0.25, -lean * 0.12);

    this.ctx.fillStyle = shirtGrad;
    this._roundRect(fx + 2, feetY - 58, 30, 34, 7);

    this.ctx.fillStyle = "#4a8fb8";
    this._roundRect(fx + 1, feetY - 57, 8, 12, 4);
    this._roundRect(fx + 27, feetY - 55, 8, 12, 4);

    this.ctx.fillStyle = "#c57a42";
    this._roundRect(fx + 4, feetY - 57, 28, 32, 6);

    const vestShade = this.ctx.createLinearGradient(fx, feetY - 57, fx + 32, feetY - 25);
    vestShade.addColorStop(0, "rgba(255,255,255,0.08)");
    vestShade.addColorStop(0.45, "rgba(0,0,0,0)");
    vestShade.addColorStop(1, "rgba(0,0,0,0.12)");
    this.ctx.fillStyle = vestShade;
    this._roundRect(fx + 4, feetY - 57, 28, 32, 6);

    this.ctx.fillStyle = "#d4884d";
    this.ctx.fillRect(fx + 9, feetY - 52, 18, 3);
    this.ctx.fillRect(fx + 9, feetY - 42, 18, 2);
    this.ctx.fillRect(fx + 11, feetY - 33, 6, 6);
    this.ctx.fillRect(fx + 20, feetY - 33, 6, 6);

    this.ctx.strokeStyle = "rgba(30,20,10,0.25)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(fx + 17, feetY - 57);
    this.ctx.lineTo(fx + 17, feetY - 26);
    this.ctx.stroke();

    this.ctx.restore();
  }

  _drawFishermanHead(fx, feetY, lean) {
    const nightMix = this._getDayNightMix();
    const headX = fx + 17 + lean * 0.18;
    const headY = feetY - 72;

    this.ctx.fillStyle = "#e8b88a";
    this.ctx.beginPath();
    this.ctx.ellipse(headX, headY + 2, 12, 13, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "#f2c9a2";
    this.ctx.beginPath();
    this.ctx.ellipse(headX, headY, 10, 11, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(30, 20, 12, ${0.12 + nightMix * 0.08})`;
    this.ctx.beginPath();
    this.ctx.ellipse(headX, headY + 4, 9, 4, 0, 0, Math.PI);
    this.ctx.fill();

    this.ctx.fillStyle = "#2a2a2a";
    this.ctx.beginPath();
    this.ctx.ellipse(headX - 3.5, headY - 1, 1.8, 2.2, 0, 0, Math.PI * 2);
    this.ctx.ellipse(headX + 3.5, headY - 1, 1.8, 2.2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "rgba(255,255,255,0.45)";
    this.ctx.beginPath();
    this.ctx.arc(headX - 4, headY - 2, 0.8, 0, Math.PI * 2);
    this.ctx.arc(headX + 3, headY - 2, 0.8, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = "#9a6b4f";
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.moveTo(headX - 2, headY + 2);
    this.ctx.quadraticCurveTo(headX, headY + 5, headX + 2, headY + 2);
    this.ctx.stroke();

    this.ctx.fillStyle = "rgba(220,170,130,0.35)";
    this.ctx.beginPath();
    this.ctx.ellipse(headX - 6, headY + 2, 2.5, 1.5, -0.3, 0, Math.PI * 2);
    this.ctx.ellipse(headX + 6, headY + 2, 2.5, 1.5, 0.3, 0, Math.PI * 2);
    this.ctx.fill();

    const hatGrad = this.ctx.createLinearGradient(headX - 14, headY - 22, headX + 14, headY - 8);
    hatGrad.addColorStop(0, "#4ade80");
    hatGrad.addColorStop(1, "#16a34a");

    this.ctx.fillStyle = hatGrad;
    this.ctx.beginPath();
    this.ctx.ellipse(headX, headY - 10, 19, 5.5, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this._roundRect(headX - 13, headY - 25, 26, 15, 4);

    this.ctx.fillStyle = "rgba(0,0,0,0.1)";
    this.ctx.beginPath();
    this.ctx.ellipse(headX, headY - 6, 17, 3, 0, 0, Math.PI);
    this.ctx.fill();

    this._drawHatPillLogo(headX, headY - 18);
  }

  _drawHatPillLogo(cx, cy) {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(-Math.PI / 4);

    const length = 13;
    const height = 5.5;
    const radius = height / 2;
    const half = length / 2;
    const outline = 1.35;
    const darkGreen = "#1a3d2e";
    const teal = "#2ebfa3";

    this.ctx.fillStyle = teal;
    this.ctx.beginPath();
    this.ctx.arc(-half + radius, 0, radius, Math.PI / 2, -Math.PI / 2, true);
    this.ctx.lineTo(0, -radius);
    this.ctx.lineTo(0, radius);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(half - radius, 0, radius, -Math.PI / 2, Math.PI / 2);
    this.ctx.lineTo(0, radius);
    this.ctx.lineTo(0, -radius);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = darkGreen;
    this.ctx.lineWidth = outline;
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.arc(-half + radius, 0, radius, Math.PI / 2, -Math.PI / 2, true);
    this.ctx.lineTo(half - radius, -radius);
    this.ctx.arc(half - radius, 0, radius, -Math.PI / 2, Math.PI / 2);
    this.ctx.lineTo(-half + radius, radius);
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(0, -radius + 0.2);
    this.ctx.lineTo(0, radius - 0.2);
    this.ctx.stroke();

    this.ctx.fillStyle = "rgba(255,255,255,0.8)";
    this.ctx.beginPath();
    this.ctx.ellipse(-half + 2.2, -1.4, 1.1, 0.45, -0.35, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(-half + 3.2, 0.9, 0.85, 0.32, -0.25, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "rgba(175, 185, 190, 0.4)";
    this.ctx.beginPath();
    this.ctx.ellipse(half - 2.2, 1.1, 1.4, 0.38, 0.35, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  _drawFishermanArm(x1, y1, x2, y2, color, width) {
    this.ctx.save();
    this.ctx.strokeStyle = this._shadeColor(color, -35);
    this.ctx.lineWidth = width + 1.2;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 6, x2, y2);
    this.ctx.stroke();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 6, x2, y2);
    this.ctx.stroke();

    this.ctx.fillStyle = this._shadeColor(color, -20);
    this.ctx.beginPath();
    this.ctx.arc(x2, y2, width * 0.58, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x2, y2, width * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  _drawHandGrip(x, y, angle, side, onHandle = false, flip = false) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle + (side === "left" ? -0.12 : 0.08));
    if (flip) {
      this.ctx.scale(1, -1);
    }

    const palmColor = side === "right" ? "#e8b88a" : "#d9a87c";
    const strokeColor = "#9a6848";

    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1.2;
    this.ctx.fillStyle = "rgba(40,25,15,0.25)";
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 6.5, 5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = palmColor;
    if (onHandle) {
      this._roundRect(-6, -8, 12, 16, 4);
    } else {
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.fillStyle = palmColor;
    const curls = onHandle
      ? [
          { x: -4, y: -7, w: 2.4, h: 4 },
          { x: -1.5, y: -8, w: 2.4, h: 4.5 },
          { x: 1, y: -8, w: 2.4, h: 4.5 },
          { x: 3.5, y: -7, w: 2.4, h: 4 },
        ]
      : [
          { x: -5, y: -5.5, w: 2.2, h: 3.8 },
          { x: -2, y: -6.5, w: 2.2, h: 4.2 },
          { x: 1.5, y: -6.5, w: 2.2, h: 4.2 },
          { x: 4.5, y: -5.5, w: 2.2, h: 3.8 },
        ];

    for (const finger of curls) {
      this.ctx.beginPath();
      this.ctx.ellipse(finger.x, finger.y, finger.w, finger.h, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.fillStyle = "rgba(255,255,255,0.1)";
    this.ctx.beginPath();
    this.ctx.ellipse(-1, onHandle ? 1 : 0, 3, 2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  _roundRect(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  _strokeRoundRect(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  _drawRod(rodTip, rod, showReel) {
    const { handX, handY, reelX, reelY, x: tipX, y: tipY, angle } = rodTip;

    this.ctx.save();
    this.ctx.lineCap = "round";

    const handleGrad = this.ctx.createLinearGradient(reelX, reelY, handX, handY);
    handleGrad.addColorStop(0, "#3d2817");
    handleGrad.addColorStop(1, rod.handle);
    this.ctx.strokeStyle = handleGrad;
    this.ctx.lineWidth = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(reelX, reelY);
    this.ctx.lineTo(handX, handY);
    this.ctx.stroke();
    this._drawRodGripMark((reelX + handX) / 2, (reelY + handY) / 2, angle, true);

    const shaftGrad = this.ctx.createLinearGradient(handX, handY, tipX, tipY);
    shaftGrad.addColorStop(0, rod.shaft);
    shaftGrad.addColorStop(1, rod.tip);
    this.ctx.strokeStyle = shaftGrad;
    this.ctx.lineWidth = rod.width + 0.5;
    this.ctx.beginPath();
    this.ctx.moveTo(handX, handY);
    this.ctx.lineTo(tipX, tipY);
    this.ctx.stroke();

    this.ctx.strokeStyle = "rgba(255,255,255,0.15)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(handX + 1, handY + 1);
    this.ctx.lineTo(tipX + 1, tipY + 1);
    this.ctx.stroke();

    if (this.gear.rod === 1) {
      this.ctx.strokeStyle = "rgba(70, 45, 20, 0.5)";
      this.ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const t = i / 6;
        const knotX = handX + (tipX - handX) * t;
        const knotY = handY + (tipY - handY) * t;
        const perpX = -Math.sin(angle) * 2;
        const perpY = Math.cos(angle) * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(knotX - perpX, knotY - perpY);
        this.ctx.lineTo(knotX + perpX, knotY + perpY);
        this.ctx.stroke();
      }
    }

    if (showReel) {
      this.ctx.fillStyle = "#444";
      this.ctx.beginPath();
      this.ctx.arc(reelX, reelY, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#777";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(reelX, reelY, 6, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.fillStyle = "#666";
      this.ctx.beginPath();
      this.ctx.arc(reelX, reelY, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.strokeStyle = rod.tip;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(tipX, tipY);
    this.ctx.lineTo(tipX + Math.cos(angle) * 6, tipY + Math.sin(angle) * 6);
    this.ctx.stroke();

    this.ctx.restore();
  }

  _drawWater() {
    const w = FishingGame.BASE_W;
    const top = this.waterTop;
    const waterH = FishingGame.BASE_H - top;
    const nightMix = this._frame.nightMix ?? this._getDayNightMix();
    const rainDim = (this._frame.raining ?? this._isRaining()) ? 0.1 : 0;
    const mix = Math.min(1, nightMix + rainDim);

    const bucket = Math.round(mix * 32);
    if (this._waterBucket !== bucket) {
      this._waterBucket = bucket;
      const stops = [
        [0, this._lerpColor("#3db5e8", "#1a6a96", mix)],
        [0.15, this._lerpColor("#2a9fd4", "#0d4a6e", mix)],
        [0.45, this._lerpColor("#1a7ab5", "#062540", mix)],
        [0.75, this._lerpColor("#0d5f8f", "#042030", mix)],
        [1, this._lerpColor("#052f4a", "#021520", mix)],
      ];
      const water = this.ctx.createLinearGradient(0, top, 0, FishingGame.BASE_H);
      stops.forEach(([pos, color]) => water.addColorStop(pos, color));
      this._waterGrad = water;
    }
    this.ctx.fillStyle = this._waterGrad;
    this.ctx.fillRect(0, top, w, waterH);

    this._drawShallowWaterGlow(top, w, mix);
    if (!this._frame.reelFocus) {
      this._drawUnderwaterLightShafts(top, waterH, w, 1 - mix);
    }
    this._drawWaterWaveBands(top, waterH, w);
    this._drawWaterCaustics(top, waterH, w, mix);

    if (!this._frame.reelFocus) {
      this._drawDistantBoat(mix);
    }

    const shadowScale = 0.55 + this.gear.rod * 0.1;
    for (const fish of this.fishShadows) {
      const waveDrift = this._getWaveOffset(fish.x, fish.depth ?? 0.35) * 0.35;
      this._drawUnderwaterFishShadow(fish, shadowScale, waveDrift);
    }

    this._drawSharkFins();

    if (!this._frame.reelFocus) {
      this._drawDockReflection(top, w, mix);
      this._drawSurfaceSparkles(top, w, mix);
    }
    this._drawWaterSurfaceWaves(top, w);
    this._drawShorelineFoam(top, w);
    this._drawCelestialReflection(mix);

    for (const r of this.ripples) {
      this.ctx.save();
      this.ctx.lineCap = "round";
      this.ctx.strokeStyle = r.reject
        ? `rgba(248, 113, 113, ${r.alpha})`
        : `rgba(255,255,255,${r.alpha})`;
      this.ctx.lineWidth = r.reject ? 2.2 : 1.8;
      this.ctx.beginPath();
      this.ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  _drawShallowWaterGlow(top, w, mix) {
    const shallow = this.ctx.createLinearGradient(0, top, 0, top + 42);
    shallow.addColorStop(0, `rgba(120, 220, 255, ${0.22 * (1 - mix * 0.65)})`);
    shallow.addColorStop(0.55, `rgba(61, 181, 232, ${0.1 * (1 - mix * 0.5)})`);
    shallow.addColorStop(1, "rgba(61, 181, 232, 0)");
    this.ctx.fillStyle = shallow;
    this.ctx.fillRect(0, top, w, 42);
  }

  _drawUnderwaterLightShafts(top, waterH, w, dayMix) {
    if (dayMix < 0.15) return;

    const sunX = w * 0.78;
    this.ctx.save();
    this.ctx.globalAlpha = dayMix * 0.55;
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * 38;
      const shaft = this.ctx.createLinearGradient(sunX + offset, top, sunX + offset * 0.4, top + waterH * 0.72);
      shaft.addColorStop(0, "rgba(180, 235, 255, 0.18)");
      shaft.addColorStop(0.4, "rgba(100, 200, 240, 0.08)");
      shaft.addColorStop(1, "rgba(100, 200, 240, 0)");
      this.ctx.fillStyle = shaft;
      this.ctx.beginPath();
      this.ctx.moveTo(sunX + offset - 10, top + 8);
      this.ctx.lineTo(sunX + offset + 10, top + 8);
      this.ctx.lineTo(sunX + offset * 0.25 + 28, top + waterH * 0.7);
      this.ctx.lineTo(sunX + offset * 0.25 - 28, top + waterH * 0.7);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawWaterCaustics(top, waterH, w, mix) {
    if (mix > 0.75) return;

    const t = this.waterTime;
    const dayMix = 1 - mix;
    const count = this._frame.reelFocus ? 12 : 18;
    this.ctx.save();
    for (let i = 0; i < count; i++) {
      const seed = i * 97;
      const gx = ((seed * 13) % w) + Math.sin(t * 0.35 + seed) * 12;
      const gy = top + 36 + ((seed * 7) % (waterH * 0.55)) + Math.cos(t * 0.28 + seed * 0.4) * 8;
      const pulse = Math.sin(gx * 0.03 + t * 0.9 + seed) * Math.cos(gy * 0.02 - t * 0.6);
      if (pulse <= 0.2) continue;
      const alpha = (pulse - 0.2) * 0.07 * dayMix;
      this.ctx.fillStyle = `rgba(140, 230, 255, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.ellipse(gx, gy, 11 + pulse * 4, 4 + pulse * 2, t * 0.15 + seed * 0.02, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawDockReflection(top, w, mix) {
    const dockW = w * 0.55;
    this.ctx.save();
    const t = this.waterTime;
    for (let i = 0; i < 6; i++) {
      const rx = 24 + i * (dockW / 6);
      const rippleY = top + 10 + Math.sin(t * 0.6 + i) * 2;
      this.ctx.strokeStyle = `rgba(200, 170, 130, ${0.06 * (1 - mix)})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.ellipse(rx, rippleY, 14 + i * 2, 2.5, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  _drawSurfaceSparkles(top, w, mix) {
    const dayMix = 1 - mix;
    if (dayMix < 0.2) return;

    const t = this.waterTime;
    this.ctx.save();
    for (let i = 0; i < 10; i++) {
      const sx = (i * 47 + 18) % w;
      const phase = t * 1.1 + i * 1.7;
      const sparkle = Math.max(0, Math.sin(phase) * Math.cos(phase * 0.6 + sx * 0.02));
      if (sparkle < 0.55) continue;
      const sy = top + 4 + this._getWaveOffset(sx, 0) + Math.sin(i) * 2;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${(sparkle - 0.55) * 0.35 * dayMix})`;
      this.ctx.beginPath();
      this.ctx.ellipse(sx, sy, 3.5, 1.2, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawCelestialReflection(nightMix) {
    const cx = FishingGame.BASE_W * 0.82;
    const top = this.waterTop;
    const dayMix = 1 - nightMix;
    this.ctx.save();

    if (dayMix > 0.2) {
      const shimmer = 0.055 + Math.sin(this.waterTime * 0.85) * 0.028;
      for (let i = 0; i < 5; i++) {
        const spread = i * 14;
        const alpha = dayMix * shimmer * (1 - i * 0.18);
        this.ctx.fillStyle = `rgba(255, 220, 120, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, top + 12 + spread, 20 - i * 2.5, 5 - i * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    if (nightMix > 0.18) {
      const shimmer = 0.08 + Math.sin(this.waterTime * 0.75) * 0.035;
      for (let i = 0; i < 4; i++) {
        const spread = i * 16;
        const alpha = nightMix * shimmer * (1 - i * 0.2);
        this.ctx.fillStyle = `rgba(190, 205, 255, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, top + 14 + spread, 22 - i * 3, 6 - i * 0.8, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  _drawVignette() {
    const w = FishingGame.BASE_W;
    const h = FishingGame.BASE_H;
    const vignette = this.ctx.createRadialGradient(w * 0.5, h * 0.46, w * 0.32, w * 0.5, h * 0.5, w * 0.85);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.75, "rgba(0,0,0,0.05)");
    vignette.addColorStop(1, "rgba(0,0,0,0.2)");
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, w, h);
  }

  _drawWaterWaveBands(top, waterH, w) {
    const bands = [
      { depth: 0.1, alpha: 0.07, speed: 0.55, freq: 0.017, amp: 3.6 },
      { depth: 0.28, alpha: 0.048, speed: 0.42, freq: 0.014, amp: 2.8 },
      { depth: 0.52, alpha: 0.032, speed: 0.3, freq: 0.011, amp: 2.2 },
    ];
    const step = this._frame.reelFocus ? 24 : 18;
    const bottom = FishingGame.BASE_H;
    const t = this.waterTime;

    for (const band of bands) {
      const baseY = top + waterH * band.depth;

      this.ctx.beginPath();
      this.ctx.moveTo(0, baseY + this._getWaveOffset(0, band.depth));
      for (let x = step; x <= w; x += step) {
        const y =
          baseY +
          Math.sin(x * band.freq + t * band.speed) * band.amp +
          Math.sin(x * band.freq * 0.6 - t * band.speed * 0.65) * band.amp * 0.45;
        this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(w, bottom);
      this.ctx.lineTo(0, bottom);
      this.ctx.closePath();
      this.ctx.fillStyle = `rgba(255,255,255,${band.alpha})`;
      this.ctx.fill();
    }
  }

  _drawWaterSurfaceWaves(top, w) {
    const t = this.waterTime;
    const step = 8;

    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      const y = top + 4 + this._getWaveOffset(x, 0);
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    const crestGrad = this.ctx.createLinearGradient(0, top, w, top + 8);
    crestGrad.addColorStop(0, "rgba(255,255,255,0.42)");
    crestGrad.addColorStop(1, "rgba(190,235,255,0.14)");
    this.ctx.strokeStyle = crestGrad;
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    this.ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      const y = top + 12 + Math.sin(x * 0.021 - t * 0.52 + 2.1) * 1.6 + Math.sin(x * 0.038 + t * 0.35) * 0.9;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.strokeStyle = "rgba(190,235,255,0.2)";
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    const foam = this.ctx.createLinearGradient(0, top, 0, top + 8);
    foam.addColorStop(0, "rgba(255,255,255,0.1)");
    foam.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.fillStyle = foam;
    this.ctx.fillRect(0, top, w, 8);
    this.ctx.restore();
  }

  _drawSharkFins() {
    if (!this.sharkFins) return;

    for (const fin of this.sharkFins) {
      const waterH = FishingGame.BASE_H - this.waterTop;
      const y = this.waterTop + waterH * fin.depth;
      const bob = Math.sin(fin.phase) * 3;
      const x = fin.x;

      this.ctx.save();
      this.ctx.translate(x, y + bob);
      if (fin.dir < 0) this.ctx.scale(-1, 1);

      const depthMix = 0.35 + fin.depth * 0.45;
      const finFill = this._shadeColor("#3d5a78", Math.round(-10 * depthMix));
      const finEdge = this._shadeColor("#152536", 0);

      const buildDorsalPath = () => {
        this.ctx.beginPath();
        this.ctx.moveTo(-fin.size * 0.08, 8);
        this.ctx.quadraticCurveTo(fin.size * 0.05, -fin.size * 0.35, fin.size * 0.22, -fin.size * 0.92);
        this.ctx.quadraticCurveTo(fin.size * 0.38, -fin.size * 0.55, fin.size * 0.48, 4);
        this.ctx.quadraticCurveTo(fin.size * 0.18, 10, -fin.size * 0.08, 8);
        this.ctx.closePath();
      };

      const buildTailPath = () => {
        this.ctx.beginPath();
        this.ctx.moveTo(-fin.size * 0.42, 4);
        this.ctx.quadraticCurveTo(-fin.size * 0.12, -fin.size * 0.62, fin.size * 0.02, -fin.size * 0.18);
        this.ctx.quadraticCurveTo(fin.size * 0.18, -fin.size * 0.58, fin.size * 0.42, 2);
        this.ctx.quadraticCurveTo(fin.size * 0.16, fin.size * 0.14, fin.size * 0.02, fin.size * 0.06);
        this.ctx.quadraticCurveTo(-fin.size * 0.14, fin.size * 0.16, -fin.size * 0.42, 4);
        this.ctx.closePath();
      };

      const drawPath = fin.kind === "dorsal" ? buildDorsalPath : buildTailPath;

      this.ctx.fillStyle = finFill;
      drawPath();
      this.ctx.fill();

      this.ctx.strokeStyle = finEdge;
      this.ctx.lineWidth = 1.6;
      this.ctx.lineJoin = "round";
      drawPath();
      this.ctx.stroke();

      if (fin.kind === "dorsal") {
        this.ctx.strokeStyle = "rgba(255,255,255,0.22)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(fin.size * 0.12, -fin.size * 0.55);
        this.ctx.lineTo(fin.size * 0.28, -fin.size * 0.78);
        this.ctx.stroke();
      }

      this.ctx.fillStyle = "rgba(255,255,255,0.12)";
      this.ctx.beginPath();
      this.ctx.ellipse(fin.dir > 0 ? -fin.size * 0.15 : fin.size * 0.15, 2, fin.size * 0.32, 3.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  _drawSurfaceFish() {
    if (!this.surfaceFish || !this.fishSurfaced) return;
    if (this.state !== GameState.WAITING && this.state !== GameState.BITING) return;

    const { fish, x, y, t } = this.surfaceFish;
    const jump = Math.min(1, t / 28);
    const height = Math.sin(jump * Math.PI) * 26;
    const settle = jump >= 1 ? Math.sin(t * 0.08) * 3 : 0;
    const fishY = y - height - 6 + settle;
    const scale = this._getFishVisualScale(fish, 0.65);
    const angle = -0.5 + Math.sin(t * 0.15) * 0.2;

    this._drawFishSprite(x, fishY, fish, angle, scale);

    if (jump > 0.05 && jump < 0.95) {
      const splashAlpha = 0.45 * (1 - Math.abs(jump - 0.5) * 2);
      this.ctx.strokeStyle = `rgba(255,255,255,${splashAlpha})`;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 10;
        this.ctx.beginPath();
        this.ctx.ellipse(x + spread, y, 8 + i * 3, 3, 0, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  _drawBobberSprite(cx, cy, options = {}) {
    const { underwater = false, tilt = 0, glow = 0 } = options;
    const scale = underwater ? 0.72 : 1;
    const r = 10 * scale;
    const capW = 7 * scale;
    const capH = 4.5 * scale;
    const loopR = 3.2 * scale;
    const outline = Math.max(1.4, 1.8 * scale);

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(tilt);

    if (glow > 0) {
      const pulse = 0.65 + Math.sin(this.waterTime * 2.2) * 0.35;
      const glowGrad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.2);
      glowGrad.addColorStop(0, `rgba(74, 222, 128, ${0.28 * glow * pulse})`);
      glowGrad.addColorStop(0.55, `rgba(56, 189, 248, ${0.12 * glow * pulse})`);
      glowGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.lineWidth = outline;
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#111";

    this.ctx.fillStyle = "#e5252a";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(-r, 0);
    this.ctx.lineTo(r, 0);
    this.ctx.stroke();

    const capY = -r + 1;
    this.ctx.fillStyle = "#e5252a";
    this.ctx.fillRect(-capW / 2, capY - capH, capW, capH);
    this.ctx.strokeRect(-capW / 2, capY - capH, capW, capH);

    const loopY = capY - capH - loopR * 0.35;
    this.ctx.strokeStyle = "#111";
    this.ctx.lineWidth = outline;
    this.ctx.beginPath();
    this.ctx.arc(0, loopY, loopR, Math.PI + 0.35, -0.35);
    this.ctx.stroke();

    this.ctx.strokeStyle = "#c9a227";
    this.ctx.lineWidth = outline * 0.85;
    this.ctx.beginPath();
    this.ctx.arc(0, loopY, loopR * 0.72, Math.PI + 0.45, -0.45);
    this.ctx.stroke();

    this.ctx.restore();
  }

  _drawBobber() {
    if (this.state === GameState.CAUGHT) return;

    const lineEnd = this._getLineEnd();
    if (!lineEnd) return;

    const rodTip = this._getRodTip();

    if (lineEnd.isFish && lineEnd.fish) {
      this.ctx.strokeStyle = "rgba(220,220,220,0.6)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(rodTip.x, rodTip.y);
      this.ctx.lineTo(lineEnd.x, lineEnd.y);
      this.ctx.stroke();
      const fishAngle = Math.atan2(rodTip.y - lineEnd.y, rodTip.x - lineEnd.x);
      this._drawFishSprite(lineEnd.x, lineEnd.y, lineEnd.fish, fishAngle, this._getFishVisualScale(lineEnd.fish));
      return;
    }

    if (lineEnd.biting && this.pendingFish) {
      const peekScale = this._getFishVisualScale(this.pendingFish, 0.35);
      this._drawFishSprite(lineEnd.x + 8, lineEnd.y + 10, this.pendingFish, 0.3, peekScale, 0.55);
    }

    const x = lineEnd.x;
    const y = lineEnd.y;
    const storedY = this.bobber?.y ?? y;
    const surfaceY = this.bobber ? this._getBobberSurfaceY(this.bobber.x) : this.waterTop + 9;
    const underwater =
      this.bobber &&
      this.state !== GameState.CASTING &&
      !this.castAnim &&
      storedY > surfaceY + 8;
    const waveTilt = this.bobber ? Math.cos(this.bobber.x * 0.028 + this.waterTime * 0.75) * 0.05 : 0;
    const tilt = this.bobber ? Math.sin(this.bobber.bob) * 0.1 + waveTilt : 0;
    const bobberScale = underwater ? 0.72 : 1;
    const hookY = y - (10 * bobberScale + 4.5 * bobberScale + 3.2 * bobberScale * 1.35);

    const lineGrad = this.ctx.createLinearGradient(rodTip.x, rodTip.y, x, hookY);
    lineGrad.addColorStop(0, "rgba(240,240,240,0.75)");
    lineGrad.addColorStop(1, "rgba(200,210,220,0.45)");
    this.ctx.strokeStyle = lineGrad;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(rodTip.x, rodTip.y);
    this.ctx.lineTo(x, hookY);
    this.ctx.stroke();

    const bobberGlow =
      this.state === GameState.BITING ? 1 : this.state === GameState.WAITING ? 0.35 + this.bobberNibble * 0.5 : 0;
    this._drawBobberSprite(x, y, { underwater, tilt, glow: bobberGlow });

    if (!underwater) {
      this.ctx.fillStyle = "rgba(255,255,255,0.18)";
      this.ctx.beginPath();
      this.ctx.ellipse(x, y + 12 * bobberScale, 14, 4, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  _drawFishSprite(x, y, fish, angle, scale, alpha = 1) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    drawFishSprite(this.ctx, fish, { gameScale: scale, alpha });
    this.ctx.restore();
  }

  _shadeColor(hex, amount) {
    const key = `${hex}|${amount}`;
    const cached = this._shadeCache.get(key);
    if (cached) return cached;

    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    const color = `rgb(${r},${g},${b})`;
    this._shadeCache.set(key, color);
    return color;
  }

  _drawCaughtFish() {
    if (!this.caughtFish) return;

    const pose = this._getFishermanPose();
    const rodTip = this._getRodTip();
    const swing = Math.sin(this.catchSwing * 0.06);
    const anchorX = rodTip.x + 6 + swing * 8;
    const anchorY = Math.max(95, rodTip.y + 14);
    const hangLen = 58 + Math.abs(swing) * 12;
    const fishX = anchorX + swing * 6;
    const fishY = anchorY + hangLen;
    const fishAngle = Math.PI / 2 + swing * 0.12;
    const scale = this._getFishVisualScale(this.caughtFish, 0.55);
    const color = this.caughtFish.color || RARITY_COLORS[this.caughtFish.rarity] || "#3b82f6";

    this.ctx.save();

    this.ctx.strokeStyle = "rgba(220,220,220,0.85)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(anchorX, anchorY);
    this.ctx.quadraticCurveTo(
      (anchorX + fishX) / 2 + swing * 5,
      (anchorY + fishY) / 2 - 8,
      fishX,
      fishY - 10
    );
    this.ctx.stroke();

    this.ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    this.ctx.beginPath();
    this.ctx.ellipse(fishX, fishY + 4, 28 * scale, 10 * scale, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this._drawFishSprite(fishX, fishY, this.caughtFish, fishAngle, scale);

    const glowPulse = 0.55 + Math.sin(this.catchSwing * 0.12) * 0.25;
    this.ctx.save();
    this.ctx.globalAlpha = glowPulse * 0.4;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(fishX, fishY, 34 * scale, 16 * scale, fishAngle, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.restore();
  }

  _loop() {
    if (!this._running) {
      this._rafId = null;
      return;
    }

    const mobilePanel =
      typeof document !== "undefined" ? document.body?.dataset?.mobilePanel : undefined;
    if (mobilePanel && mobilePanel !== "play") {
      this._rafId = requestAnimationFrame(this._loop);
      return;
    }

    this._frame = {};
    this._update();

    let shakeX = 0;
    let shakeY = 0;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (this.screenShake > 0 && !reduceMotion) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
      this.screenShake *= 0.86;
      if (this.screenShake < 0.35) this.screenShake = 0;
    }

    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.ctx.clearRect(0, 0, FishingGame.BASE_W, FishingGame.BASE_H);
    this._drawSky();
    this._drawWater();
    this._drawDock();
    this._drawFisherman();
    this._drawSceneLighting();
    if (this.state !== GameState.CAUGHT) {
      this._drawSurfaceFish();
      this._drawBobber();
    }
    if (this.state === GameState.CAUGHT) {
      this._drawCaughtFish();
    }
    this._drawRain();
    if (!this._frame.reelFocus) {
      this._drawFireflies(this._frame.nightMix ?? this._getDayNightMix());
      this._drawEnvironmentBadge();
    }
    this._drawParticles();
    if (!this._frame.reelFocus) {
      this._drawVignette();
    }
    this.ctx.restore();

    this._rafId = requestAnimationFrame(this._loop);
  }
}
