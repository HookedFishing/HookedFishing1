import { CONFIG } from "./config.js";
import { loadPlayer, savePlayer, getPlayerId, flushSave } from "./storage.js";
import {
  connectWallet,
  disconnectWallet,
  fetchOnChainBalance,
  getPublicKey,
  isWalletConnected,
  shortAddress,
  spendTokens,
} from "./wallet.js";
import { awardCatch, formatBalance, applyUpgrade, getUpgradeCost, getUpgradeMilestoneMessage, getDexMilestone } from "./player.js";
import { renderShop, renderLatestCatch } from "./shop.js";
import { drawFishIcon, renderFishCollection, setupFishdexFilters, patchFishdexCatch } from "./fishdex.js";
import { renderGearStrip, renderCollectionBadge, updateCollectionBadge, pulseGearChip, rarityBadgeHtml, renderUpgradeGoal, getFishFightLabel, updateStreakBadge, updateSessionEarned } from "./ui.js";
import { playHaptic } from "./haptics.js";
import { initHowToPlay, showHowToPlay } from "./onboarding.js";
import { FishingGame, GameState } from "./game.js";
import { claimOnChainReward, checkRewardsServer } from "./claim.js";
import {
  isAccountLoggedIn,
  getAccountUser,
  getAccountBalance,
  getCustodialWalletPubkey,
  loginAccount,
  registerAccount,
  logoutAccount,
  restoreAccountSession,
  recordAccountCatch,
  spendAccountBalance,
  withdrawAccountBalance,
  fetchWalletPrivateKey,
  syncPlayerState,
  getGuestImportPayload,
} from "./auth.js";
import {
  unlockAudio,
  playBiteSplash,
  playCatchReward,
  playCastPlop,
  playFailBuzz,
  playUpgradeChime,
  playUiClick,
  playNibblePlop,
  toggleMuted,
  loadMutedPreference,
  isMuted,
  startReelSoundscape,
  updateReelSoundscape,
  updateReelTension,
  stopReelSoundscape,
  startWaitDrone,
  primeWaitDrone,
  updateWaitDrone,
  stopWaitDrone,
} from "./audio.js";

const els = {
  balance: document.getElementById("balance"),
  catchCount: document.getElementById("catch-count"),
  walletBtn: document.getElementById("wallet-btn"),
  accountBtn: document.getElementById("account-btn"),
  accountUserPill: document.getElementById("account-user-pill"),
  signOutBtn: document.getElementById("sign-out-btn"),
  accountStatus: document.getElementById("account-status"),
  currentWalletWrap: document.getElementById("current-wallet-wrap"),
  currentWalletAddress: document.getElementById("current-wallet-address"),
  headerWalletBar: document.getElementById("header-wallet-bar"),
  headerWalletAddress: document.getElementById("header-wallet-address"),
  withdrawSection: document.getElementById("withdraw-section"),
  withdrawBalance: document.getElementById("withdraw-balance"),
  withdrawForm: document.getElementById("withdraw-form"),
  withdrawDestination: document.getElementById("withdraw-destination"),
  withdrawAmount: document.getElementById("withdraw-amount"),
  withdrawMax: document.getElementById("withdraw-max"),
  withdrawError: document.getElementById("withdraw-error"),
  withdrawSubmit: document.getElementById("withdraw-submit"),
  walletSecretSection: document.getElementById("wallet-secret-section"),
  walletSecretForm: document.getElementById("wallet-secret-form"),
  walletSecretPassword: document.getElementById("wallet-secret-password"),
  walletSecretReveal: document.getElementById("wallet-secret-reveal"),
  walletSecretDisplay: document.getElementById("wallet-secret-display"),
  walletSecretKey: document.getElementById("wallet-secret-key"),
  walletSecretCopy: document.getElementById("wallet-secret-copy"),
  walletSecretHide: document.getElementById("wallet-secret-hide"),
  walletSecretError: document.getElementById("wallet-secret-error"),
  authModal: document.getElementById("auth-modal"),
  authForm: document.getElementById("auth-form"),
  authUsername: document.getElementById("auth-username"),
  authPassword: document.getElementById("auth-password"),
  authError: document.getElementById("auth-error"),
  authSubmit: document.getElementById("auth-submit"),
  authImportWrap: document.getElementById("auth-import-wrap"),
  authImportGuest: document.getElementById("auth-import-guest"),
  muteBtn: document.getElementById("mute-btn"),
  walletStatus: document.getElementById("wallet-status"),
  treasuryStatus: document.getElementById("treasury-status"),
  shopList: document.getElementById("shop-list"),
  latestCatch: document.getElementById("latest-catch"),
  fishCollection: document.getElementById("fish-collection"),
  fishdexFilters: document.getElementById("fishdex-filters"),
  howToPlay: document.getElementById("how-to-play"),
  tipsBtn: document.getElementById("tips-btn"),
  castHint: document.getElementById("cast-hint"),
  biteAlert: document.getElementById("bite-alert"),
  reelBarWrap: document.getElementById("reel-bar-wrap"),
  reelMarker: document.getElementById("reel-marker"),
  reelZone: document.querySelector("#reel-bar-wrap .reel-zone"),
  toast: document.getElementById("toast"),
  canvas: document.getElementById("game-canvas"),
  lakePanel: document.getElementById("lake-panel"),
  caCopy: document.getElementById("ca-copy"),
  gearStrip: document.getElementById("gear-strip"),
  upgradeGoal: document.getElementById("upgrade-goal"),
  collectionBadge: document.getElementById("collection-badge"),
  gameStatus: document.getElementById("game-status"),
  reelPercent: document.getElementById("reel-percent"),
  reelProgressFill: document.getElementById("reel-progress-fill"),
  reelTrack: document.getElementById("reel-track"),
  reelCombo: document.getElementById("reel-combo"),
  catchBurst: document.getElementById("catch-burst"),
  catchBurstName: document.getElementById("catch-burst-name"),
  catchBurstReward: document.getElementById("catch-burst-reward"),
  catchReveal: document.getElementById("catch-reveal"),
  catchRevealCard: document.getElementById("catch-reveal-card"),
  catchRevealIcon: document.getElementById("catch-reveal-icon"),
  catchRevealName: document.getElementById("catch-reveal-name"),
  catchRevealRarity: document.getElementById("catch-reveal-rarity"),
  catchRevealReward: document.getElementById("catch-reveal-reward"),
  catchRevealNew: document.getElementById("catch-reveal-new"),
  catchRevealDismiss: document.getElementById("catch-reveal-dismiss"),
  catchRevealClose: document.getElementById("catch-reveal-close"),
  catchRevealShare: document.getElementById("catch-reveal-share"),
  catchRevealStreak: document.getElementById("catch-reveal-streak"),
  catchRevealPb: document.getElementById("catch-reveal-pb"),
  streakBadge: document.getElementById("streak-badge"),
  sessionEarned: document.getElementById("session-earned"),
  reelFishPreview: document.getElementById("reel-fish-preview"),
  reelFishIcon: document.getElementById("reel-fish-icon"),
  reelFishName: document.getElementById("reel-fish-name"),
  reelFishFight: document.getElementById("reel-fish-fight"),
  balancePill: document.querySelector(".balance-pill"),
  modeBadge: document.getElementById("mode-badge"),
  mobileNav: document.querySelector(".mobile-nav"),
};

