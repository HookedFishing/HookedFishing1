import { CONFIG } from "./config.js";
import { loadPlayer } from "./storage.js";

const TOKEN_KEY = "hooked_auth_token";

let accountUser = null;
let accountBalance = 0;

function apiBase() {
  if (CONFIG.api?.baseUrl) return CONFIG.api.baseUrl;
  return window.location.origin;
}

export function getAuthToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAuthToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function isAccountLoggedIn() {
  return Boolean(accountUser && getAuthToken());
}

export function getAccountUser() {
  return accountUser;
}

export function getAccountBalance() {
  return accountBalance;
}

export function getCustodialWalletPubkey() {
  return accountUser?.walletPubkey ?? null;
}

export async function authFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiBase()}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      clearAccountSession();
    }
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function applyUser(user) {
  accountUser = {
    id: user.id,
    username: user.username,
    walletPubkey: user.walletPubkey,
    player: user.player,
  };
  accountBalance = user.balance ?? 0;
}

export function clearAccountSession() {
  accountUser = null;
  accountBalance = 0;
  setAuthToken(null);
}

export function getGuestImportPayload() {
  const guest = loadPlayer(CONFIG.guestId);
  const hasProgress =
    guest.totalCaught > 0 ||
    guest.balance > 0 ||
    (guest.caughtFishIds?.length ?? 0) > 0 ||
    guest.gear?.rod > 1 ||
    guest.gear?.line > 1 ||
    guest.gear?.bait > 1;
  return hasProgress ? guest : null;
}

export async function registerAccount(username, password, { importGuest = false } = {}) {
  const body = { username, password };
  if (importGuest) {
    const guestImport = getGuestImportPayload();
    if (guestImport) body.guestImport = guestImport;
  }

  const data = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

  setAuthToken(data.token);
  applyUser(data.user);
  return data.user;
}

export async function loginAccount(username, password) {
  const data = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  setAuthToken(data.token);
  applyUser(data.user);
  return data.user;
}

export function logoutAccount() {
  clearAccountSession();
}

export async function restoreAccountSession() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const data = await authFetch("/api/auth/me");
    applyUser(data.user);
    return data.user;
  } catch {
    clearAccountSession();
    return null;
  }
}

export function applyAccountPlayerToLocal(player) {
  if (!accountUser) return player;
  const serverPlayer = accountUser.player;
  if (!serverPlayer) return player;

  return {
    ...player,
    ...serverPlayer,
    balance: accountBalance,
  };
}

export function setAccountFromUser(user) {
  applyUser(user);
}

export async function syncPlayerState(player) {
  if (!isAccountLoggedIn()) return null;

  const payload = { ...player };
  delete payload.balance;

  const data = await authFetch("/api/auth/player", {
    method: "PUT",
    body: JSON.stringify({ player: payload }),
  });

  applyUser(data.user);
  return data.user;
}

export async function recordAccountCatch(fishId, reward, player) {
  const payload = { ...player };
  delete payload.balance;

  const data = await authFetch("/api/game/catch", {
    method: "POST",
    body: JSON.stringify({ fishId, reward, player: payload }),
  });

  applyUser(data.user);
  return data;
}

export async function spendAccountBalance(amount, player) {
  const payload = { ...player };
  delete payload.balance;

  const data = await authFetch("/api/game/spend", {
    method: "POST",
    body: JSON.stringify({ amount, player: payload }),
  });

  applyUser(data.user);
  return data;
}

export async function withdrawAccountBalance(destination, amount) {
  const data = await authFetch("/api/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({ destination: destination.trim(), amount }),
  });

  applyUser(data.user);
  return data;
}

export async function fetchWalletPrivateKey(password) {
  const data = await authFetch("/api/wallet/private-key", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return data;
}
