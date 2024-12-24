import * as anchor from "@coral-xyz/anchor";

import * as u from "./utils";
import {beforeAll, describe, expect, test} from "vitest";
import {PublicKey, LAMPORTS_PER_SOL, Keypair} from '@solana/web3.js';
import {createMint, getMint, createAssociatedTokenAccount, mintTo} from "./bankrun-spl-utils"
import {startAnchor} from "solana-bankrun";
import {BankrunProvider} from "anchor-bankrun";
import {Program, web3} from "@coral-xyz/anchor";
import {AanikeevToken} from "../target/types/aanikeev_token";
import BN from "bn.js";

const getConfigIdempotent = async (program: any) => {
  const config = await u.fetchConfigIfExists(
    program,
    await u.getConfigAddress(programId)()
  );

  return config;
};

const admin = u.adminKeypair;
let payer: Keypair;

let context: Awaited<ReturnType<typeof startAnchor>>;
let provider: BankrunProvider;
let program: any;
let programId: string;

let mint: PublicKey;
let tokenAccount: PublicKey;

beforeAll(async () => {
  context = await startAnchor(
    ".",
    [],
    [
      // Airdrop funds to accounts
      u.getFundedWalletAccount(u.adminKeypair.publicKey),
    ]
  );
  provider = new BankrunProvider(context);
  anchor.setProvider(provider as unknown as anchor.Provider);
  program = anchor.workspace.AanikeevToken as Program<AanikeevToken>;
  programId = u.getProgramId(program);
  payer = context.payer;

  mint = await createMint(
    context.banksClient,
    payer,
    payer.publicKey,
    null,
    9,
  );
  tokenAccount = await createAssociatedTokenAccount(
    context.banksClient,
    payer,
    mint,
    payer.publicKey
  );
  const mintInfo = await getMint(
    context.banksClient,
    mint
  );
  console.log(`Mint supply: ${mintInfo.supply}`);
  console.log(`Mint authority: ${mintInfo.mintAuthority}`);
  console.log(`Context payer: ${context.payer.publicKey}, Provider payer: ${provider.wallet.payer.publicKey}`);
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

  test("Should mint specified amount to specified account", async () => {
    const destination = await createAssociatedTokenAccount(
      context.banksClient,
      payer,
      mint,
      admin.publicKey,
    );

    let initialBalance: number;
    try {
      const balance = (await program.connection.getTokenAccountBalance(destination))
      initialBalance = balance.value.uiAmount;
    } catch {
      initialBalance = 0;
    }
    const signerPDA = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), payer.publicKey.toBuffer()],
      new web3.PublicKey(programId)
    )[0]
    console.log(`Signer PDA: ${signerPDA}`)
    const tx = await program.methods
      .mintTokens(new BN(10 * LAMPORTS_PER_SOL))
      .accounts(
        {
          mint,
          destination: tokenAccount,
          config: await u.getConfigAddress(programId)(),
          signer: web3.PublicKey.findProgramAddressSync(
            [Buffer.from("authority"), payer.publicKey.toBuffer()],
            new web3.PublicKey(programId)
          ),
          rent: web3.SYSVAR_RENT_PUBKEY,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        }
      )
      .rpc();
    const postBalance = (
      await program.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    expect(initialBalance + 10 * LAMPORTS_PER_SOL).equal(postBalance, "Balance mismatch");
  })
});
