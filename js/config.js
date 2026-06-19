export const CONFIG = {
  token: {
    symbol: "HOOKED",
    name: "Hooked",
    decimals: 6,
    // Set this to your SPL token mint address when $HOOKED launches on Solana.
    mintAddress: "G5w7X3X1zPMyCu5y5rr1qYV175iFkFVyZAy9pDLepump",
    rpcUrl: "https://api.mainnet-beta.solana.com",
  },

  api: {
    claimUrl: "/api/claim",
  },
  // Public dev/treasury wallet — rewards are sent FROM here; upgrades are paid TO here.
  // NEVER put the private key in this repo or in the browser. Use a secure server.
  treasury: {
    devWallet: "7bw6Jx8AycbgZvmKJaB9pMhpUSUtfDf8GAPChUfM1Ha9",
  },

  guestId: "guest",

  fish: [
    { id: "blue-minnow", name: "Blue Minnow", rarity: "common", color: "#3b82f6", reward: 1, weight: 0.15, difficulty: 0.12, starter: true },
    { id: "minnow", name: "Minnow", rarity: "common", color: "#94a3b8", reward: 1, weight: 0.2, difficulty: 0.25 },
    { id: "perch", name: "Perch", rarity: "common", color: "#86efac", reward: 2, weight: 0.35, difficulty: 0.3 },
    { id: "bass", name: "Bass", rarity: "uncommon", color: "#4ade80", reward: 5, weight: 0.8, difficulty: 0.45 },
    { id: "trout", name: "Trout", rarity: "uncommon", color: "#f472b6", reward: 8, weight: 1.1, difficulty: 0.5 },
    { id: "flounder", name: "Flounder", rarity: "uncommon", color: "#c4a77d", reward: 15, weight: 1.4, difficulty: 0.52 },
    { id: "salmon", name: "Salmon", rarity: "rare", color: "#fb923c", reward: 25, weight: 2.5, difficulty: 0.65 },
    { id: "pufferfish", name: "Puffer Fish", rarity: "rare", color: "#facc15", reward: 50, weight: 2.2, difficulty: 0.58 },
    { id: "tuna", name: "Tuna", rarity: "epic", color: "#60a5fa", reward: 75, weight: 4.0, difficulty: 0.78 },
    { id: "bullshark", name: "Bull Shark", rarity: "epic", color: "#6b7280", reward: 125, weight: 4.5, difficulty: 0.82 },
    { id: "tarpon", name: "Tarpon", rarity: "epic", color: "#7dd3fc", reward: 175, weight: 5.0, difficulty: 0.84 },
    { id: "goliath-grouper", name: "Goliath Grouper", rarity: "epic", color: "#4a6741", reward: 250, weight: 5.8, difficulty: 0.88 },
    { id: "marlin", name: "Legendary Marlin", rarity: "legendary", color: "#facc15", reward: 1000, weight: 7.5, difficulty: 0.92 },
    { id: "great-white", name: "Great White Shark", rarity: "legendary", color: "#d1d5db", reward: 2500, weight: 9.0, difficulty: 0.95 },
    { id: "giant-octopus", name: "Giant Octopus", rarity: "legendary", color: "#c026d3", reward: 5000, weight: 12.0, difficulty: 0.98 },
    { id: "sardine", name: "Sardine", rarity: "common", color: "#64748b", reward: 1, weight: 0.18, difficulty: 0.14 },
    { id: "goby", name: "Goby", rarity: "common", color: "#78716c", reward: 3, weight: 0.32, difficulty: 0.28 },
    { id: "carp", name: "Carp", rarity: "common", color: "#ca8a04", reward: 4, weight: 0.4, difficulty: 0.32 },
    { id: "sunfish", name: "Sunfish", rarity: "common", color: "#f97316", reward: 6, weight: 0.55, difficulty: 0.38 },
    { id: "walleye", name: "Walleye", rarity: "uncommon", color: "#a3e635", reward: 7, weight: 0.95, difficulty: 0.46 },
    { id: "catfish", name: "Catfish", rarity: "uncommon", color: "#57534e", reward: 10, weight: 1.0, difficulty: 0.48 },
    { id: "snapper", name: "Red Snapper", rarity: "uncommon", color: "#ef4444", reward: 12, weight: 1.25, difficulty: 0.5 },
    { id: "red-drum", name: "Red Drum", rarity: "uncommon", color: "#dc2626", reward: 18, weight: 1.35, difficulty: 0.54 },
    { id: "stingray", name: "Stingray", rarity: "uncommon", color: "#6366f1", reward: 20, weight: 1.5, difficulty: 0.56 },
    { id: "swordfish", name: "Swordfish", rarity: "rare", color: "#818cf8", reward: 30, weight: 2.0, difficulty: 0.6 },
    { id: "mahi", name: "Mahi Mahi", rarity: "rare", color: "#22d3ee", reward: 35, weight: 2.3, difficulty: 0.62 },
    { id: "barracuda", name: "Barracuda", rarity: "rare", color: "#94a3b8", reward: 40, weight: 2.4, difficulty: 0.64 },
    { id: "monkfish", name: "Monkfish", rarity: "rare", color: "#713f12", reward: 45, weight: 2.6, difficulty: 0.66 },
    { id: "lobster", name: "Lobster", rarity: "rare", color: "#b91c1c", reward: 60, weight: 2.8, difficulty: 0.7 },
    { id: "hammerhead", name: "Hammerhead Shark", rarity: "epic", color: "#9ca3af", reward: 100, weight: 4.2, difficulty: 0.8 },
    { id: "mako", name: "Mako Shark", rarity: "epic", color: "#475569", reward: 150, weight: 4.8, difficulty: 0.83 },
    { id: "bluefin", name: "Bluefin Tuna", rarity: "epic", color: "#1d4ed8", reward: 200, weight: 5.2, difficulty: 0.85 },
    { id: "thresher", name: "Thresher Shark", rarity: "epic", color: "#64748b", reward: 300, weight: 5.5, difficulty: 0.87 },
    { id: "giant-stingray", name: "Giant Stingray", rarity: "epic", color: "#4338ca", reward: 400, weight: 6.0, difficulty: 0.89 },
    { id: "coelacanth", name: "Ancient Coelacanth", rarity: "legendary", color: "#65a30d", reward: 750, weight: 8.0, difficulty: 0.91 },
    { id: "whale-shark", name: "Whale Shark", rarity: "legendary", color: "#38bdf8", reward: 1500, weight: 9.5, difficulty: 0.93 },
    { id: "megalodon", name: "Megalodon", rarity: "legendary", color: "#334155", reward: 3500, weight: 10.5, difficulty: 0.96 },
    { id: "colossal-squid", name: "Colossal Squid", rarity: "legendary", color: "#be185d", reward: 6000, weight: 11.5, difficulty: 0.97 },
    { id: "leviathan", name: "Leviathan", rarity: "legendary", color: "#1e3a8a", reward: 8000, weight: 13.0, difficulty: 0.98 },
    { id: "abyssal-angler", name: "Abyssal Angler", rarity: "legendary", color: "#fcd34d", reward: 10000, weight: 13.5, difficulty: 0.99 },
  ],

  upgrades: {
    rod: {
      name: "Rod",
      description: "Cast farther, attract rarer fish, and catch bigger ones.",
      maxLevel: 50,
      baseSurfaceChance: 0.3,
      surfaceChancePer10Levels: 0.05,
      baseCost: 10,
      costMultiplier: 1.95,
      tierRamp: 1.12,
      levelRamp: 0.04,
      lateLevelStart: 10,
      latePricing: {
        millionStart: 26,
        phase1Base: 85000,
        phase1Growth: 1.215,
        phase2Base: 1200000,
        phase2Growth: 1.17,
      },
      visuals: [
        { label: "Wooden Pole", shaft: "#9a7b4f", tip: "#6b4f2a", handle: "#5c3d22", width: 3 },
        { label: "Bamboo Rod", shaft: "#c4a574", tip: "#8b6914", handle: "#6d4c2f", width: 3 },
        { label: "Fiberglass Rod", shaft: "#7d9b8a", tip: "#4a6b5a", handle: "#3d4f44", width: 3.5 },
        { label: "Carbon Rod", shaft: "#3d3d3d", tip: "#1a1a1a", handle: "#2a2a2a", width: 3 },
        { label: "Golden Rod", shaft: "#c9a227", tip: "#ffd24a", handle: "#8b6914", width: 4 },
      ],
      effects: [
        { castRange: 0.55, rareBonus: 0 },
        { castRange: 0.65, rareBonus: 0.02 },
        { castRange: 0.75, rareBonus: 0.05 },
        { castRange: 0.85, rareBonus: 0.1 },
        { castRange: 0.95, rareBonus: 0.18 },
      ],
    },
    line: {
      name: "Line",
      description: "Land heavier fish without snapping the line.",
      maxLevel: 50,
      baseCost: 10,
      costMultiplier: 1.95,
      tierRamp: 1.12,
      levelRamp: 0.04,
      costScale: 0.5,
      lateLevelStart: 10,
      latePricing: {
        millionStart: 26,
        phase1Base: 85000,
        phase1Growth: 1.215,
        phase2Base: 1200000,
        phase2Growth: 1.17,
      },
      effects: [
        { maxWeight: 1.0, reelEase: 0 },
        { maxWeight: 1.8, reelEase: 0.05 },
        { maxWeight: 2.8, reelEase: 0.1 },
        { maxWeight: 4.2, reelEase: 0.16 },
        { maxWeight: 7.0, reelEase: 0.24 },
      ],
    },
    bait: {
      name: "Bait",
      description: "Fish bite faster and pay bonus $HOOKED.",
      maxLevel: 50,
      baseCost: 10,
      costMultiplier: 1.95,
      tierRamp: 1.12,
      levelRamp: 0.04,
      costScale: 0.4,
      lateLevelStart: 10,
      latePricing: {
        millionStart: 26,
        phase1Base: 85000,
        phase1Growth: 1.215,
        phase2Base: 1200000,
        phase2Growth: 1.17,
      },
      effects: [
        { biteSpeed: 1.0, rewardBonus: 0 },
        { biteSpeed: 1.2, rewardBonus: 0.05 },
        { biteSpeed: 1.4, rewardBonus: 0.1 },
        { biteSpeed: 1.65, rewardBonus: 0.18 },
        { biteSpeed: 1.9, rewardBonus: 0.28 },
      ],
    },
  },
};

