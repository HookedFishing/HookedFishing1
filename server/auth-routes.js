import { randomUUID } from "crypto";
import {
  authMiddleware,
  createCustodialWallet,
  decryptWalletSecret,
  encryptWalletSecret,
  hashPassword,
  signToken,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./auth-utils.js";
import {
  createUser,
  findUserById,
  findUserByUsername,
  getUserPublic,
  parseUserRow,
  updateUserBalance,
  updateUserPlayer,
} from "./store.js";
import { defaultPlayerState, getMaxCatchReward } from "./game-config.js";
import { rewardsLive, transferSplTokens, transferSplFromCustodialSecret, getTreasuryPublicKey } from "./chain.js";

function sanitizePlayerState(input) {
  const base = defaultPlayerState();
  if (!input || typeof input !== "object") return base;

  const gear = input.gear || {};
  return {
    totalCaught: Math.max(0, Number(input.totalCaught) || 0),
    gear: {
      rod: Math.min(50, Math.max(1, Number(gear.rod) || 1)),
      line: Math.min(50, Math.max(1, Number(gear.line) || 1)),
      bait: Math.min(50, Math.max(1, Number(gear.bait) || 1)),
    },
    lastCatch: input.lastCatch || null,
    caughtFishIds: Array.isArray(input.caughtFishIds) ? input.caughtFishIds.slice(0, 200) : [],
    catchStreak: Math.max(0, Number(input.catchStreak) || 0),
    bestCatch: input.bestCatch || null,
  };
}

function mergeGuestImport(guestState) {
  const sanitized = sanitizePlayerState(guestState);
  return {
    ...sanitized,
    balance: Math.max(0, Number(guestState?.balance) || 0),
  };
}

export function registerAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, guestImport } = req.body || {};
      const userErr = validateUsername(username);
      if (userErr) return res.status(400).json({ error: userErr });
      const passErr = validatePassword(password);
      if (passErr) return res.status(400).json({ error: passErr });

      const trimmed = username.trim();
      if (findUserByUsername(trimmed)) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const wallet = createCustodialWallet();
      const passwordHash = await hashPassword(password);
      const playerState = guestImport ? mergeGuestImport(guestImport) : defaultPlayerState();
      const startingBalance = playerState.balance || 0;
      delete playerState.balance;

      const user = createUser({
        id: randomUUID(),
        username: trimmed,
        passwordHash,
        walletPubkey: wallet.publicKey,
        walletSecret: encryptWalletSecret(wallet.secretKey),
        playerState: { ...playerState, balance: startingBalance },
      });

      const publicUser = getUserPublic(user);
      const token = signToken(publicUser.id, publicUser.username);

      res.json({
        ok: true,
        token,
        user: publicUser,
      });
    } catch (err) {
      console.error("Register failed:", err);
      res.status(500).json({ error: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const userErr = validateUsername(username);
      if (userErr) return res.status(400).json({ error: userErr });
      if (!password) return res.status(400).json({ error: "Password is required" });

      const row = findUserByUsername(username.trim());
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const publicUser = getUserPublic(row);
      const token = signToken(publicUser.id, publicUser.username);

      res.json({
        ok: true,
        token,
        user: publicUser,
      });
    } catch (err) {
      console.error("Login failed:", err);
      res.status(500).json({ error: err.message || "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const row = findUserById(req.userId);
    if (!row) return res.status(404).json({ error: "Account not found" });
    res.json({ ok: true, user: getUserPublic(row) });
  });

  app.put("/api/auth/player", authMiddleware, (req, res) => {
    try {
      const row = findUserById(req.userId);
      if (!row) return res.status(404).json({ error: "Account not found" });

      const user = parseUserRow(row);
      const player = sanitizePlayerState(req.body?.player);
      updateUserPlayer(req.userId, player, user.balance);

      res.json({
        ok: true,
        user: getUserPublic(findUserById(req.userId)),
      });
    } catch (err) {
      console.error("Player sync failed:", err);
      res.status(500).json({ error: err.message || "Failed to save progress" });
    }
  });

  app.post("/api/game/catch", authMiddleware, async (req, res) => {
    try {
      const row = findUserById(req.userId);
      if (!row) return res.status(404).json({ error: "Account not found" });

      const { fishId, reward, player } = req.body || {};
      const parsedReward = Number(reward);
      const maxReward = getMaxCatchReward(fishId);

      if (!fishId || !maxReward) {
        return res.status(400).json({ error: "Invalid fish" });
      }
      if (!Number.isFinite(parsedReward) || parsedReward <= 0 || parsedReward > maxReward) {
        return res.status(400).json({ error: "Invalid reward amount" });
      }

      const user = parseUserRow(row);
      if (!user.walletPubkey) {
        return res.status(400).json({ error: "Account wallet not found" });
      }

      let payout = null;
      if (rewardsLive) {
        payout = await transferSplTokens(user.walletPubkey, parsedReward);
      }

      const nextPlayer = sanitizePlayerState(player || user.player);
      const newBalance = user.balance + parsedReward;
      updateUserPlayer(req.userId, nextPlayer, newBalance);

      res.json({
        ok: true,
        earned: parsedReward,
        balance: newBalance,
        onChain: Boolean(payout),
        signature: payout?.signature ?? null,
        explorer: payout?.explorer ?? null,
        user: getUserPublic(findUserById(req.userId)),
      });
    } catch (err) {
      console.error("Catch credit failed:", err);
      const msg = err.message || "Failed to credit catch";
      const status =
        msg.includes("not launched") || msg.includes("not configured") ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.post("/api/game/spend", authMiddleware, async (req, res) => {
    try {
      const row = findUserById(req.userId);
      if (!row) return res.status(404).json({ error: "Account not found" });

      const { amount, player } = req.body || {};
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const user = parseUserRow(row);
      if (user.balance < parsedAmount) {
        return res.status(400).json({ error: "Not enough $HOOKED" });
      }

      const treasuryWallet = getTreasuryPublicKey();
      if (rewardsLive && row.wallet_secret && treasuryWallet) {
        const secret = decryptWalletSecret(row.wallet_secret);
        await transferSplFromCustodialSecret(secret, treasuryWallet, parsedAmount);
      }

      const newBalance = user.balance - parsedAmount;
      const nextPlayer = player ? sanitizePlayerState(player) : user.player;
      updateUserPlayer(req.userId, nextPlayer, newBalance);

      res.json({
        ok: true,
        spent: parsedAmount,
        balance: newBalance,
        user: getUserPublic(findUserById(req.userId)),
      });
    } catch (err) {
      console.error("Spend failed:", err);
      const msg = err.message || "Failed to spend balance";
      const status =
        msg.includes("not launched") || msg.includes("not configured") ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });
}
