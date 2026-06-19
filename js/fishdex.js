import { CONFIG, RARITY_COLORS } from "./config.js";
import { drawFishSprite } from "./fish-render.js";
import { rarityBadgeHtml } from "./ui.js";
import { renderEmptyDexMessage } from "./onboarding.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "common", label: "Common" },
  { id: "uncommon", label: "Uncommon" },
  { id: "rare", label: "Rare" },
  { id: "epic", label: "Epic" },
  { id: "legendary", label: "Legendary" },
];

export function setupFishdexFilters(container, onFilter) {
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "1";

  container.innerHTML = FILTERS.map(
    (f) =>
      `<button type="button" class="fishdex-filter${f.id === "all" ? " is-active" : ""}" data-filter="${f.id}" role="tab" aria-selected="${f.id === "all"}">${f.label}</button>`
  ).join("");

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".fishdex-filter");
    if (!btn) return;
    container.querySelectorAll(".fishdex-filter").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    onFilter(btn.dataset.filter);
  });
}

export function drawFishIcon(canvas, fish, { unknown = false, iconScale = 0.42 } = {}) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (unknown) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.globalAlpha = 0.22;
    drawFishSprite(ctx, fish, { iconScale });
    ctx.restore();

    ctx.fillStyle = "rgba(8, 20, 40, 0.55)";
    ctx.strokeStyle = "rgba(94, 168, 220, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7a9ab8";
    ctx.font = "bold 15px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", w / 2, h / 2 + 1);
    return;
  }

  ctx.save();
  ctx.translate(w / 2, h / 2);
  drawFishSprite(ctx, fish, { iconScale });
  ctx.restore();
}

function buildFishdexRow(fish, isCaught, highlightId) {
  const row = document.createElement("div");
  row.className = `fishdex-row${isCaught ? " is-caught" : " is-unknown"}${highlightId === fish.id ? " is-new" : ""}`;
  row.dataset.rarity = fish.rarity;
  row.dataset.fishId = fish.id;
  if (isCaught) row.title = `${fish.name} — ${fish.reward.toLocaleString()} $HOOKED`;

  const iconWrap = document.createElement("div");
  iconWrap.className = "fishdex-icon";
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  canvas.setAttribute("aria-hidden", "true");
  drawFishIcon(canvas, fish, { unknown: !isCaught });
  iconWrap.appendChild(canvas);

  const info = document.createElement("div");
  info.className = "fishdex-info";

  const name = document.createElement("span");
  name.className = "fishdex-name";
  if (isCaught) {
    name.textContent = fish.name;
    name.style.color = fish.color || RARITY_COLORS[fish.rarity] || "#fff";
  } else {
    name.textContent = "???";
  }

  const reward = document.createElement("span");
  reward.className = "fishdex-reward";
  reward.textContent = isCaught ? `${fish.reward.toLocaleString()} $HOOKED` : "?";

  const badge = document.createElement("span");
  badge.className = "fishdex-badge-wrap";
  badge.innerHTML = rarityBadgeHtml(fish.rarity, { caught: isCaught });

  info.append(name, badge, reward);
  row.append(iconWrap, info);
  return row;
}

export function updateDexProgress(container, player) {
  const caught = new Set(player.caughtFishIds || []);
  const totalCaught = caught.size;
  const totalFish = CONFIG.fish.length;
  const pct = Math.round((totalCaught / totalFish) * 100);
  const strong = container.querySelector(".fishdex-progress strong");
  const fill = container.querySelector(".fishdex-progress-fill");
  if (strong) strong.textContent = `${totalCaught} / ${totalFish}`;
  if (fill) fill.style.width = `${pct}%`;
}

export function patchFishdexCatch(container, fish, player, filter = "all", options = {}) {
  const { highlightId = null } = options;
  if (!container) return false;

  const list = container.querySelector(".fishdex-list");
  if (!list) return false;

  if (filter !== "all" && fish.rarity !== filter) {
    updateDexProgress(container, player);
    return true;
  }

  const row = list.querySelector(`[data-fish-id="${fish.id}"]`);
  if (!row) return false;

  const newRow = buildFishdexRow(fish, true, highlightId);
  row.replaceWith(newRow);
  updateDexProgress(container, player);
  return true;
}

export function renderFishCollection(container, player, filter = "all", options = {}) {
  const { highlightId = null } = options;
  if (!container) return;

  const caught = new Set(player.caughtFishIds || []);
  let fishList = [...CONFIG.fish].sort((a, b) => a.reward - b.reward);
  if (filter !== "all") {
    fishList = fishList.filter((f) => f.rarity === filter);
  }
  const totalCaught = caught.size;
  const totalFish = CONFIG.fish.length;
  const pct = Math.round((totalCaught / totalFish) * 100);

  container.innerHTML = renderEmptyDexMessage();

  const progressWrap = document.createElement("div");
  progressWrap.className = "fishdex-progress-wrap";
  progressWrap.innerHTML = `
    <p class="fishdex-progress">
      <span>Collection</span>
      <strong>${totalCaught} / ${totalFish}</strong>
    </p>
    <div class="fishdex-progress-bar">
      <div class="fishdex-progress-fill" style="width:${pct}%"></div>
    </div>
  `;
  container.appendChild(progressWrap);

  if (fishList.length === 0) {
    const empty = document.createElement("p");
    empty.className = "fishdex-filter-empty";
    empty.textContent = "No fish in this rarity tier.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "fishdex-list";

  for (const fish of fishList) {
    list.appendChild(buildFishdexRow(fish, caught.has(fish.id), highlightId));
  }

  container.appendChild(list);
}
