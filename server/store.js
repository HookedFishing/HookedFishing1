import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defaultPlayerState } from "./game-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { users: [] };
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { users: [] };
  }
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function findUserByUsername(username) {
  const store = readStore();
  const lower = username.toLowerCase();
  return store.users.find((u) => u.username.toLowerCase() === lower) || null;
}

export function findUserById(id) {
  const store = readStore();
  return store.users.find((u) => u.id === id) || null;
}

export function createUser({ id, username, passwordHash, walletPubkey, walletSecret, playerState }) {
  const store = readStore();
  const player = { ...defaultPlayerState(), ...playerState };
  const balance = Math.max(0, Number(player.balance) || 0);
  delete player.balance;

  const row = {
    id,
    username,
    password_hash: passwordHash,
    wallet_pubkey: walletPubkey,
    wallet_secret: walletSecret,
    balance,
    player_json: JSON.stringify(player),
    created_at: Date.now(),
  };

  store.users.push(row);
  writeStore(store);
  return row;
}

export function updateUserBalance(userId, balance) {
  const store = readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  user.balance = balance;
  writeStore(store);
  return user;
}

export function updateUserPlayer(userId, playerState, balance) {
  const store = readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  user.player_json = JSON.stringify(playerState);
  user.balance = balance;
  writeStore(store);
  return user;
}

export function parseUserRow(row) {
  if (!row) return null;
  let player = defaultPlayerState();
  try {
    player = { ...player, ...JSON.parse(row.player_json) };
  } catch {
    /* keep defaults */
  }
  return {
    id: row.id,
    username: row.username,
    walletPubkey: row.wallet_pubkey,
    balance: row.balance,
    player,
    createdAt: row.created_at,
  };
}

export function getUserPublic(row) {
  const user = parseUserRow(row);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    walletPubkey: user.walletPubkey,
    balance: user.balance,
    player: user.player,
    createdAt: user.createdAt,
  };
}
