const STORAGE_KEY = "hooked_player_v1";

export function getPlayerId({ walletPubkey, accountUserId } = {}) {
  if (accountUserId) return `user:${accountUserId}`;
  return walletPubkey || "guest";
}

export function loadPlayer(playerId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const player =
      all[playerId] || {
        balance: 0,
        totalCaught: 0,
        gear: { rod: 1, line: 1, bait: 1 },
        lastCatch: null,
        caughtFishIds: [],
        catchStreak: 0,
        bestCatch: null,
      };
    if (!player.caughtFishIds) player.caughtFishIds = [];
    if (player.catchStreak == null) player.catchStreak = 0;
    return player;
  } catch {
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
}

export function savePlayer(playerId, data) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[playerId] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function flushSave(playerId, data) {
  return savePlayer(playerId, data);
}