function updateModeBadge() {
  if (!els.modeBadge) return;
  const account = isAccountLoggedIn();
  const connected = isWalletConnected();

  if (account) {
    els.modeBadge.textContent = "Account";
    els.modeBadge.className = "mode-badge mode-account";
    els.modeBadge.title = "Signed in — balance saved on Hooked servers";
    return;
  }

  els.modeBadge.textContent = connected ? "Wallet" : "Guest";
  els.modeBadge.className = `mode-badge ${connected ? "mode-wallet" : "mode-guest"}`;
  els.modeBadge.title = connected
    ? "Rewards and upgrades use your connected Phantom wallet"
    : "Progress saved locally — sign in or connect Phantom";
}

function setupMobileNav() {
  if (!els.mobileNav) return;
  document.body.dataset.mobilePanel = "play";
  els.mobileNav.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel;
      if (!panel) return;
      playUiClick();
      document.body.dataset.mobilePanel = panel;
      els.mobileNav.querySelectorAll(".mobile-nav-btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
    });
  });
}

function handleReelZoneChange(min, max) {
  if (!els.reelTrack) return;
  const leftPct = `${(min * 100).toFixed(1)}%`;
  const widthPct = `${((max - min) * 100).toFixed(1)}%`;
  els.reelTrack.style.setProperty("--reel-zone-left", leftPct);
  els.reelTrack.style.setProperty("--reel-zone-width", widthPct);
}

function handleWaitPulse(nibbleTension = 0, elapsedMs = 0) {
  if (!els.lakePanel) return;
  const tensionKey = `${nibbleTension >= 0.08}|${nibbleTension >= 0.28}`;
  if (tensionKey !== handleWaitPulse._lastKey) {
    handleWaitPulse._lastKey = tensionKey;
    els.lakePanel.classList.toggle("lake-tension", nibbleTension > 0.08);
    els.lakePanel.classList.toggle("lake-tension-high", nibbleTension >= 0.28);
  }
  updateWaitDrone(nibbleTension);

  if (els.castHint && !els.castHint.classList.contains("hidden")) {
    const hintBucket = elapsedMs >= 4500 ? "recall" : nibbleTension > 0 ? "nibble" : "out";
    if (hintBucket !== handleWaitPulse._lastHint) {
      handleWaitPulse._lastHint = hintBucket;
      if (hintBucket === "recall") {
        els.castHint.textContent = "Tap water to recall line";
      } else if (hintBucket === "out") {
        els.castHint.textContent = "Line is out…";
      }
    }
  }
}

const STATUS_UI = {
  [GameState.IDLE]: { text: "Ready to cast", icon: "🎣", className: "status-idle" },
  [GameState.CASTING]: { text: "Casting…", icon: "🪝", className: "status-casting" },
  [GameState.WAITING]: { text: "Line is out", icon: "🎣", className: "status-waiting" },
  [GameState.BITING]: { text: "Fish on!", icon: "🐟", className: "status-biting" },
  [GameState.REELING]: { text: "Reeling in", icon: "⚡", className: "status-reeling" },
  [GameState.CAUGHT]: { text: "Caught!", icon: "✨", className: "status-caught" },
};

function updateMuteButton() {
  if (!els.muteBtn) return;
  const muted = isMuted();
  els.muteBtn.textContent = muted ? "🔇" : "🔊";
  els.muteBtn.setAttribute("aria-pressed", String(muted));
  els.muteBtn.title = muted ? "Unmute music and sound effects" : "Mute music and sound effects";
  els.muteBtn.setAttribute("aria-label", muted ? "Unmute music and sound effects" : "Mute music and sound effects");
  els.muteBtn.classList.toggle("is-muted", muted);
}

function handleMuteClick() {
  playUiClick();
  toggleMuted();
  updateMuteButton();
}

function updateTipsButton() {
  if (!els.tipsBtn || !els.howToPlay) return;
  const collapsed = els.howToPlay.classList.contains("is-collapsed");
  els.tipsBtn.classList.toggle("hidden", !collapsed);
}

function pulseStat(el) {
  if (!el) return;
  el.classList.remove("stat-pop");
  void el.offsetWidth;
  el.classList.add("stat-pop");
}

let playerId = getPlayerId({});
let player = loadPlayer(playerId);
let authTab = "login";
let toastTimer = null;
let fishdexFilter = "all";
let fishdexHighlightId = null;
let reelCombo = 0;
let sessionEarned = 0;
const REEL_COACH_KEY = "hooked_reel_coached";

