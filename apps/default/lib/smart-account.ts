import { createPublicClient, createWalletClient, http, type Address, type Chain, type Hex } from "viem";
import { privateKeyToAddress, keccak256, toBytes, encodeAbiParameters } from "viem/utils";
import { mantleSepoliaTestnet } from "viem/chains";
import {
  toMetaMaskSmartAccount,
  getSmartAccountsEnvironment,
  Implementation,
  createDelegation,
  type MetaMaskSmartAccount,
  type SmartAccountsEnvironment,
  type Delegation,
  ScopeType,
} from "@metamask/smart-accounts-kit";
import { createBundlerClient } from "viem/account-abstraction";
import {
  createLimitedCallsTerms,
  createTimestampTerms,
} from "@metamask/delegation-core";

export const TARGET_CHAIN: Chain = mantleSepoliaTestnet;

const BUNDLER_RPC_URL = "https://bundler.mantle-sepolia.1rpc.io";

let _cachedEnvironment: SmartAccountsEnvironment | null = null;

export function getEnvironment(): SmartAccountsEnvironment {
  if (!_cachedEnvironment) {
    _cachedEnvironment = getSmartAccountsEnvironment(mantleSepoliaTestnet.id);
  }
  return _cachedEnvironment;
}

export function createMantlePublicClient() {
  return createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(),
  });
}

export function createMantleBundlerClient() {
  const publicClient = createMantlePublicClient();
  return createBundlerClient({
    client: publicClient,
    transport: http(BUNDLER_RPC_URL),
  });
}

export async function upgradeToSmartAccount(
  walletClient: ReturnType<typeof createWalletClient>,
): Promise<MetaMaskSmartAccount | null> {
  try {
    const publicClient = createMantlePublicClient();
    const addresses = await walletClient.getAddresses();
    const address = addresses[0];

    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Stateless7702,
      address,
      signer: { walletClient },
    });

    return smartAccount;
  } catch (error) {
    logger.error("smartAccount.upgrade", error);
    return null;
  }
}

export async function sendViaSmartAccount(
  smartAccount: MetaMaskSmartAccount,
  to: Address,
  data: `0x${string}`,
  value: bigint = 0n,
): Promise<`0x${string}` | null> {
  try {
    const bundlerClient = createMantleBundlerClient();

    const userOperationHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: [{ to, value, data }],
    });

    return userOperationHash;
  } catch (error) {
    logger.error("smartAccount.sendUserOperation", error);
    return null;
  }
}

export async function waitForUserOperationReceipt(
  userOperationHash: `0x${string}`,
): Promise<`0x${string}` | null> {
  try {
    const bundlerClient = createMantleBundlerClient();
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOperationHash,
    });
    return receipt.receipt.transactionHash;
  } catch (error) {
    logger.error("smartAccount.waitForUserOperationReceipt", error);
    return null;
  }
}

function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("") as Hex;
}

/**
 * Builds an Advanced Permission (ERC-7715) delegation.
 * This allows the Oracle to mint scores on behalf of the user's Smart Account
 * within strict caveats (allowed target, allowed method, limited calls, time bound).
 */
export function buildMintDelegation(
  environment: SmartAccountsEnvironment,
  userAddress: Address,
  oracleAddress: Address,
  scoreContract: Address,
): Delegation {
  const now = Math.floor(Date.now() / 1000);
  const salt = generateSalt();

  const scopeCaveat = {
    enforcer: environment.caveatEnforcers.AllowedTargetsEnforcer,
    terms: encodeAbiParameters(
      [{ type: "address[]" }],
      [[scoreContract]],
    ),
    args: "0x00" as Hex,
  };

  const methodCaveat = {
    enforcer: environment.caveatEnforcers.AllowedMethodsEnforcer,
    terms: encodeAbiParameters(
      [{ type: "bytes4[]" }],
      [["0x2b104b0c"]],
    ),
    args: "0x00" as Hex,
  };

  const callsCaveat = {
    enforcer: environment.caveatEnforcers.LimitedCallsEnforcer,
    terms: createLimitedCallsTerms({ limit: 1 }),
    args: "0x00" as Hex,
  };

  const timeCaveat = {
    enforcer: environment.caveatEnforcers.TimestampEnforcer,
    terms: createTimestampTerms({
      afterThreshold: now,
      beforeThreshold: now + 86400,
    }),
    args: "0x00" as Hex,
  };

  return createDelegation({
    environment,
    from: userAddress,
    to: oracleAddress,
    salt,
    caveats: [scopeCaveat, methodCaveat, callsCaveat, timeCaveat],
    scope: {
      type: ScopeType.FunctionCall,
      targets: [scoreContract],
      selectors: ["0x2b104b0c" as Hex],
      valueLte: { value: 0n },
    },
  } as any);
}

import { MANTLE_SEPOLIA_ORACLE as ORACLE_ADDRESS } from "./contracts";
import { logger } from "./logger";
export { ORACLE_ADDRESS };

const DELEGATION_TYPES = {
  Delegation: [
    { name: "delegate", type: "address" },
    { name: "delegator", type: "address" },
    { name: "authority", type: "bytes32" },
    { name: "caveats", type: "Caveat[]" },
    { name: "salt", type: "uint256" },
  ],
  Caveat: [
    { name: "enforcer", type: "address" },
    { name: "terms", type: "bytes" },
    { name: "args", type: "bytes" },
  ],
} as const;

export function getDelegationTypedData(
  delegation: Delegation,
  environment: SmartAccountsEnvironment,
) {
  const domain = {
    name: "DelegationManager",
    version: "1",
    chainId: mantleSepoliaTestnet.id,
    verifyingContract: environment.DelegationManager,
  };

  const message = {
    delegate: delegation.delegate,
    delegator: delegation.delegator,
    authority: delegation.authority,
    caveats: delegation.caveats.map((c) => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: c.args,
    })),
    salt: delegation.salt,
  };

  return {
    domain,
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    message,
  };
}

export async function signWithMetaMask(
  address: Address,
  typedData: Record<string, unknown>,
): Promise<`0x${string}` | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    logger.warn("smartAccount.metaMaskUnavailable");
    return null;
  }
  try {
    const ethereum = (window as any).ethereum;
    const signature = await ethereum.request({
      method: "eth_signTypedData_v4",
      params: [address, JSON.stringify(typedData)],
    });
    return signature as `0x${string}`;
  } catch (error) {
    logger.error("smartAccount.signTypedData", error);
    return null;
  }
}

export type { MetaMaskSmartAccount, SmartAccountsEnvironment, Delegation };
