/** Fish reward lookup for server-side catch validation (keep in sync with js/config.js). */
export const FISH_REWARDS = {
  "blue-minnow": 1,
  minnow: 1,
  perch: 2,
  bass: 5,
  trout: 8,
  flounder: 15,
  salmon: 25,
  pufferfish: 50,
  tuna: 75,
  bullshark: 125,
  tarpon: 175,
  "goliath-grouper": 250,
  marlin: 1000,
  "great-white": 2500,
  "giant-octopus": 5000,
  sardine: 1,
  goby: 3,
  carp: 4,
  sunfish: 6,
  walleye: 7,
  catfish: 10,
  snapper: 12,
  "red-drum": 18,
  stingray: 20,
  swordfish: 30,
  mahi: 35,
  barracuda: 40,
  monkfish: 45,
  lobster: 60,
  hammerhead: 100,
  mako: 150,
  bluefin: 200,
  thresher: 300,
  "giant-stingray": 400,
  coelacanth: 750,
  "whale-shark": 1500,
  megalodon: 3500,
  "colossal-squid": 6000,
  leviathan: 8000,
  "abyssal-angler": 10000,
};

/** Max bait bonus at max rod level — generous cap for reward validation. */
export const MAX_REWARD_MULTIPLIER = 1.7;

export function getMaxCatchReward(fishId) {
  const base = FISH_REWARDS[fishId];
  if (!base) return null;
  return Math.ceil(base * MAX_REWARD_MULTIPLIER);
}

export function defaultPlayerState() {
  return {
    balance: 0,
    totalCaught: 0,
    gear: { rod: 1, line: 1, bait: 1 },
    lastCatch: null,
    caughtFishIds: [],
    catchStreak: 0,
    bestCatch: null,
  };
}