function navigateToPanel(panel) {
  if (!panel) return;
  document.body.dataset.mobilePanel = panel;
  els.mobileNav?.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.panel === panel);
  });
  if (panel === "shop") {
    requestAnimationFrame(() => {
      const item = els.shopList?.querySelector(".shop-item.is-recommended.is-ready, .shop-item.is-recommended");
      item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

function updateHeaderStats() {
  updateStreakBadge(els.streakBadge, player.catchStreak || 0);
  updateSessionEarned(els.sessionEarned, sessionEarned);
}

function spawnBalanceFlyup(amount) {
  if (!els.balancePill || !amount) return;
  const fly = document.createElement("span");
  fly.className = "balance-flyup";
  fly.textContent = `+${amount.toLocaleString()}`;
  els.balancePill.appendChild(fly);
  setTimeout(() => fly.remove(), 1100);
}

function handleReelStart(fish) {
  if (!fish || !els.reelFishPreview) return;

  const color = fish.color || "#94a3b8";
  const fight = getFishFightLabel(fish);
  if (els.reelFishName) {
    els.reelFishName.textContent = fish.name;
    els.reelFishName.style.color = color;
  }
  if (els.reelFishFight) {
    els.reelFishFight.textContent = fight;
    els.reelFishFight.className = `reel-fish-fight fight-${fish.rarity}`;
  }
  if (els.reelFishIcon) {
    els.reelFishIcon.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    drawFishIcon(canvas, fish);
    els.reelFishIcon.appendChild(canvas);
  }
  els.reelFishPreview.classList.remove("hidden");

  const needsCoach = player.totalCaught === 0 && localStorage.getItem(REEL_COACH_KEY) !== "1";
  if (needsCoach && els.reelBarWrap) {
    els.reelBarWrap.classList.add("reel-bar-coach");
  }
}

function clearReelCoach() {
  localStorage.setItem(REEL_COACH_KEY, "1");
  els.reelBarWrap?.classList.remove("reel-bar-coach");
}

function showToast(message, type = "success", duration = 2400, linkUrl = null) {
  if (linkUrl) {
    els.toast.innerHTML = `${message} <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="toast-link">View tx</a>`;
  } else {
    els.toast.textContent = message;
  }
  els.toast.className = `toast ${type}`;
  els.toast.classList.remove("hidden", "toast-out");
  clearTimeout(toastTimer);
  clearTimeout(showToast._outTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add("toast-out");
    showToast._outTimer = setTimeout(() => {
      els.toast.classList.add("hidden");
      els.toast.classList.remove("toast-out");
    }, 180);
  }, duration);
}

function handleNibble() {
  playNibblePlop();
  playHaptic("nibble");
  if (els.castHint && !els.castHint.classList.contains("hidden")) {
    els.castHint.textContent = "Line is out…";
  }
}

function dismissCatchReveal() {
  if (!els.catchReveal) return;
  els.catchReveal.classList.remove("is-open");
  clearTimeout(dismissCatchReveal._timer);
  dismissCatchReveal._timer = setTimeout(() => {
    els.catchReveal.classList.add("hidden");
    game.releaseCaught();
  }, 340);
}

function showCatchReveal(fish, earned, { isNew = false, streak = 1, isPersonalBest = false } = {}) {
  if (!els.catchReveal) return;
  const color = fish.color || "#ffd24a";
  els.catchRevealCard.className = `catch-reveal-card rarity-${fish.rarity}`;
  if (els.catchRevealName) {
    els.catchRevealName.textContent = fish.name;
    els.catchRevealName.style.color = color;
  }
  if (els.catchRevealRarity) {
    els.catchRevealRarity.innerHTML = `${rarityBadgeHtml(fish.rarity)}<span style="color:${color}">${fish.rarity}</span>`;
  }
  if (els.catchRevealReward) {
    els.catchRevealReward.textContent = `+${earned.toLocaleString()} $HOOKED`;
  }
  if (els.catchRevealNew) {
    els.catchRevealNew.classList.toggle("hidden", !isNew);
  }
  if (els.catchRevealStreak) {
    if (streak >= 2) {
      els.catchRevealStreak.textContent = `🔥 ${streak} catch streak`;
      els.catchRevealStreak.classList.remove("hidden");
    } else {
      els.catchRevealStreak.textContent = "";
      els.catchRevealStreak.classList.add("hidden");
    }
  }
  if (els.catchRevealPb) {
    els.catchRevealPb.classList.toggle("hidden", !isPersonalBest);
  }
  if (els.catchRevealIcon) {
    els.catchRevealIcon.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 80;
    drawFishIcon(canvas, fish, { iconScale: 0.54 });
    els.catchRevealIcon.appendChild(canvas);
  }
  els.catchReveal.classList.remove("hidden", "is-open");
  void els.catchReveal.offsetWidth;
  requestAnimationFrame(() => {
    els.catchReveal.classList.add("is-open");
  });
  clearTimeout(dismissCatchReveal._timer);
  dismissCatchReveal._timer = setTimeout(dismissCatchReveal, 3200);
  els.catchReveal.dataset.shareText = `Caught ${fish.name} (+${earned.toLocaleString()} $HOOKED) in Hooked! 🎣`;
}

function shareCatchOnX() {
  const text = els.catchReveal?.dataset.shareText;
  if (!text) return;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  const popup = window.open(shareUrl, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(shareUrl);
  }
}

function showCatchBurst(fish, earned) {
  if (!els.catchBurst) return;
  const color = fish.color || "#ffd24a";
  els.catchBurst.className = `catch-burst rarity-${fish.rarity}`;
  if (els.catchBurstName) {
    els.catchBurstName.textContent = fish.name;
    els.catchBurstName.style.color = color;
  }
  if (els.catchBurstReward) {
    els.catchBurstReward.textContent = `+${earned.toLocaleString()} $HOOKED`;
  }
  els.catchBurst.classList.remove("hidden");
  void els.catchBurst.offsetWidth;
  els.catchBurst.classList.add("is-active");
  clearTimeout(showCatchBurst._timer);
  showCatchBurst._timer = setTimeout(() => {
    els.catchBurst?.classList.remove("is-active");
    els.catchBurst?.classList.add("hidden");
  }, fish.rarity === "legendary" ? 2200 : fish.rarity === "epic" ? 1800 : 1400);
}

function updateCastCoach(state) {
  if (!els.castHint) return;
  const coach = player.totalCaught === 0 && state === GameState.IDLE;
  els.castHint.classList.toggle("cast-hint-coach", coach);
}

function setupCaCopy() {
  const mint = CONFIG.token.mintAddress;
  if (!mint || !els.caCopy) return;

  els.caCopy.textContent = mint;
  els.caCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(mint);
      els.caCopy.classList.add("copied");
      showToast("Contract address copied!");
      setTimeout(() => els.caCopy.classList.remove("copied"), 1500);
    } catch {
      showToast("Could not copy — select and copy manually", "error");
    }
  });
}

function refreshUIAfterCatch(fish, isNewSpecies) {
  if (!player.caughtFishIds) player.caughtFishIds = [];
  els.balance.textContent = formatBalance(player);
  els.catchCount.textContent = player.totalCaught.toLocaleString();
  renderShop(els.shopList, player, handleUpgrade);
  renderLatestCatch(els.latestCatch, player.lastCatch);
  const patched = patchFishdexCatch(els.fishCollection, fish, player, fishdexFilter, {
    highlightId: isNewSpecies ? fish.id : fishdexHighlightId,
  });
  if (!patched) {
    renderFishCollection(els.fishCollection, player, fishdexFilter, {
      highlightId: isNewSpecies ? fish.id : fishdexHighlightId,
    });
  }
  updateCollectionBadge(els.collectionBadge, player);
  renderGearStrip(els.gearStrip, player);
  renderUpgradeGoal(els.upgradeGoal, player);
  updateHeaderStats();
  game.setGear(player.gear);
  updateModeBadge();
}

function refreshUI() {
  if (!player.caughtFishIds) player.caughtFishIds = [];
  els.balance.textContent = formatBalance(player);
  els.catchCount.textContent = player.totalCaught.toLocaleString();
  renderShop(els.shopList, player, handleUpgrade);
  renderLatestCatch(els.latestCatch, player.lastCatch);
  renderFishCollection(els.fishCollection, player, fishdexFilter, { highlightId: fishdexHighlightId });
  renderGearStrip(els.gearStrip, player);
  renderCollectionBadge(els.collectionBadge, player);
  renderUpgradeGoal(els.upgradeGoal, player);
  updateHeaderStats();
  game.setGear(player.gear);
  updateModeBadge();

  if (player.totalCaught >= 4 && els.howToPlay) {
    els.howToPlay.classList.add("is-collapsed");
  }
}

