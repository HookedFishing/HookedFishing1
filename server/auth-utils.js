import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const JWT_SECRET = process.env.JWT_SECRET || "hooked-dev-secret-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "30d";
const WALLET_KEY = process.env.WALLET_ENCRYPTION_KEY || "";

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId, username) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  req.userId = payload.sub;
  req.username = payload.username;
  next();
}

export function validateUsername(username) {
  if (typeof username !== "string") return "Username is required";
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return "Username must be 3–20 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return "Username can only use letters, numbers, and _";
  return null;
}

export function validatePassword(password) {
  if (typeof password !== "string") return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  if (password.length > 128) return "Password is too long";
  return null;
}

function getEncryptionKey() {
  if (WALLET_KEY && WALLET_KEY.length >= 32) {
    return crypto.createHash("sha256").update(WALLET_KEY).digest();
  }
  return crypto.createHash("sha256").update(`${JWT_SECRET}:wallet-secrets`).digest();
}

export function encryptWalletSecret(secretBase58) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase58, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptWalletSecret(encryptedBase64) {
  const key = getEncryptionKey();
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function createCustodialWallet() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
  };
}
