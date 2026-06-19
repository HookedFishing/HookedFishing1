import { CONFIG, getCastSurfaceChance, getRodEffect } from "./config.js";
import { getGearEffects } from "./player.js";

const RARITY_WEIGHTS = {
  common: 50,
  uncommon: 28,
  rare: 14,
  epic: 6,
  legendary: 2,
};

function pickRarity(rareBonus) {
  const weights = { ...RARITY_WEIGHTS };
  weights.rare *= 1 + rareBonus * 3;
  weights.epic *= 1 + rareBonus * 4;
  weights.legendary *= 1 + rareBonus * 6;
  weights.common *= Math.max(0.4, 1 - rareBonus * 2);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "common";
}

function getHeavyFishBias(gear) {
  const { rod, line } = getGearEffects(gear);
  return Math.min(
    1,
    line.reelEase * 1.6 +
      (line.maxWeight / 8) * 0.3 +
      rod.rareBonus * 2.4 +
      (gear.rod - 1) * 0.012 +
      (gear.line - 1) * 0.01
  );
}

function pickFishFromPool(pool, gear) {
  const { line } = getGearEffects(gear);
  const eligible = pool.filter((f) => f.weight <= line.maxWeight);
  if (!eligible.length) return null;
  if (eligible.length === 1) return eligible[0];

  const heavyBias = getHeavyFishBias(gear);
  const sorted = [...eligible].sort((a, b) => b.weight - a.weight);
  const weights = sorted.map((fish, index) => {
    const sizeRank = 1 - index / Math.max(1, sorted.length - 1);
    return 1 + heavyBias * sizeRank * 2.5;
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < sorted.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return sorted[i];
  }
  return sorted[sorted.length - 1];
}

export function rollCastSurface(rodLevel) {
  return Math.random() < getCastSurfaceChance(rodLevel);
}

export function getStarterFish() {
  return CONFIG.fish.find((f) => f.starter) || CONFIG.fish[0];
}

export function rollFish(gear, isFirstCatch = false) {
  if (isFirstCatch) return { ...getStarterFish() };

  const { rod, line } = getGearEffects(gear);
  const rarity = pickRarity(rod.rareBonus);
  const pool = CONFIG.fish.filter((f) => f.rarity === rarity);
  const picked = pickFishFromPool(pool, gear);

  if (picked) return { ...picked };

  const fallback = CONFIG.fish
    .filter((f) => f.weight <= line.maxWeight)
    .sort((a, b) => b.weight - a.weight)[0];
  return fallback ? { ...fallback } : { ...pool[0] };
}

export function getBiteDelayMs(gear) {
  const { bait } = getGearEffects(gear);
  const avgMs = 14000;
  const delay = avgMs * (0.75 + Math.random() * 0.45);
  return delay / bait.biteSpeed;
}

export function getReelDifficulty(fish, gear) {
  const { line, rod, bait } = getGearEffects(gear);
  const fishWeight = Math.max(0.15, fish.weight ?? 0.5);
  const capacityRatio = line.maxWeight / fishWeight;
  const capacityEase =
    capacityRatio >= 1 ? Math.min(0.24, 0.06 + (capacityRatio - 1) * 0.14) : 0;
  const gearEase =
    line.reelEase * 2.4 +
    capacityEase +
    rod.rareBonus * 2.2 +
    Math.min(0.1, bait.rewardBonus * 0.25);
  return Math.max(0.08, fish.difficulty - gearEase * 0.35);
}