async function handleUpgrade(key) {
  const cost = getUpgradeCost(key, player.gear[key]);
  if (!cost) {
    showToast("Max level reached", "error");
    return;
  }
  const oldLevel = player.gear[key];

  if (isAccountLoggedIn()) {
    try {
      if (getAccountBalance() < cost) {
        showToast("Not enough $HOOKED in your account", "error");
        return;
      }
      await spendAccountBalance(cost, player);
      const result = applyUpgrade(player, key, { skipBalanceCheck: true });
      if (!result.ok) {
        showToast(result.reason, "error");
        return;
      }
      await syncPlayerState(player);
      const user = getAccountUser();
      player = { ...player, ...(user?.player || {}), balance: getAccountBalance() };
      savePlayer(playerId, player);
      refreshUI();
      playUpgradeChime();
      playHaptic("upgrade");
      pulseGearChip(els.gearStrip, key);
      const milestone = getUpgradeMilestoneMessage(key, oldLevel, result.newLevel);
      showToast(milestone || `${CONFIG.upgrades[key].name} upgraded to Lv ${result.newLevel}!`);
    } catch (err) {
      showToast(err.message || "Upgrade failed", "error");
    }
    return;
  }

  if (isWalletConnected() && CONFIG.token.mintAddress) {
    try {
      showToast(`Approve ${cost} $HOOKED in Phantom…`);
      await spendTokens(cost);
      const result = applyUpgrade(player, key, { skipBalanceCheck: true });
      if (!result.ok) {
        showToast(result.reason, "error");
        return;
      }
      savePlayer(playerId, player);
      await fetchOnChainBalance();
      refreshUI();
      playUpgradeChime();
      playHaptic("upgrade");
      pulseGearChip(els.gearStrip, key);
      const milestone = getUpgradeMilestoneMessage(key, oldLevel, result.newLevel);
      showToast(
        milestone || `${CONFIG.upgrades[key].name} upgraded to Lv ${result.newLevel}! Paid from wallet.`
      );
    } catch (err) {
      if (err?.code === 4001 || err?.message?.includes("User rejected")) {
        showToast("Upgrade cancelled.", "error");
        return;
      }
      showToast(err.message || "Wallet payment failed", "error");
    }
    return;
  }

  const result = applyUpgrade(player, key);
  if (!result.ok) {
    showToast(result.reason, "error");
    return;
  }
  player.balance -= cost;
  savePlayer(playerId, player);
  refreshUI();
  playUpgradeChime();
  playHaptic("upgrade");
  pulseGearChip(els.gearStrip, key);
  const milestone = getUpgradeMilestoneMessage(key, oldLevel, result.newLevel);
  showToast(milestone || `${CONFIG.upgrades[key].name} upgraded to Lv ${result.newLevel}!`);
}

let rewardsLive = false;
let serverMissingNotified = false;

function updateRewardsStatus(health) {
  if (!health || !els.treasuryStatus) return;

  const treasury = CONFIG.treasury?.devWallet;
  if (health.rewardsLive) {
    rewardsLive = true;
    els.treasuryStatus.textContent = `Rewards LIVE — paying from ${shortAddress(treasury)}`;
  } else if (health.treasuryConfigured) {
    rewardsLive = false;
    els.treasuryStatus.textContent = `Waiting for token launch… treasury ${shortAddress(treasury)}`;
  } else {
    rewardsLive = false;
    els.treasuryStatus.textContent = `Reward treasury: ${shortAddress(treasury)} (configure server/.env)`;
  }
  updateWithdrawAvailability();
}

function refreshBalanceStrip() {
  els.balance.textContent = formatBalance(player);
  updateAccountUI();
  updateWithdrawAvailability();
}

function updateWithdrawAvailability() {
  if (!els.withdrawSection || els.withdrawSection.classList.contains("hidden")) return;
  const bal = getAccountBalance();
  const canWithdraw = rewardsLive && bal >= 1;
  if (els.withdrawSubmit) {
    els.withdrawSubmit.disabled = !canWithdraw;
    els.withdrawSubmit.title = rewardsLive
      ? ""
      : "Withdrawals open when $HOOKED rewards are live on Solana";
  }
}

async function pollRewardsServer() {
  const health = await checkRewardsServer();
  const wasLive = rewardsLive;
  updateRewardsStatus(health);
  updateWithdrawAvailability();

  if (health?.rewardsLive && !wasLive) {
    showToast("$HOOKED is live! Rewards send automatically on catch.");
  } else if (!health && !serverMissingNotified) {
    showToast("Start Hooked with start.bat or npm start for on-chain rewards.", "error");
    serverMissingNotified = true;
  }

  if (health) serverMissingNotified = false;

  if (isWalletConnected()) {
    await fetchOnChainBalance();
    refreshBalanceStrip();
  }

  if (isAccountLoggedIn()) {
    try {
      const user = await restoreAccountSession();
      if (user) {
        player = { ...player, ...user.player, balance: user.balance };
        savePlayer(playerId, player);
        refreshBalanceStrip();
      }
    } catch {
      /* session refresh optional */
    }
  }
}

function loadAccountPlayer(user) {
  playerId = getPlayerId({ accountUserId: user.id });
  const cached = loadPlayer(playerId);
  player = {
    ...cached,
    ...user.player,
    balance: user.balance,
  };
  savePlayer(playerId, player);
}

