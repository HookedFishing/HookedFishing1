import { CONFIG, getRodEffect, getLineEffect, getBaitEffect, getRodVisual } from "./config.js";
import { getOnChainBalance, isWalletConnected } from "./wallet.js";
import { getAccountBalance, isAccountLoggedIn } from "./auth.js";

export function getUpgradeCost(upgradeKey, currentLevel) {
  const upgrade = CONFIG.upgrades[upgradeKey];
  if (currentLevel >= upgrade.maxLevel) return null;

  if (upgrade.lateLevelStart && currentLevel >= upgrade.lateLevelStart && upgrade.latePricing) {
    return getLateUpgradeCost(upgrade, currentLevel);
  }

  const levelIndex = currentLevel - 1;
  const tier = Math.floor(levelIndex / 5);
  const tierRamp = upgrade.tierRamp ?? 1.1;
  const levelRamp = upgrade.levelRamp ?? 0.05;

  const cost =
    upgrade.baseCost *
    upgrade.costMultiplier ** levelIndex *
    (1 + levelIndex * levelRamp) *
    tierRamp ** tier;

  return Math.floor(cost * (upgrade.costScale ?? 1));
}

function getLateUpgradeCost(upgrade, currentLevel) {
  const { lateLevelStart, latePricing } = upgrade;
  const { millionStart, phase1Base, phase1Growth, phase2Base, phase2Growth } = latePricing;
  const scale = upgrade.costScale ?? 1;

  if (currentLevel < millionStart) {
    const step = currentLevel - lateLevelStart;
    return Math.floor(phase1Base * phase1Growth ** step * scale);
  }

  const step = currentLevel - millionStart;
  return Math.floor(phase2Base * phase2Growth ** step * scale);
}

export function getGearEffects(gear) {
  const rod = getRodEffect(gear.rod);
  const line = getLineEffect(gear.line);
  const bait = getBaitEffect(gear.bait);
  return { rod, line, bait };
}

export function getSpendableBalance(player) {
  if (isAccountLoggedIn()) {
    return { source: "account", amount: getAccountBalance() };
  }
  const onChain = getOnChainBalance();
  if (isWalletConnected() && onChain !== null && CONFIG.token.mintAddress) {
    return { source: "wallet", amount: onChain };
  }
  return { source: "local", amount: player.balance };
}

export function canAffordUpgrade(player, upgradeKey) {
  const cost = getUpgradeCost(upgradeKey, player.gear[upgradeKey]);
  if (!cost) return false;
  const { amount } = getSpendableBalance(player);
  return amount >= cost;
}

export function getRecommendedUpgrade(player) {
  const priority = ["bait", "line", "rod"];
  for (const key of priority) {
    if (canAffordUpgrade(player, key)) return { key, affordable: true };
  }

  let closest = null;
  let closestGap = Infinity;
  const { amount } = getSpendableBalance(player);
  for (const key of priority) {
    const cost = getUpgradeCost(key, player.gear[key]);
    if (!cost) continue;
    const gap = cost - amount;
    if (gap > 0 && gap < closestGap) {
      closestGap = gap;
      closest = key;
    }
  }
  return closest ? { key: closest, affordable: false } : null;
}

export function getUpgradeGoal(player) {
  const rec = getRecommendedUpgrade(player);
  if (!rec) return null;
  const cost = getUpgradeCost(rec.key, player.gear[rec.key]);
  if (!cost) return null;
  const { amount } = getSpendableBalance(player);
  return {
    key: rec.key,
    name: CONFIG.upgrades[rec.key].name,
    cost,
    amount,
    pct: Math.min(100, Math.round((amount / cost) * 100)),
    gap: Math.max(0, cost - amount),
    affordable: rec.affordable,
  };
}

export function getUpgradeMilestoneMessage(key, oldLevel, newLevel) {
  if (key === "rod") {
    const oldLabel = getRodVisual(oldLevel).label;
    const newLabel = getRodVisual(newLevel).label;
    if (oldLabel !== newLabel) return `Rod evolved — ${newLabel}!`;
  }
  if (newLevel % 10 === 0) {
    return `${CONFIG.upgrades[key].name} reached Lv ${newLevel}!`;
  }
  return null;
}

export function getDexMilestone(caughtCount, totalFish) {
  const pct = Math.round((caughtCount / totalFish) * 100);
  const thresholds = [25, 50, 75, 100];
  for (const t of thresholds) {
    if (pct === t) return `Collection ${t}% complete!`;
  }
  return null;
}

export function formatBalance(player) {
  const { source, amount } = getSpendableBalance(player);
  if (source === "wallet" || source === "account") {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function awardCatch(player, fish, gear) {
  const { bait } = getGearEffects(gear);
  const bonus = Math.floor(fish.reward * bait.rewardBonus);
  const total = fish.reward + bonus;

  if (!isWalletConnected() && !isAccountLoggedIn()) {
    player.balance += total;
  }

  player.totalCaught += 1;
  player.catchStreak = (player.catchStreak || 0) + 1;
  if (!player.caughtFishIds) player.caughtFishIds = [];
  if (!player.caughtFishIds.includes(fish.id)) {
    player.caughtFishIds.push(fish.id);
  }
  player.lastCatch = {
    id: fish.id,
    name: fish.name,
    rarity: fish.rarity,
    reward: total,
    at: Date.now(),
  };

  let isPersonalBest = false;
  if (!player.bestCatch || total > player.bestCatch.reward) {
    isPersonalBest = true;
    player.bestCatch = {
      id: fish.id,
      name: fish.name,
      reward: total,
      rarity: fish.rarity,
    };
  }

  return { earned: total, isPersonalBest };
}

export function applyUpgrade(player, upgradeKey, options = {}) {
  const { skipBalanceCheck = false } = options;
  const upgrade = CONFIG.upgrades[upgradeKey];
  const currentLevel = player.gear[upgradeKey];
  const cost = getUpgradeCost(upgradeKey, currentLevel);

  if (!cost) return { ok: false, reason: "Max level reached" };
  if (!skipBalanceCheck && !canAffordUpgrade(player, upgradeKey)) {
    return { ok: false, reason: "Not enough $HOOKED" };
  }

  player.gear[upgradeKey] += 1;
  return { ok: true, cost, newLevel: player.gear[upgradeKey], useWallet: isWalletConnected() };
}

export function purchaseUpgrade(player, upgradeKey) {
  const result = applyUpgrade(player, upgradeKey);
  if (!result.ok) return result;

  if (!result.useWallet) {
    player.balance -= result.cost;
  }

  return result;
}
