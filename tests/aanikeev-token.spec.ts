import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AanikeevToken } from "../target/types/aanikeev_token";
import * as u from "./utils";
import { beforeAll, describe, expect, test } from "vitest";

const getConfigIdempotent = async (program: any) => {
    const config = await u.fetchConfigIfExists(
        program,
        await u.getConfigAddress(programId)()
    );

    return config;
};

let programId: string;

beforeAll(async () => {

});

describe("aanikeev-token", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);
  console.log(provider.wallet.publicKey)

  const program = anchor.workspace.AanikeevToken as Program<AanikeevToken>;
  const admin = u.adminKeypair;

  it("Is initialized!", async () => {
    const programId = u.getProgramId(program);
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
    const config = await getConfigIdempotent(programId);
    expect(config.isConfigured).equal(true);
  });
});
