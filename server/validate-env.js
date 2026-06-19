const DEV_JWT = "hooked-dev-secret-change-in-production";

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const issues = [];

  const jwt = process.env.JWT_SECRET || "";
  if (!jwt || jwt === DEV_JWT || jwt.includes("your_random")) {
    issues.push("JWT_SECRET must be a strong random value (set in Railway Variables)");
  }

  const walletKey = process.env.WALLET_ENCRYPTION_KEY || "";
  if (walletKey.length < 32) {
    issues.push("WALLET_ENCRYPTION_KEY must be at least 32 characters");
  }

  const treasury = process.env.TREASURY_PRIVATE_KEY || "";
  if (!treasury || treasury.includes("your_base58")) {
    issues.push("TREASURY_PRIVATE_KEY must be set for on-chain rewards");
  }

  if (issues.length) {
    console.error("Production startup blocked — fix these environment variables:\n");
    for (const issue of issues) {
      console.error(`  • ${issue}`);
    }
    process.exit(1);
  }
}
