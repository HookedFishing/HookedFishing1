import { CONFIG, RARITY_COLORS, getRodVisual } from "./config.js";
import { getUpgradeGoal } from "./player.js";

const GEAR_ICONS = { rod: "🎣", line: "🧵", bait: "🪱" };

export function renderGearStrip(container, player) {
  if (!container) return;

  const items = Object.entries(CONFIG.upgrades)
    .map(([key, upgrade]) => {
      const level = player.gear[key];
      const maxed = level >= upgrade.maxLevel;
      const pct = Math.round((level / upgrade.maxLevel) * 100);
      const rodStyle = key === "rod" ? getRodVisual(level) : null;
      return `
        <div class="gear-chip${maxed ? " is-maxed" : ""}" title="${upgrade.name} Lv ${level}">
          <span class="gear-chip-icon">${GEAR_ICONS[key]}</span>
          <span class="gear-chip-label">${upgrade.name}</span>
          <span class="gear-chip-level">Lv ${level}</span>
          ${rodStyle ? `<span class="gear-chip-swatch" style="background:linear-gradient(135deg,${rodStyle.shaft},${rodStyle.tip})"></span>` : ""}
          <span class="gear-chip-bar"><span class="gear-chip-fill" style="width:${pct}%"></span></span>
        </div>
      `;
    })
    .join("");

  container.innerHTML = items;
}

export function getFishFightLabel(fish) {
  if (!fish) return "";
  if (fish.starter || (fish.difficulty ?? 1) <= 0.22) return "Easy fight";
  if (fish.rarity === "legendary" || (fish.difficulty ?? 0) >= 0.88) return "Tough fight!";
  if (fish.rarity === "epic" || (fish.difficulty ?? 0) >= 0.65) return "Feisty";
  if (fish.rarity === "rare") return "Lively";
  return "Normal";
}

export function renderUpgradeGoal(container, player) {
  if (!container) return;
  const goal = getUpgradeGoal(player);
  if (!goal) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  const icon = GEAR_ICONS[goal.key] || "⚙️";
  const label = goal.affordable
    ? `Ready — upgrade ${goal.name}!`
    : `${icon} ${goal.name}: ${goal.amount.toLocaleString()} / ${goal.cost.toLocaleString()} $HOOKED`;

  container.innerHTML = `
    <button type="button" class="upgrade-goal-btn${goal.affordable ? " is-ready" : ""}" data-upgrade-key="${goal.key}" title="Open shop">
      <div class="upgrade-goal-inner${goal.affordable ? " is-ready" : ""}">
        <span class="upgrade-goal-label">${label}</span>
        <div class="upgrade-goal-bar" role="progressbar" aria-valuenow="${goal.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress toward ${goal.name} upgrade">
          <div class="upgrade-goal-fill" style="width:${goal.pct}%"></div>
        </div>
        ${goal.affordable ? `<span class="upgrade-goal-gap">Tap to upgrade in shop</span>` : `<span class="upgrade-goal-gap">${goal.gap.toLocaleString()} to go</span>`}
      </div>
    </button>
  `;
}

export function updateStreakBadge(container, streak) {
  if (!container) return;
  if (streak >= 2) {
    container.textContent = `🔥 ${streak}`;
    container.classList.remove("hidden");
    container.title = `${streak} catches in a row`;
  } else {
    container.textContent = "";
    container.classList.add("hidden");
  }
}

export function updateSessionEarned(container, amount) {
  if (!container) return;
  if (amount > 0) {
    container.textContent = `+${amount.toLocaleString()} this session`;
    container.classList.remove("hidden");
  } else {
    container.textContent = "";
    container.classList.add("hidden");
  }
}

export function renderCollectionBadge(container, player) {
  if (!container) return;

  const caught = new Set(player.caughtFishIds || []);
  const total = CONFIG.fish.length;
  const pct = Math.round((caught.size / total) * 100);

  container.innerHTML = `
    <button type="button" class="collection-badge-btn" title="View fish collection">
      <span class="collection-ring" style="--pct:${pct}" title="${caught.size} of ${total} species caught">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle class="collection-ring-bg" cx="18" cy="18" r="15.5" />
        <circle class="collection-ring-fill" cx="18" cy="18" r="15.5" />
      </svg>
      <span class="collection-ring-label">${pct}%</span>
    </span>
    <span class="collection-badge-text">
      <span class="collection-badge-title">Dex</span>
      <span class="collection-badge-count">${caught.size}/${total}</span>
    </span>
    </button>
  `;
}

export function updateCollectionBadge(container, player) {
  if (!container) return;
  const ring = container.querySelector(".collection-ring");
  if (ring) {
    const caught = new Set(player.caughtFishIds || []);
    const total = CONFIG.fish.length;
    const pct = Math.round((caught.size / total) * 100);
    ring.style.setProperty("--pct", pct);
    const label = ring.querySelector(".collection-ring-label");
    const count = container.querySelector(".collection-badge-count");
    if (label) label.textContent = `${pct}%`;
    if (count) count.textContent = `${caught.size}/${total}`;
    ring.title = `${caught.size} of ${total} species caught`;
    return;
  }
  renderCollectionBadge(container, player);
}

export function pulseGearChip(container, upgradeKey) {
  if (!container) return;
  const keys = Object.keys(CONFIG.upgrades);
  const idx = keys.indexOf(upgradeKey);
  const chips = container.querySelectorAll(".gear-chip");
  const chip = chips[idx];
  if (!chip) return;
  chip.classList.remove("gear-chip-pop");
  void chip.offsetWidth;
  chip.classList.add("gear-chip-pop");
}

export function rarityBadgeHtml(rarity, { caught = true } = {}) {
  if (!caught) {
    return `<span class="rarity-badge is-hidden">???</span>`;
  }
  const color = RARITY_COLORS[rarity] || "#94a3b8";
  const label = rarity.slice(0, 3);
  return `<span class="rarity-badge rarity-${rarity}" style="--rarity-color:${color}">${label}</span>`;
}
