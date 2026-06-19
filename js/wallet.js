import { CONFIG } from "./config.js";

let wallet = null;
let onChainBalance = null;

export function getWallet() {
  return wallet;
}

export function isWalletConnected() {
  return Boolean(wallet?.publicKey);
}

export function getPublicKey() {
  return wallet?.publicKey?.toString() ?? null;
}

export async function connectWallet() {
  const provider = window.solana;
  if (!provider?.isPhantom) {
    throw new Error("Phantom wallet not found. Install it from phantom.app");
  }

  const response = await provider.connect();
  wallet = provider;
  return response.publicKey.toString();
}

export async function disconnectWallet() {
  if (wallet?.disconnect) {
    await wallet.disconnect();
  }
  wallet = null;
  onChainBalance = null;
}

export async function fetchOnChainBalance() {
  if (!CONFIG.token.mintAddress || !wallet?.publicKey) {
    onChainBalance = null;
    return null;
  }

  try {
    const { Connection, PublicKey } = await import("https://esm.sh/@solana/web3.js@1.98.0");
    const { getAssociatedTokenAddress, getAccount } = await import(
      "https://esm.sh/@solana/spl-token@0.4.13"
    );

    const connection = new Connection(CONFIG.token.rpcUrl, "confirmed");
    const mint = new PublicKey(CONFIG.token.mintAddress);
    const owner = new PublicKey(wallet.publicKey.toString());
    const ata = await getAssociatedTokenAddress(mint, owner);

    try {
      const account = await getAccount(connection, ata);
      onChainBalance = Number(account.amount) / 10 ** CONFIG.token.decimals;
      return onChainBalance;
    } catch {
      onChainBalance = 0;
      return 0;
    }
  } catch (err) {
    console.warn("On-chain balance fetch failed:", err);
    onChainBalance = null;
    return null;
  }
}

export function getOnChainBalance() {
  return onChainBalance;
}

export async function spendTokens(amount) {
  if (!wallet?.publicKey) {
    throw new Error("Connect your Phantom wallet to buy upgrades.");
  }
  if (!CONFIG.token.mintAddress) {
    throw new Error("Token not configured yet.");
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid upgrade cost.");
  }

  const balance = await fetchOnChainBalance();
  if ((balance ?? 0) < parsedAmount) {
    throw new Error("Not enough $HOOKED in your wallet.");
  }

  const { Connection, PublicKey, Transaction } = await import("https://esm.sh/@solana/web3.js@1.98.0");
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    getAccount,
    createAssociatedTokenAccountInstruction,
  } = await import("https://esm.sh/@solana/spl-token@0.4.13");

  const connection = new Connection(CONFIG.token.rpcUrl, "confirmed");
  const mint = new PublicKey(CONFIG.token.mintAddress);
  const owner = new PublicKey(wallet.publicKey.toString());
  const treasury = new PublicKey(CONFIG.treasury.devWallet);
  const rawAmount = BigInt(Math.floor(parsedAmount * 10 ** CONFIG.token.decimals));

  const ownerAta = await getAssociatedTokenAddress(mint, owner);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);

  const tx = new Transaction();

  try {
    await getAccount(connection, ownerAta);
  } catch {
    throw new Error("Your wallet has no $HOOKED token account yet. Catch a fish first!");
  }

  try {
    await getAccount(connection, treasuryAta);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(owner, treasuryAta, treasury, mint));
  }

  tx.add(createTransferInstruction(ownerAta, treasuryAta, owner, rawAmount));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  let signature;
  if (wallet.signAndSendTransaction) {
    const result = await wallet.signAndSendTransaction(tx);
    signature = result.signature;
  } else if (wallet.signTransaction) {
    const signed = await wallet.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize());
  } else {
    throw new Error("Wallet cannot sign transactions.");
  }

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  onChainBalance = Math.max(0, (onChainBalance ?? 0) - parsedAmount);

  return signature;
}

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