function updateAccountUI() {
  const user = getAccountUser();
  const loggedIn = Boolean(user);

  if (loggedIn) {
    els.accountBtn?.classList.add("hidden");
    els.signOutBtn?.classList.remove("hidden");
    if (els.accountUserPill) {
      els.accountUserPill.textContent = user.username;
      els.accountUserPill.classList.remove("hidden");
      els.accountUserPill.title = `Signed in as ${user.username}`;
    }
  } else {
    els.accountBtn?.classList.remove("hidden");
    els.signOutBtn?.classList.add("hidden");
    els.accountUserPill?.classList.add("hidden");
    if (els.accountBtn) {
      els.accountBtn.textContent = "Sign In";
      els.accountBtn.classList.remove("connected");
      els.accountBtn.title = "Sign in with username and password";
    }
  }

  if (els.accountStatus) {
    if (user) {
      els.accountStatus.textContent = `Signed in as ${user.username} — balance saved on Hooked.`;
    } else {
      els.accountStatus.textContent = "Not signed in — create a free Hooked account or play as guest.";
    }
  }

  const wallet = getCustodialWalletPubkey();
  const showWallet = Boolean(user && wallet);

  if (els.currentWalletWrap) {
    els.currentWalletWrap.classList.toggle("hidden", !showWallet);
  }
  if (els.headerWalletBar) {
    els.headerWalletBar.classList.toggle("hidden", !showWallet);
  }

  const walletTargets = [els.currentWalletAddress, els.headerWalletAddress].filter(Boolean);
  for (const el of walletTargets) {
    if (showWallet && wallet) {
      el.textContent = wallet;
      el.title = "Click to copy wallet address";
    } else {
      el.textContent = "";
    }
  }

  if (els.withdrawSection) {
    els.withdrawSection.classList.toggle("hidden", !loggedIn);
  }
  if (els.walletSecretSection) {
    els.walletSecretSection.classList.toggle("hidden", !loggedIn);
    if (!loggedIn) clearWalletSecretUI();
  }
  if (els.withdrawBalance && loggedIn) {
    els.withdrawBalance.textContent = Math.floor(getAccountBalance()).toLocaleString();
  }
  if (els.withdrawSubmit && loggedIn) {
    updateWithdrawAvailability();
  }

  updateModeBadge();
}

function clearWalletSecretUI() {
  if (els.walletSecretPassword) els.walletSecretPassword.value = "";
  if (els.walletSecretKey) els.walletSecretKey.textContent = "";
  els.walletSecretDisplay?.classList.add("hidden");
  els.walletSecretForm?.classList.remove("hidden");
  els.walletSecretError?.classList.add("hidden");
  if (els.walletSecretReveal) {
    els.walletSecretReveal.disabled = false;
    els.walletSecretReveal.textContent = "Reveal private key";
  }
}

function setupWalletSecretExport() {
  els.walletSecretHide?.addEventListener("click", () => {
    playUiClick();
    clearWalletSecretUI();
  });

  els.walletSecretCopy?.addEventListener("click", async () => {
    playUiClick();
    const key = els.walletSecretKey?.textContent?.trim();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      showToast("Private key copied!");
    } catch {
      showToast("Could not copy — select and copy manually", "error");
    }
  });

  els.walletSecretForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAccountLoggedIn()) return;

    const password = els.walletSecretPassword?.value ?? "";
    els.walletSecretError?.classList.add("hidden");

    if (!password) {
      if (els.walletSecretError) {
        els.walletSecretError.textContent = "Enter your account password.";
        els.walletSecretError.classList.remove("hidden");
      }
      return;
    }

    try {
      if (els.walletSecretReveal) {
        els.walletSecretReveal.disabled = true;
        els.walletSecretReveal.textContent = "Loading…";
      }
      const data = await fetchWalletPrivateKey(password);
      if (els.walletSecretKey) els.walletSecretKey.textContent = data.privateKey;
      els.walletSecretForm?.classList.add("hidden");
      els.walletSecretDisplay?.classList.remove("hidden");
      if (els.walletSecretPassword) els.walletSecretPassword.value = "";
    } catch (err) {
      if (els.walletSecretError) {
        els.walletSecretError.textContent = err.message || "Could not load private key";
        els.walletSecretError.classList.remove("hidden");
      }
    } finally {
      if (els.walletSecretReveal) {
        els.walletSecretReveal.disabled = false;
        els.walletSecretReveal.textContent = "Reveal private key";
      }
    }
  });
}

async function copyWalletAddress(button) {
  const address = button?.textContent?.trim();
  if (!address) return;
  try {
    await navigator.clipboard.writeText(address);
    button.classList.add("copied");
    showToast("Wallet address copied!");
    setTimeout(() => button.classList.remove("copied"), 1500);
  } catch {
    showToast("Could not copy — select and copy manually", "error");
  }
}

function setupCurrentWalletCopy() {
  els.currentWalletAddress?.addEventListener("click", () => copyWalletAddress(els.currentWalletAddress));
  els.headerWalletAddress?.addEventListener("click", () => copyWalletAddress(els.headerWalletAddress));
}

function setupWithdrawForm() {
  els.withdrawMax?.addEventListener("click", () => {
    playUiClick();
    const bal = Math.floor(getAccountBalance());
    if (els.withdrawAmount) els.withdrawAmount.value = bal > 0 ? String(bal) : "";
  });

  els.withdrawForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAccountLoggedIn()) return;

    const destination = els.withdrawDestination?.value?.trim() ?? "";
    const amount = Number(els.withdrawAmount?.value);
    els.withdrawError?.classList.add("hidden");

    if (!destination) {
      if (els.withdrawError) {
        els.withdrawError.textContent = "Enter a destination Solana wallet address.";
        els.withdrawError.classList.remove("hidden");
      }
      return;
    }

    if (!Number.isFinite(amount) || amount < 1) {
      if (els.withdrawError) {
        els.withdrawError.textContent = "Enter an amount of at least 1 $HOOKED.";
        els.withdrawError.classList.remove("hidden");
      }
      return;
    }

    if (amount > getAccountBalance()) {
      if (els.withdrawError) {
        els.withdrawError.textContent = "Not enough balance for this withdrawal.";
        els.withdrawError.classList.remove("hidden");
      }
      return;
    }

    try {
      els.withdrawSubmit.disabled = true;
      els.withdrawSubmit.textContent = "Sending…";
      const data = await withdrawAccountBalance(destination, amount);
      player = { ...player, ...(data.user?.player || {}), balance: data.user?.balance ?? player.balance };
      playerId = getPlayerId({ accountUserId: getAccountUser().id });
      savePlayer(playerId, player);
      els.withdrawForm?.reset();
      updateAccountUI();
      refreshUI();
      showToast(`Withdrew ${amount.toLocaleString()} $HOOKED!`, "success", 3600, data.explorer || null);
    } catch (err) {
      if (els.withdrawError) {
        els.withdrawError.textContent = err.message || "Withdrawal failed";
        els.withdrawError.classList.remove("hidden");
      }
      showToast(err.message || "Withdrawal failed", "error");
    } finally {
      if (els.withdrawSubmit) {
        els.withdrawSubmit.textContent = "Withdraw to Wallet";
        els.withdrawSubmit.disabled = getAccountBalance() < 1;
      }
    }
  });
}

function showAuthModal(tab = "login") {
  if (!els.authModal) return;
  setAuthTab(tab);
  els.authModal.classList.remove("hidden");
  els.authError?.classList.add("hidden");
  els.authUsername?.focus();
}

function hideAuthModal() {
  els.authModal?.classList.add("hidden");
  els.authError?.classList.add("hidden");
  els.authForm?.reset();
}

