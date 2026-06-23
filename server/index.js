import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerWalletRoutes } from "./wallet-routes.js";
import { validateProductionEnv } from "./validate-env.js";
import {
  MINT,
  getTreasuryKeypair,
  checkMintLaunched,
  rewardsLive,
  transferSplTokens,
} from "./chain.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(__dirname, ".env") });
validateProductionEnv();

const PORT = Number(process.env.PORT) || 3001;
const CANONICAL_HOST = process.env.CANONICAL_HOST || "www.hookedfishing.org";
const TREASURY_PUBKEY = "7bw6Jx8AycbgZvmKJaB9pMhpUSUtfDf8GAPChUfM1Ha9";
const MINT_POLL_MS = 5000;

const app = express();
app.set("trust proxy", 1);

let mintWatcher = null;

function productionSecurity(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();

  const host = (req.headers.host || "").split(":")[0].toLowerCase();

  if (host === "hookedfishing.org") {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }

  const proto = req.headers["x-forwarded-proto"];
  if (proto === "http") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }

  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

app.use(productionSecurity);

function startMintWatcher() {
  checkMintLaunched().then((live) => {
    if (live) {
      console.log("Token LIVE on Solana — automatic rewards ENABLED");
      return;
    }

    console.log("Rewards server running — waiting for token launch...");
    mintWatcher = setInterval(async () => {
      const launched = await checkMintLaunched();
      if (launched) {
        console.log("Token LIVE on Solana — automatic rewards ENABLED");
        if (mintWatcher) {
          clearInterval(mintWatcher);
          mintWatcher = null;
        }
      }
    }, MINT_POLL_MS);
  });
}

app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  const treasury = getTreasuryKeypair();
  res.json({
    ok: true,
    mint: MINT.toBase58(),
    rewardsLive,
    waitingForLaunch: !rewardsLive,
    treasuryConfigured: Boolean(treasury),
    treasuryWallet: treasury?.publicKey.toBase58() || TREASURY_PUBKEY,
    canonicalUrl: `https://${CANONICAL_HOST}`,
  });
});

app.post("/api/claim", async (req, res) => {
  try {
    const { wallet, amount } = req.body;
    const parsedAmount = Number(amount);

    if (!wallet || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Invalid wallet or amount" });
    }

    if (parsedAmount > 5000) {
      return res.status(400).json({ error: "Amount too large for single claim" });
    }

    const result = await transferSplTokens(wallet, parsedAmount);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Claim failed:", err);
    const status = err.message?.includes("not launched") || err.message?.includes("not configured") ? 503 : 500;
    res.status(status).json({ error: err.message || "Claim failed" });
  }
});

registerAuthRoutes(app);
registerWalletRoutes(app);

app.use(express.static(WEB_ROOT));

app.listen(PORT, "0.0.0.0", () => {
  const treasury = getTreasuryKeypair();
  console.log(`Hooked running at http://localhost:${PORT}`);
  console.log(`Game + rewards API on one server`);
  console.log(`Token mint: ${MINT.toBase58()}`);
  console.log(`Treasury: ${treasury ? treasury.publicKey.toBase58() : "NOT CONFIGURED"}`);
  startMintWatcher();
});
