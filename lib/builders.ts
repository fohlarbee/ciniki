import {
  Authorized,
  Keypair,
  Lockup,
  PublicKey,
  StakeProgram,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { connection } from "./solana";

export async function buildTx(payer: PublicKey, ixs: TransactionInstruction[], extraSigners: Keypair[] = []): Promise<string> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  if (extraSigners.length) tx.sign(extraSigners);
  return Buffer.from(tx.serialize()).toString("base64");
}

export async function buildSolTransfer(from: PublicKey, to: PublicKey, lamports: bigint) {
  return buildTx(from, [SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports })]);
}

export async function buildSplTransfer(from: PublicKey, to: PublicKey, mint: PublicKey, rawAmount: bigint) {
  const mintInfo = await connection.getAccountInfo(mint, "confirmed");
  if (!mintInfo) throw new Error("Token mint not found on-chain");
  const programId = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const decimals = (await getMint(connection, mint, "confirmed", programId)).decimals;
  const src = getAssociatedTokenAddressSync(mint, from, true, programId);
  const dst = getAssociatedTokenAddressSync(mint, to, true, programId);

  const srcAcc = await connection.getAccountInfo(src, "confirmed");
  if (!srcAcc) throw new Error("You do not hold this token");
  const dstExists = !!(await connection.getAccountInfo(dst, "confirmed"));

  const ixs: TransactionInstruction[] = [];
  if (!dstExists) ixs.push(createAssociatedTokenAccountIdempotentInstruction(from, dst, to, mint, programId));
  ixs.push(createTransferCheckedInstruction(src, mint, dst, from, rawAmount, decimals, [], programId));
  return { tx: await buildTx(from, ixs), createsAccount: !dstExists };
}

export async function pickValidator(): Promise<{ votePubkey: string; commission: number }> {
  const { current } = await connection.getVoteAccounts("confirmed");
  const pool = current
    .filter((v) => v.commission <= 8)
    .sort((a, b) => b.activatedStake - a.activatedStake)
    .slice(20, 80); // skip the largest validators to avoid piling onto the superminority
  if (!pool.length) throw new Error("Could not find a suitable validator");
  const v = pool[Math.floor(Math.random() * pool.length)];
  return { votePubkey: v.votePubkey, commission: v.commission };
}

export async function buildNativeStake(owner: PublicKey, lamports: bigint, votePubkey: PublicKey) {
  const stake = Keypair.generate();
  const rent = BigInt(await connection.getMinimumBalanceForRentExemption(StakeProgram.space));
  const create = StakeProgram.createAccount({
    fromPubkey: owner,
    stakePubkey: stake.publicKey,
    authorized: new Authorized(owner, owner),
    lockup: Lockup.default,
    lamports: Number(lamports + rent),
  });
  const delegate = StakeProgram.delegate({ stakePubkey: stake.publicKey, authorizedPubkey: owner, votePubkey });
  const tx = await buildTx(owner, [...create.instructions, ...delegate.instructions], [stake]);
  return { tx, stakeAccount: stake.publicKey.toBase58(), rent };
}

export async function buildDeactivate(owner: PublicKey, stakeAccount: PublicKey) {
  const ix = StakeProgram.deactivate({ stakePubkey: stakeAccount, authorizedPubkey: owner });
  return buildTx(owner, ix.instructions);
}

export async function buildStakeWithdraw(owner: PublicKey, stakeAccount: PublicKey, lamports: number) {
  const ix = StakeProgram.withdraw({ stakePubkey: stakeAccount, authorizedPubkey: owner, toPubkey: owner, lamports });
  return buildTx(owner, ix.instructions);
}