function setAuthTab(tab) {
  authTab = tab;
  els.authModal?.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    const active = btn.dataset.authTab === tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  if (els.authSubmit) {
    els.authSubmit.textContent = tab === "register" ? "Create Account" : "Sign In";
  }
  if (els.authImportWrap) {
    const showImport = tab === "register" && Boolean(getGuestImportPayload());
    els.authImportWrap.classList.toggle("hidden", !showImport);
    if (els.authImportGuest && showImport) {
      els.authImportGuest.checked = true;
    }
  }
  if (els.authPassword) {
    els.authPassword.autocomplete = tab === "register" ? "new-password" : "current-password";
  }
}

async function handleSignOut() {
  if (!isAccountLoggedIn()) return;
  clearWalletSecretUI();
  logoutAccount();
  playerId = getPlayerId({});
  player = loadPlayer(playerId);
  updateAccountUI();
  updateWalletUI();
  refreshUI();
  showToast("Signed out");
}

async function handleAccountClick() {
  if (isAccountLoggedIn()) return;
  showAuthModal("login");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!els.authUsername || !els.authPassword) return;

  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  els.authError?.classList.add("hidden");

  try {
    if (isWalletConnected()) {
      await disconnectWallet();
    }

    const user =
      authTab === "register"
        ? await registerAccount(username, password, {
            importGuest: els.authImportGuest?.checked,
          })
        : await loginAccount(username, password);

    loadAccountPlayer(user);
    hideAuthModal();
    updateAccountUI();
    updateWalletUI();
    refreshUI();
    showToast(authTab === "register" ? `Welcome, ${user.username}!` : `Welcome back, ${user.username}!`);
  } catch (err) {
    if (els.authError) {
      els.authError.textContent = err.message || "Sign in failed";
      els.authError.classList.remove("hidden");
    }
  }
}

function setupAuthModal() {
  els.authForm?.addEventListener("submit", handleAuthSubmit);
  els.authModal?.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      playUiClick();
      setAuthTab(btn.dataset.authTab);
    });
  });
  els.authModal?.querySelectorAll("[data-auth-close]").forEach((el) => {
    el.addEventListener("click", () => {
      playUiClick();
      hideAuthModal();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.authModal && !els.authModal.classList.contains("hidden")) {
      hideAuthModal();
    }
  });
}

function updateWalletUI() {
  const pubkey = getPublicKey();

  if (pubkey) {
    els.walletBtn.textContent = shortAddress(pubkey);
    els.walletBtn.classList.add("connected");
    if (els.walletStatus) {
      els.walletStatus.textContent = `Phantom connected: ${shortAddress(pubkey)} — upgrades pay from your wallet.`;
    }
  } else {
    els.walletBtn.textContent = "Connect Wallet";
    els.walletBtn.classList.remove("connected");
    if (els.walletStatus) {
      els.walletStatus.textContent = "Phantom not connected.";
    }
  }
  updateModeBadge();
}

async function handleWalletClick() {
  try {
    if (isWalletConnected()) {
      await disconnectWallet();
      playerId = getPlayerId(isAccountLoggedIn() ? { accountUserId: getAccountUser().id } : {});
      player = loadPlayer(playerId);
      updateWalletUI();
      refreshUI();
      showToast("Wallet disconnected");
      return;
    }

    if (isAccountLoggedIn()) {
      logoutAccount();
      updateAccountUI();
    }

    const pubkey = await connectWallet();
    playerId = getPlayerId({ walletPubkey: pubkey });
    player = loadPlayer(playerId);
    await fetchOnChainBalance();
    updateWalletUI();
    refreshUI();
    showToast("Phantom connected!");
  } catch (err) {
    showToast(err.message || "Wallet connection failed", "error");
  }
}

function handleStateChange(state) {
  const waiting = state === GameState.WAITING;
  const biting = state === GameState.BITING;
  const reeling = state === GameState.REELING;

  updateCastCoach(state);
  els.castHint.classList.toggle("hidden", state !== GameState.IDLE && !waiting);
  if (els.lakePanel) {
    els.lakePanel.classList.toggle("lake-waiting", waiting);
    els.lakePanel.classList.toggle("lake-biting", biting);
    els.lakePanel.classList.toggle("lake-reeling", reeling);
    els.lakePanel.classList.toggle("lake-casting", state === GameState.CASTING);
    els.lakePanel.classList.toggle("lake-caught", state === GameState.CAUGHT);
    if (!waiting) {
      els.lakePanel.classList.remove("lake-tension", "lake-tension-high");
    }
  }
  if (waiting) {
    startWaitDrone();
    primeWaitDrone();
  } else {
    stopWaitDrone();
  }
  if (els.gameStatus) {
    const ui = STATUS_UI[state] || STATUS_UI[GameState.IDLE];
    els.gameStatus.textContent = `${ui.icon} ${ui.text}`;
    els.gameStatus.className = `game-status ${ui.className}`;
    els.gameStatus.classList.remove("status-pop");
    void els.gameStatus.offsetWidth;
    els.gameStatus.classList.add("status-pop");
  }
  if (waiting) {
    els.castHint.textContent = "Line is out…";
  } else if (state === GameState.IDLE) {
    els.castHint.textContent = player.totalCaught === 0
      ? "Tap the water below to cast your first line"
      : "Click the water to cast your line";
  } else if (state === GameState.CASTING) {
    playCastPlop();
  } else if (biting) {
    els.castHint.classList.add("hidden");
    playBiteSplash();
    playHaptic("bite");
  }
  if (biting || reeling) {
    navigateToPanel("play");
    const playBtn = els.mobileNav?.querySelector('[data-panel="play"]');
    if (playBtn) {
      playBtn.classList.add("nav-bite-pulse");
      setTimeout(() => playBtn.classList.remove("nav-bite-pulse"), 1200);
    }
  }

  els.biteAlert.classList.toggle("hidden", !biting);

  if (state === GameState.CAUGHT) {
    if (els.reelBarWrap && !els.reelBarWrap.classList.contains("hidden")) {
      els.reelBarWrap.classList.add("reel-bar-exit");
      els.reelBarWrap.classList.remove("is-active");
      clearTimeout(handleStateChange._reelExitTimer);
      handleStateChange._reelExitTimer = setTimeout(() => {
        els.reelBarWrap?.classList.add("hidden");
        els.reelBarWrap?.classList.remove("reel-bar-exit");
      }, 320);
    } else {
      els.reelBarWrap?.classList.add("hidden");
    }
  } else {
    clearTimeout(handleStateChange._reelExitTimer);
    els.reelBarWrap?.classList.toggle("hidden", !reeling);
    els.reelBarWrap?.classList.remove("reel-bar-exit");
    if (reeling) {
      els.reelBarWrap?.classList.add("is-active");
    } else {
      els.reelBarWrap?.classList.remove("is-active");
    }
  }

  if (!reeling && state !== GameState.CAUGHT) {
    els.reelFishPreview?.classList.add("hidden");
    els.reelBarWrap?.classList.remove("reel-bar-coach");
  }
  if (state === GameState.CASTING || state === GameState.IDLE) {
    els.canvas?.focus({ preventScroll: true });
  }

  if (state === GameState.CAUGHT) {
    els.castHint.classList.add("hidden");
    if (els.lakePanel) {
      els.lakePanel.classList.add("lake-catch-flash");
      setTimeout(() => els.lakePanel?.classList.remove("lake-catch-flash"), 280);
    }
  }

  if (reeling) {
    reelCombo = 0;
    lastReelUi = "";
    lastReelAudio = "";
    lastReelMarkerClasses = "";
    lastReelPercent = -1;
    lastReelOpacityKey = -1;
    reelMarkerSmooth = game.reelMarker ?? 0.5;
    reelProgressSmooth = 0;
    if (els.reelCombo) els.reelCombo.textContent = "";
    els.reelMarker.classList.remove("in-zone", "danger-zone", "tap-good", "tap-bad");
    setReelMarkerPosition(reelMarkerSmooth, true);
    if (els.reelPercent) els.reelPercent.textContent = "0%";
    setReelProgressFill(0);
    reelProgressSmooth = 0;
    if (els.reelBarWrap) {
      els.reelBarWrap.classList.remove("reel-holding-good", "reel-holding-bad", "reel-tap-good", "reel-tap-bad");
    }
    startReelSoundscape();
  } else {
    stopReelSoundscape();
  }
}

