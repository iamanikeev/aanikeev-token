import * as anchor from "@coral-xyz/anchor";

import * as u from "./utils";
import { beforeAll, describe, expect, test } from "vitest";
import { PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction } from "@solana/web3.js";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { Program, web3 } from "@coral-xyz/anchor";
import { AanikeevToken } from "../target/types/aanikeev_token";
import BN from "bn.js";
import {
  createMint,
  getMint,
  createAssociatedTokenAccount,
} from "spl-token-bankrun";
import {getAccountBalance} from "./utils";
import { createApproveInstruction } from "@solana/spl-token";

const getConfigIdempotent = async (program: any) => {
  const config = await u.fetchConfigIfExists(
    program,
    await u.getConfigAddress(programId)()
  );

  return config;
};

const fakeAdmin = u.fakeAdminKeypair;
let payer: Keypair;

let context: Awaited<ReturnType<typeof startAnchor>>;
let provider: BankrunProvider;
let program: any;
let programId: string;

let mint: PublicKey;
let tokenAccount: PublicKey;
let programSignerAddress: PublicKey;
let fakeAdminTokenAccount: PublicKey;

beforeAll(async () => {
  context = await startAnchor(
    ".",
    [],
    [
      // Airdrop funds to accounts
      u.getFundedWalletAccount(u.fakeAdminKeypair.publicKey),
    ]
  );
  provider = new BankrunProvider(context);
  anchor.setProvider(provider as unknown as anchor.Provider);
  program = anchor.workspace.AanikeevToken as Program<AanikeevToken>;
  programId = u.getProgramId(program);
  payer = context.payer;
  programSignerAddress = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("authority"), payer.publicKey.toBuffer()],
    new web3.PublicKey(programId)
  )[0];

  mint = await createMint(
    context.banksClient,
    payer,
    programSignerAddress,
    null,
    9
  );
  tokenAccount = await createAssociatedTokenAccount(
    context.banksClient,
    payer,
    mint,
    payer.publicKey
  );
  fakeAdminTokenAccount = await createAssociatedTokenAccount(
    context.banksClient,
    payer,
    mint,
    fakeAdmin.publicKey
  );

  const mintInfo = await getMint(context.banksClient, mint);
  console.log(`Mint supply: ${mintInfo.supply}`);
  console.log(`Mint authority: ${mintInfo.mintAuthority}`);
  console.log(
    `Context payer: ${context.payer.publicKey}, Provider payer: ${provider.wallet.payer.publicKey}, PDA Authority ${programSignerAddress}`
  );
});

