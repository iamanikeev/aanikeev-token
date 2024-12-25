import * as anchor from "@coral-xyz/anchor";

import * as u from "./utils";
import { beforeAll, describe, expect, test } from "vitest";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { Program, web3 } from "@coral-xyz/anchor";
import { AanikeevToken } from "../target/types/aanikeev_token";
import BN from "bn.js";
import {
  getAccount,
  createMint,
  getMint,
  createAssociatedTokenAccount
} from "spl-token-bankrun";

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

  test("Should mint to wallet account", async () => {
    let initialBalance: number;
    try {
      const balance = await program.connection.getTokenAccountBalance(
        tokenAccount
      );
      initialBalance = balance.value.uiAmount;
    } catch {
      initialBalance = 0;
    }

    const tx = await program.methods
      .mintTokens(new BN(10 * LAMPORTS_PER_SOL))
      .accounts({
        mint,
        destination: tokenAccount,
        destinationAccountHolder: payer.publicKey,
        config: await u.getConfigAddress(programId)(),
        signerPda: programSignerAddress,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    const receiverTokenAccount = await getAccount(context.banksClient, tokenAccount)

    expect(new BN(initialBalance + 10 * LAMPORTS_PER_SOL).toNumber()).equal(
      new BN(receiverTokenAccount.amount).toNumber(),
      "Balance mismatch"
    );
  });

  test("Shouldn't be able to mint by wrong authority", async () => {
    await expect(async () => {
      const tx = await program.methods
        .mintTokens(new BN(10 * LAMPORTS_PER_SOL))
        .accounts({
          mint,
          destination: tokenAccount,
          destinationAccountHolder: payer.publicKey,
          config: await u.getConfigAddress(programId)(),
          signer: fakeAdmin.publicKey,
          signerPda: programSignerAddress,
          rent: web3.SYSVAR_RENT_PUBKEY,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([fakeAdmin])
        .rpc();
    }).rejects.toThrowError("Not permitted");
  });
});