let lastReelUi = "";
let lastReelAudio = "";
let lastReelMarkerClasses = "";
let lastReelPercent = -1;
let lastReelOpacityKey = -1;
let reelMarkerSmooth = 0.5;
let reelProgressSmooth = 0;
let reelTrackWidth = 0;

function invalidateReelTrackWidth() {
  reelTrackWidth = 0;
}

function setReelMarkerPosition(marker, snap = false) {
  if (!els.reelMarker || !els.reelTrack) return;
  if (snap) {
    reelMarkerSmooth = marker;
  } else {
    reelMarkerSmooth += (marker - reelMarkerSmooth) * 0.92;
  }
  const pct = Math.max(0, Math.min(1, reelMarkerSmooth));
  if (!reelTrackWidth) reelTrackWidth = els.reelTrack.clientWidth;
  const x = pct * Math.max(0, reelTrackWidth - 14) + 7;
  els.reelMarker.style.setProperty("--marker-x", `${x}px`);
}

function setReelProgressFill(progress) {
  if (!els.reelProgressFill) return;
  reelProgressSmooth += (progress - reelProgressSmooth) * 0.5;
  const pct = Math.max(0, Math.min(100, reelProgressSmooth * 100));
  els.reelProgressFill.style.transform = `scaleX(${pct / 100})`;
}

function handleReelProgress(marker, progress, inZone, holding, hitGood = false, hitBad = false) {
  const opacity = (0.55 + progress * 0.45).toFixed(2);
  const pct = Math.round(progress * 100);

  if (hitGood) {
    if (lastReelUi !== "good-hit") {
      reelCombo += 1;
      playHaptic("reelGood");
      clearReelCoach();
      lastReelUi = "good-hit";
      if (els.reelCombo && reelCombo >= 2) {
        els.reelCombo.textContent = `${reelCombo}x combo!`;
      }
    }
  } else if (hitBad) {
    if (lastReelUi !== "bad-hit") {
      reelCombo = 0;
      lastReelUi = "bad-hit";
      if (els.reelCombo) els.reelCombo.textContent = "";
    }
  } else {
    lastReelUi = "";
  }

  setReelMarkerPosition(marker, hitGood || hitBad);
  const showGreen = hitGood || (inZone && !hitBad);
  const showRed = hitBad || (!inZone && !hitGood);
  const classKey = `${showGreen}|${showRed}|${hitGood}|${hitBad}`;
  if (classKey !== lastReelMarkerClasses) {
    lastReelMarkerClasses = classKey;
    els.reelMarker.classList.toggle("in-zone", showGreen);
    els.reelMarker.classList.toggle("danger-zone", showRed);
    els.reelMarker.classList.toggle("tap-good", hitGood);
    els.reelMarker.classList.toggle("tap-bad", hitBad);
  }

  if (els.reelZone) {
    const opacityKey = Math.round(parseFloat(opacity) * 20);
    if (opacityKey !== lastReelOpacityKey) {
      lastReelOpacityKey = opacityKey;
      els.reelZone.style.opacity = opacity;
    }
  }
  if (els.reelPercent && pct !== lastReelPercent) {
    lastReelPercent = pct;
    els.reelPercent.textContent = `${pct}%`;
  }
  setReelProgressFill(progress);
  if (els.reelBarWrap) {
    els.reelBarWrap.classList.toggle("reel-tap-good", hitGood);
    els.reelBarWrap.classList.toggle("reel-tap-bad", hitBad);
    els.reelBarWrap.classList.remove("reel-holding-good", "reel-holding-bad");
  }

  if (hitGood || hitBad) {
    updateReelSoundscape(true, hitGood);
    lastReelAudio = hitGood ? "good" : "bad";
  } else {
    updateReelTension(inZone, progress);
  }
}