describe("Test initialization", () => {
  test("Should be able to initialize", async () => {
    const tx = await program.methods
      .initialize(payer.publicKey)
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        config: await u.getConfigAddress(programId)(),
      })
      .rpc();
    console.log("Your transaction signature", tx);
    const config = await getConfigIdempotent(program);
    expect(config.isConfigured).equal(true);
    expect(config.authority.toBase58()).equal(payer.publicKey.toBase58());
  });

  test("Should not be able to initialize twice", async () => {
    await expect(async () => {
      await program.methods
        .initialize(payer.publicKey)
        .accounts({
          signer: payer.publicKey,
          mint: mint,
          config: await u.getConfigAddress(programId)(),
        })
        .rpc();
    }).rejects.toThrowError(/already in use/);
  });

  test("Should mint to own account", async () => {
    const initialBalance = await getAccountBalance(context.banksClient, tokenAccount);
    console.log(`Balance before mint: ${initialBalance}`);
    const amountToMint = 10 * LAMPORTS_PER_SOL;
    console.log(`Amount to mint: ${amountToMint}`);
    await program.methods
      .mintTokens(new BN(amountToMint))
      .accounts({
        mint,
        destination: tokenAccount,
        destinationAccountHolder: payer.publicKey,
        config: await u.getConfigAddress(programId)(),
        signerPda: programSignerAddress,
      })
      .rpc();

    const balanceAfterMint = await getAccountBalance(context.banksClient, tokenAccount);
    console.log(`Balance after mint: ${balanceAfterMint}`);
    expect(new BN(initialBalance + amountToMint).toNumber()).equal(
      new BN(balanceAfterMint).toNumber(),
      "Balance mismatch"
    );
  });

  test("Should mint to wallet account", async () => {
    const initialBalance = await getAccountBalance(context.banksClient, fakeAdminTokenAccount);
    console.log(`Balance before mint: ${initialBalance}`);
    const amountToMint = 10 * LAMPORTS_PER_SOL;
    console.log(`Amount to mint: ${amountToMint}`);
    await program.methods
      .mintTokens(new BN(amountToMint))
      .accounts({
        mint,
        destination: fakeAdminTokenAccount,
        destinationAccountHolder: fakeAdmin.publicKey,
        config: await u.getConfigAddress(programId)(),
        signerPda: programSignerAddress,
      })
      .rpc();

    const balanceAfterMint = await getAccountBalance(context.banksClient, fakeAdminTokenAccount);
    console.log(`Balance after mint: ${balanceAfterMint}`);
    expect(new BN(initialBalance + amountToMint).toNumber()).equal(
      new BN(balanceAfterMint).toNumber(),
      "Balance mismatch"
    );
  });

  test("Shouldn't be able to mint by wrong authority", async () => {
    await expect(async () => {
      await program.methods
        .mintTokens(new BN(10 * LAMPORTS_PER_SOL))
        .accounts({
          mint,
          destination: tokenAccount,
          destinationAccountHolder: payer.publicKey,
          config: await u.getConfigAddress(programId)(),
          signer: fakeAdmin.publicKey,
          signerPda: programSignerAddress,
        })
        .signers([fakeAdmin])
        .rpc();
    }).rejects.toThrowError("Not permitted");
  });

  test("Should be able to burn tokens from own account", async () => {
    const initialBalance = await getAccountBalance(context.banksClient, tokenAccount);
    console.log(`Balance before burn: ${initialBalance}`);
    const amountToBurn = 2 * LAMPORTS_PER_SOL
    await program.methods
      .burnTokens(new BN(amountToBurn))
      .accounts({
        mint,
        burnFrom: tokenAccount,
        burnFromAccountHolder: payer.publicKey,
        config: await u.getConfigAddress(programId)(),
        signerPda: programSignerAddress,
      })
      .rpc();
    const balanceAfterBurn = await getAccountBalance(context.banksClient, tokenAccount);
    console.log(`Balance after burn: ${balanceAfterBurn}`);
    expect(new BN(balanceAfterBurn).toNumber()).equal(
      new BN(initialBalance - amountToBurn).toNumber(),
      "Balance mismatch"
    );
  })

  test("Shouldn't be able to burn tokens w/o delegated approval", async () => {
    const amountToBurn = 2 * LAMPORTS_PER_SOL
    await expect(async () => {
      await program.methods
        .burnTokens(new BN(amountToBurn))
        .accounts({
          mint,
          burnFrom: fakeAdminTokenAccount,
          burnFromAccountHolder: fakeAdmin.publicKey,
          config: await u.getConfigAddress(programId)(),
          signerPda: programSignerAddress,
        })
        .rpc();
    }).rejects.toThrowError("Cross-program invocation with unauthorized signer or writable account");
  })

  test("Should be able to burn tokens with delegated approval", async () => {
    const amountToBurn = 2 * LAMPORTS_PER_SOL
    const initialBalance = await getAccountBalance(context.banksClient, fakeAdminTokenAccount);
    console.log(`Balance before burn: ${initialBalance}`);
    const transaction = new Transaction();
    transaction.add(
      createApproveInstruction(fakeAdminTokenAccount, programSignerAddress, fakeAdmin.publicKey, amountToBurn)
    );
    const instruction = await program.methods
      .burnTokens(new BN(amountToBurn))
      .accounts({
        mint,
        burnFrom: fakeAdminTokenAccount,
        burnFromAccountHolder: fakeAdmin.publicKey,
        config: await u.getConfigAddress(programId)(),
        signerPda: programSignerAddress,
        signer: payer.publicKey,
      })
      .instruction();
    transaction.add(instruction);
    [transaction.recentBlockhash] = (await context.banksClient.getLatestBlockhash())!;
    transaction.sign(fakeAdmin, payer);
    await context.banksClient.processTransaction(transaction)
    const balanceAfterBurn = await getAccountBalance(context.banksClient, fakeAdminTokenAccount);
    console.log(`Balance after burn: ${balanceAfterBurn}`);
  })
});
