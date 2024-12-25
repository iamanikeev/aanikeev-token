import * as web3 from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AddedAccount } from "solana-bankrun";

function getKeypair(relativePath: string): web3.Keypair {
  return web3.Keypair.fromSecretKey(
    Uint8Array.from(
      // Use path to keypair.json relative to the test execution dir
      JSON.parse(readFileSync(resolve(relativePath), "utf8"))
    )
  );
}

export const adminKeypair = getKeypair(".solana/admin.json");

export const getFundedWalletAccount = (
  address: web3.PublicKey,
  lamports = 1_000_000_000
): AddedAccount => {
  return {
    address,
    info: {
      lamports,
      data: Buffer.alloc(0),
      owner: web3.SystemProgram.programId,
      executable: false,
    },
  };
};

export async function getAddress(pair: [web3.PublicKey, number]) {
  return pair[0];
}

export const getProgramId = (program: any): string =>
  program.programId.toString();

/**
 * ```ts
 *  const [pdaAddress, bump] = await findPDAAddress(programId)([Buffer.from("seed"),..])
 * ```
 */
export const findPDAAddress =
  (programId: string) => async (seeds: Buffer[]) => {
    return web3.PublicKey.findProgramAddressSync(
      seeds,
      new web3.PublicKey(programId)
    );
  };

/**
 * ```ts
 *  let config = await findConfigAddress(programId)()
 *  //or
 *  config = await findConfigAddress(program.programId.toString())()
 * ```
 */
export const findConfigAddress = (programId: string) => async () => {
  return findPDAAddress(programId)([Buffer.from("config")]);
};

/**
 * ```ts
 *  let configAddress = await getConfigAddress(programId)()
 * ```
 */
export const getConfigAddress = (programId: string) => async () =>
  getAddress(await findConfigAddress(programId)());

export async function fetchConfigIfExists(
  program: any,
  address: web3.PublicKey
) {
  try {
    const configAccount = await program.account.config.fetch(address);
    return configAccount;
  } catch (e: unknown) {
    console.log(`ERROR fetch config: ${e}`);
    return null;
  }
}
