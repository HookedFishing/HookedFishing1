import { CONFIG } from "./config.js";

function apiBase() {
  if (CONFIG.api?.baseUrl) return CONFIG.api.baseUrl;
  return window.location.origin;
}

export async function claimOnChainReward(wallet, amount) {
  if (!CONFIG.token.mintAddress) {
    throw new Error("Token mint not configured");
  }

  const response = await fetch(`${apiBase()}${CONFIG.api.claimUrl}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, amount }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Reward claim failed");
  }

  return data;
}

export async function checkRewardsServer() {
  try {
    const res = await fetch(`${apiBase()}/api/health`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