export function getCastSurfaceChance(rodLevel) {
  const rod = CONFIG.upgrades.rod;
  const tiers = Math.floor((rodLevel - 1) / 10);
  return rod.baseSurfaceChance + tiers * rod.surfaceChancePer10Levels;
}

export function getRodEffect(level) {
  const effects = CONFIG.upgrades.rod.effects;
  const idx = Math.min(level - 1, effects.length - 1);
  const effect = { ...effects[idx] };
  const bonusLevels = Math.max(0, level - effects.length);
  effect.castRange = Math.min(0.99, effect.castRange + bonusLevels * 0.008);
  effect.rareBonus = effect.rareBonus + bonusLevels * 0.018;
  return effect;
}

export function getRodVisual(level) {
  const visuals = CONFIG.upgrades.rod.visuals;
  return visuals[Math.min(level - 1, visuals.length - 1)];
}

export function getLineEffect(level) {
  const effects = CONFIG.upgrades.line.effects;
  const idx = Math.min(level - 1, effects.length - 1);
  const effect = { ...effects[idx] };
  const bonusLevels = Math.max(0, level - effects.length);
  effect.maxWeight = Math.min(15, effect.maxWeight + bonusLevels * 0.18);
  effect.reelEase = Math.min(0.52, effect.reelEase + bonusLevels * 0.0065);
  return effect;
}

export function getBaitEffect(level) {
  const effects = CONFIG.upgrades.bait.effects;
  const idx = Math.min(level - 1, effects.length - 1);
  const effect = { ...effects[idx] };
  const bonusLevels = Math.max(0, level - effects.length);
  effect.biteSpeed = Math.min(3.2, effect.biteSpeed + bonusLevels * 0.026);
  effect.rewardBonus = Math.min(0.65, effect.rewardBonus + bonusLevels * 0.008);
  return effect;
}

export const RARITY_COLORS = {
  common: "#94a3b8",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#facc15",
};