async function handleCatch(fish) {
  const isNewSpecies = !player.caughtFishIds?.includes(fish.id);
  const caughtBefore = player.caughtFishIds?.length ?? 0;
  const catchSnapshot = {
    caughtFishIds: [...(player.caughtFishIds || [])],
    totalCaught: player.totalCaught,
    lastCatch: player.lastCatch ? { ...player.lastCatch } : null,
    catchStreak: player.catchStreak,
    bestCatch: player.bestCatch,
  };
  playCatchReward(fish.rarity);
  playHaptic("catch");
  const { earned, isPersonalBest } = awardCatch(player, fish, player.gear);
  sessionEarned += earned;
  const streak = player.catchStreak || 1;
  game.setCaughtReward(earned);
  savePlayer(playerId, player);
  if (fish.rarity === "epic" || fish.rarity === "legendary") {
    showCatchBurst(fish, earned);
  }
  clearTimeout(handleCatch._revealTimer);
  handleCatch._revealTimer = setTimeout(() => {
    showCatchReveal(fish, earned, { isNew: isNewSpecies, streak, isPersonalBest });
  }, 220);
  spawnBalanceFlyup(earned);
  if (isNewSpecies) {
    fishdexHighlightId = fish.id;
    setTimeout(() => {
      fishdexHighlightId = null;
    }, 4000);
  }

  const dexMilestone = getDexMilestone(player.caughtFishIds.length, CONFIG.fish.length);
  const toastType = fish.rarity === "legendary" ? "legendary" : fish.rarity === "epic" ? "epic" : "success";
  const toastDuration = fish.rarity === "legendary" ? 3600 : 2400;
  const newLabel = isNewSpecies ? " · New species!" : "";
  const milestoneLabel = dexMilestone && player.caughtFishIds.length > caughtBefore ? ` · ${dexMilestone}` : "";
  const pbLabel = isPersonalBest ? " · Personal best!" : "";
  const toastBase = `Caught ${fish.name}! +${earned} $HOOKED${newLabel}${milestoneLabel}${pbLabel}`;
  const showCatchToast =
    fish.rarity === "legendary" ||
    fish.rarity === "epic" ||
    isNewSpecies ||
    isPersonalBest ||
    Boolean(milestoneLabel);
  if (showCatchToast) {
    showToast(toastBase, toastType, toastDuration);
  }

  requestAnimationFrame(() => {
    refreshUIAfterCatch(fish, isNewSpecies);
    pulseStat(els.balance);
    pulseStat(els.catchCount);
    if (els.latestCatch) els.latestCatch.classList.add("has-catch");
    updateCastCoach(GameState.IDLE);
  });

  if (isAccountLoggedIn()) {
    void recordAccountCatch(fish.id, earned, player)
      .then((data) => {
        player = { ...player, ...data.user.player, balance: data.user.balance };
        savePlayer(playerId, player);
        refreshUI();
        if (data.onChain && data.explorer) {
          showToast(
            `+${earned.toLocaleString()} $HOOKED sent to your Hooked wallet!`,
            "success",
            3600,
            data.explorer
          );
        }
      })
      .catch((err) => {
        player.caughtFishIds = catchSnapshot.caughtFishIds;
        player.totalCaught = catchSnapshot.totalCaught;
        player.lastCatch = catchSnapshot.lastCatch;
        player.catchStreak = catchSnapshot.catchStreak;
        player.bestCatch = catchSnapshot.bestCatch;
        sessionEarned -= earned;
        savePlayer(playerId, player);
        refreshUI();
        showToast(`Could not save catch: ${err.message}`, "error", 2800);
      });
  } else if (isWalletConnected() && CONFIG.token.mintAddress) {
    const pubkey = getPublicKey();
    void claimOnChainReward(pubkey, earned)
      .then(async (result) => {
        await fetchOnChainBalance();
        refreshUI();
        console.log("Reward tx:", result.explorer);
      })
      .catch((err) => {
        showToast(`On-chain claim pending: ${err.message}`, "error", 2800);
      });
  }
}

function handleFail(message) {
  playFailBuzz();
  playHaptic("fail");
  player.catchStreak = 0;
  savePlayer(playerId, player);
  updateHeaderStats();
  showToast(message, "error");
}

const game = new FishingGame(els.canvas, {
  onStateChange: handleStateChange,
  onReelStart: handleReelStart,
  onReelProgress: handleReelProgress,
  onReelZoneChange: handleReelZoneChange,
  onWaitPulse: handleWaitPulse,
  onNibble: handleNibble,
  onCatch: handleCatch,
  onFail: handleFail,
  isFirstCatch: () => player.totalCaught === 0,
  getCatchCount: () => player.totalCaught,
});

function bindReelTap(el) {
  if (!el) return;
  el.addEventListener("click", (event) => {
    event.preventDefault();
    game.reelTap();
  });
}

els.muteBtn?.addEventListener("click", handleMuteClick);
els.canvas.addEventListener("pointerdown", unlockAudio);
els.walletBtn.addEventListener("pointerdown", unlockAudio);
els.accountBtn?.addEventListener("pointerdown", unlockAudio);
document.addEventListener("keydown", unlockAudio, { once: true });
els.walletBtn.addEventListener("click", () => {
  playUiClick();
  handleWalletClick();
});
els.accountBtn?.addEventListener("click", () => {
  playUiClick();
  handleAccountClick();
});
els.signOutBtn?.addEventListener("pointerdown", unlockAudio);
els.signOutBtn?.addEventListener("click", () => {
  playUiClick();
  handleSignOut();
});
setupAuthModal();
setupCurrentWalletCopy();
setupWithdrawForm();
setupWalletSecretExport();
bindReelTap(els.reelBarWrap);
els.lakePanel?.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#game-canvas, #reel-bar-wrap, #catch-reveal, button, .ca-bar")) return;
  if (game.state === GameState.BITING || game.state === GameState.REELING) {
    game.reelTap();
  }
});
window.addEventListener("resize", invalidateReelTrackWidth);
els.tipsBtn?.addEventListener("click", () => {
  playUiClick();
  showHowToPlay(els.howToPlay);
  updateTipsButton();
});
els.catchRevealShare?.addEventListener("click", () => {
  playUiClick();
  shareCatchOnX();
});
els.upgradeGoal?.addEventListener("click", (e) => {
  if (!e.target.closest(".upgrade-goal-btn")) return;
  playUiClick();
  navigateToPanel("shop");
});
els.collectionBadge?.addEventListener("click", (e) => {
  if (!e.target.closest(".collection-badge-btn")) return;
  playUiClick();
  navigateToPanel("dex");
});
els.catchRevealDismiss?.addEventListener("click", () => {
  playUiClick();
  dismissCatchReveal();
});
els.catchRevealClose?.addEventListener("click", () => {
  playUiClick();
  dismissCatchReveal();
});
els.catchReveal?.addEventListener("click", (e) => {
  if (
    e.target === els.catchReveal ||
    e.target.classList.contains("catch-reveal-backdrop")
  ) {
    dismissCatchReveal();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.catchReveal && !els.catchReveal.classList.contains("hidden")) {
    dismissCatchReveal();
  }
});

refreshUI();
updateWalletUI();
updateAccountUI();
loadMutedPreference();
updateMuteButton();
setupCaCopy();
setupMobileNav();
initHowToPlay(els.howToPlay, player, updateTipsButton);
updateTipsButton();
setupFishdexFilters(els.fishdexFilters, (filter) => {
  fishdexFilter = filter;
  renderFishCollection(els.fishCollection, player, fishdexFilter, { highlightId: fishdexHighlightId });
});
handleStateChange(GameState.IDLE);
pollRewardsServer();
setInterval(() => {
  if (document.visibilityState === "visible") pollRewardsServer();
}, 12000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushSave(playerId, player);
    if (isAccountLoggedIn()) {
      void syncPlayerState(player).catch(() => {});
    }
  }
});

void restoreAccountSession().then((user) => {
  if (!user) return;
  loadAccountPlayer(user);
  updateAccountUI();
  refreshUI();
});
