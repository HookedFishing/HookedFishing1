import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

export const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
export const MINT = new PublicKey(process.env.TOKEN_MINT || "G5w7X3X1zPMyCu5y5rr1qYV175iFkFVyZAy9pDLepump");
export const DECIMALS = Number(process.env.TOKEN_DECIMALS) || 6;
export const connection = new Connection(RPC, "confirmed");

let treasuryKeypair = null;
export let rewardsLive = false;

export function getTreasuryKeypair() {
  if (treasuryKeypair) return treasuryKeypair;

  const secret = process.env.TREASURY_PRIVATE_KEY;
  if (!secret || secret.includes("your_base58")) return null;

  treasuryKeypair = Keypair.fromSecretKey(bs58.decode(secret));
  return treasuryKeypair;
}

export function getTreasuryPublicKey() {
  return getTreasuryKeypair()?.publicKey?.toBase58() ?? null;
}

export async function checkMintLaunched() {
  try {
    const info = await connection.getAccountInfo(MINT);
    if (info) {
      rewardsLive = true;
      return true;
    }
  } catch (err) {
    console.warn("Mint check failed:", err.message);
  }
  rewardsLive = false;
  return false;
}

export function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return typeof address === "string" && address.length >= 32 && address.length <= 44;
  } catch {
    return false;
  }
}

function keypairFromSecretBase58(secretBase58) {
  return Keypair.fromSecretKey(bs58.decode(secretBase58));
}

export async function transferSplFromKeypair(senderKeypair, recipientAddress, amount, feePayerKeypair) {
  if (!rewardsLive) {
    throw new Error("Token not launched yet. On-chain transfers open when $HOOKED is live on Solana.");
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid amount");
  }

  const feePayer = feePayerKeypair || senderKeypair;
  const recipient = new PublicKey(recipientAddress);
  const rawAmount = BigInt(Math.floor(parsedAmount * 10 ** DECIMALS));

  const senderAta = await getAssociatedTokenAddress(MINT, senderKeypair.publicKey);
  const recipientAta = await getAssociatedTokenAddress(MINT, recipient);

  const tx = new Transaction();

  try {
    await getAccount(connection, recipientAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(feePayer.publicKey, recipientAta, recipient, MINT)
    );
  }

  tx.add(
    createTransferInstruction(senderAta, recipientAta, senderKeypair.publicKey, rawAmount)
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = blockhash;

  const signers =
    feePayer.publicKey.equals(senderKeypair.publicKey)
      ? [senderKeypair]
      : [senderKeypair, feePayer];
  tx.sign(...signers);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  return {
    signature,
    amount: parsedAmount,
    wallet: recipientAddress,
    explorer: `https://solscan.io/tx/${signature}`,
  };
}

/** Treasury → recipient (Phantom claims, account catch rewards). */
export async function transferSplTokens(recipientAddress, amount) {
  const treasury = getTreasuryKeypair();
  if (!treasury) {
    throw new Error("Treasury not configured. Set TREASURY_PRIVATE_KEY in server/.env");
  }
  return transferSplFromKeypair(treasury, recipientAddress, amount, treasury);
}

/** Custodial wallet → recipient (withdrawals). Treasury pays SOL fees when available. */
export async function transferSplFromCustodialSecret(secretBase58, recipientAddress, amount) {
  const custodial = keypairFromSecretBase58(secretBase58);
  const treasury = getTreasuryKeypair();
  return transferSplFromKeypair(custodial, recipientAddress, amount, treasury || custodial);
}
