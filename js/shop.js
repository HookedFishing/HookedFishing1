import { CONFIG, RARITY_COLORS, getCastSurfaceChance, getRodEffect, getRodVisual, getLineEffect, getBaitEffect } from "./config.js";
import { getUpgradeCost, canAffordUpgrade, getRecommendedUpgrade, getSpendableBalance } from "./player.js";
import { drawFishIcon } from "./fishdex.js";
import { rarityBadgeHtml } from "./ui.js";
import { renderEmptyCatch } from "./onboarding.js";

const GEAR_ICONS = { rod: "🎣", line: "🧵", bait: "🪱" };

export function renderShop(container, player, onUpgrade) {
  container.innerHTML = "";
  const recommended = getRecommendedUpgrade(player);
  const entries = Object.entries(CONFIG.upgrades);

  entries.sort(([keyA], [keyB]) => {
    const aRec = recommended?.key === keyA ? 0 : 1;
    const bRec = recommended?.key === keyB ? 0 : 1;
    return aRec - bRec;
  });

  for (const [key, upgrade] of entries) {
    const level = player.gear[key];
    const maxed = level >= upgrade.maxLevel;
    const cost = getUpgradeCost(key, level);
    const isRecommended = recommended?.key === key;
    const effect =
      key === "rod" ? getRodEffect(level) : key === "line" ? getLineEffect(level) : getBaitEffect(level);
    const levelPct = Math.round((level / upgrade.maxLevel) * 100);
    const nextRod =
      key === "rod" && !maxed ? getRodVisual(level + 1).label : null;
    const rodSwatch =
      key === "rod"
        ? `<span class="shop-rod-swatch" style="background:linear-gradient(135deg,${getRodVisual(level).shaft},${getRodVisual(level).tip})" title="${getRodVisual(level).label}"></span>`
        : "";

    const chips = getEffectChips(key, effect, level)
      .map((chip) => `<span class="shop-stat-chip">${chip}</span>`)
      .join("");

    let recommendHtml = "";
    if (isRecommended) {
      const { amount } = getSpendableBalance(player);
      if (recommended.affordable) {
        recommendHtml = `<span class="shop-recommend-chip">Recommended</span>`;
      } else if (cost) {
        const need = cost - amount;
        recommendHtml = `<span class="shop-recommend-chip shop-recommend-chip--save">Save ${need.toLocaleString()} more</span>`;
      }
    }

    const item = document.createElement("div");
    item.className = `shop-item${isRecommended ? " is-recommended" : ""}${recommended?.affordable && isRecommended ? " is-ready" : ""}`;
    item.innerHTML = `
      <div class="shop-item-header">
        <div class="shop-item-title">
          <span class="shop-item-icon">${GEAR_ICONS[key] || "⚙️"}</span>
          <span class="shop-item-name">${upgrade.name}</span>
          ${rodSwatch}
          ${recommendHtml}
        </div>
        <span class="shop-item-level${maxed ? " is-maxed" : ""}">Lv ${level}${maxed ? " MAX" : ""}</span>
      </div>
      <p class="shop-item-desc">${upgrade.description}${nextRod && isRecommended ? ` · Next: <strong>${nextRod}</strong>` : ""}</p>
      <div class="shop-stat-chips">${chips}</div>
      <div class="shop-level-bar" title="Level progress">
        <div class="shop-level-fill" style="width:${levelPct}%"></div>
      </div>
      <div class="shop-item-footer">
        <span class="upgrade-cost">${maxed ? "—" : `${cost.toLocaleString()} $HOOKED`}</span>
        <button class="btn btn-upgrade" data-upgrade="${key}" ${maxed ? "disabled" : ""}>
          ${maxed ? "Maxed" : "Upgrade"}
        </button>
      </div>
    `;

    const btn = item.querySelector(".btn-upgrade");
    if (!maxed) {
      btn.disabled = !canAffordUpgrade(player, key);
      btn.addEventListener("click", () => onUpgrade(key));
    }

    container.appendChild(item);
  }
}

function getEffectChips(key, effect, level) {
  if (key === "rod") {
    const visual = getRodVisual(level);
    const surfacePct = Math.round(getCastSurfaceChance(level) * 100);
    return [
      visual.label,
      `Cast ${Math.round(effect.castRange * 100)}%`,
      `Rise ${surfacePct}%`,
    ];
  }
  if (key === "line") {
    return [`${effect.maxWeight}kg max`, `+${Math.round(effect.reelEase * 100)}% reel`];
  }
  return [`Bite x${effect.biteSpeed.toFixed(1)}`, `+${Math.round(effect.rewardBonus * 100)}% rewards`];
}

function describeEffect(key, effect, level) {
  return getEffectChips(key, effect, level).join(" · ");
}

export function renderLatestCatch(container, lastCatch) {
  if (!lastCatch) {
    renderEmptyCatch(container);
    return;
  }

  container.className = "latest-catch has-catch";
  const color = RARITY_COLORS[lastCatch.rarity] || "#fff";
  const fish = lastCatch.id ? CONFIG.fish.find((f) => f.id === lastCatch.id) : null;

  container.innerHTML = `
    <div class="latest-catch-body">
      <div class="latest-catch-icon"></div>
      <div class="latest-catch-text">
        <span class="fish-name" style="color:${color}">${lastCatch.name}</span>
        <span class="fish-rarity-row">${rarityBadgeHtml(lastCatch.rarity)}<span class="fish-rarity" style="color:${color}">${lastCatch.rarity}</span></span>
        <span class="fish-reward">+${lastCatch.reward.toLocaleString()} $HOOKED</span>
      </div>
    </div>
  `;

  if (fish) {
    const iconHost = container.querySelector(".latest-catch-icon");
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    drawFishIcon(canvas, fish);
    iconHost.appendChild(canvas);
  }
}
