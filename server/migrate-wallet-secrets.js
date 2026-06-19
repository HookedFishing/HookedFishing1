/**
 * One-time migration: re-encrypt custodial wallet secrets from dev default key
 * to WALLET_ENCRYPTION_KEY in .env. Safe to run multiple times (skips if decrypt fails).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const STORE_PATH = path.join(__dirname, "data", "users.json");
const OLD_WALLET_KEY = crypto
  .createHash("sha256")
  .update("hooked-dev-secret-change-in-production:wallet-secrets")
  .digest();

function keyFromEnv() {
  const walletKey = process.env.WALLET_ENCRYPTION_KEY || "";
  if (walletKey.length >= 32) {
    return crypto.createHash("sha256").update(walletKey).digest();
  }
  const jwt = process.env.JWT_SECRET || "hooked-dev-secret-change-in-production";
  return crypto.createHash("sha256").update(`${jwt}:wallet-secrets`).digest();
}

function decryptWithKey(encryptedBase64, key) {
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function encryptWithKey(secretBase58, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase58, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

const newKey = keyFromEnv();
if (!process.env.WALLET_ENCRYPTION_KEY || process.env.WALLET_ENCRYPTION_KEY.length < 32) {
  console.error("Set WALLET_ENCRYPTION_KEY (32+ chars) in .env before migrating.");
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
let migrated = 0;
let skipped = 0;

for (const user of store.users) {
  if (!user.wallet_secret) continue;
  try {
    decryptWithKey(user.wallet_secret, newKey);
    skipped += 1;
    continue;
  } catch {
    /* needs migration */
  }
  try {
    const plain = decryptWithKey(user.wallet_secret, OLD_WALLET_KEY);
    user.wallet_secret = encryptWithKey(plain, newKey);
    migrated += 1;
  } catch (err) {
    console.warn(`Could not migrate wallet for ${user.username}:`, err.message);
  }
}

fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
console.log(`Done. Migrated: ${migrated}, already on new key: ${skipped}`);
