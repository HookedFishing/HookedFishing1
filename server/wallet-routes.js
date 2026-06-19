import { authMiddleware, decryptWalletSecret, verifyPassword } from "./auth-utils.js";
import { findUserById, getUserPublic, parseUserRow, updateUserPlayer } from "./store.js";
import { isValidSolanaAddress, transferSplFromCustodialSecret } from "./chain.js";

const MAX_WITHDRAW_PER_TX = 500000;
const MIN_WITHDRAW = 1;

export function registerWalletRoutes(app) {
  app.post("/api/wallet/private-key", authMiddleware, async (req, res) => {
    try {
      const row = findUserById(req.userId);
      if (!row) return res.status(404).json({ error: "Account not found" });

      const { password } = req.body || {};
      if (!password) return res.status(400).json({ error: "Password is required" });

      if (!(await verifyPassword(password, row.password_hash))) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      if (!row.wallet_secret) {
        return res.status(404).json({ error: "No private key stored for this account" });
      }

      const privateKey = decryptWalletSecret(row.wallet_secret);

      res.json({
        ok: true,
        publicKey: row.wallet_pubkey,
        privateKey,
      });
    } catch (err) {
      console.error("Private key export failed:", err);
      res.status(500).json({ error: err.message || "Could not export private key" });
    }
  });

  app.post("/api/wallet/withdraw", authMiddleware, async (req, res) => {
    try {
      const row = findUserById(req.userId);
      if (!row) return res.status(404).json({ error: "Account not found" });

      const { destination, amount } = req.body || {};
      const parsedAmount = Number(amount);

      if (!destination || typeof destination !== "string") {
        return res.status(400).json({ error: "Destination wallet address is required" });
      }

      const dest = destination.trim();
      if (!isValidSolanaAddress(dest)) {
        return res.status(400).json({ error: "Invalid Solana wallet address" });
      }

      if (!Number.isFinite(parsedAmount) || parsedAmount < MIN_WITHDRAW) {
        return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAW} $HOOKED` });
      }

      if (parsedAmount > MAX_WITHDRAW_PER_TX) {
        return res.status(400).json({ error: `Maximum ${MAX_WITHDRAW_PER_TX.toLocaleString()} $HOOKED per withdrawal` });
      }

      const user = parseUserRow(row);
      if (user.balance < parsedAmount) {
        return res.status(400).json({ error: "Not enough $HOOKED in your account balance" });
      }

      if (dest === user.walletPubkey) {
        return res.status(400).json({ error: "Use a different wallet than your Hooked custodial address" });
      }

      if (!row.wallet_secret) {
        return res.status(400).json({ error: "Custodial wallet not available for this account" });
      }

      const newBalance = user.balance - parsedAmount;
      updateUserPlayer(req.userId, user.player, newBalance);

      let payout;
      try {
        const secret = decryptWalletSecret(row.wallet_secret);
        payout = await transferSplFromCustodialSecret(secret, dest, parsedAmount);
      } catch (transferErr) {
        updateUserPlayer(req.userId, user.player, user.balance);
        throw transferErr;
      }

      res.json({
        ok: true,
        withdrawn: parsedAmount,
        destination: dest,
        balance: newBalance,
        signature: payout.signature,
        explorer: payout.explorer,
        user: getUserPublic(findUserById(req.userId)),
      });
    } catch (err) {
      console.error("Withdraw failed:", err);
      const msg = err.message || "Withdrawal failed";
      const status =
        msg.includes("not launched") || msg.includes("not configured") ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });
}
