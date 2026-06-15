import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/delegation-abis";
import { createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepoliaTestnet } from "viem/chains";
import { keccak256, toBytes } from "viem/utils";

const MANTLE_SCORE_CONTRACT = process.env.MANTLE_SCORE_CONTRACT as Address;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const CHAIN_ID = 5003;

type DelegationSubmission = {
  delegate: string;
  delegator: string;
  authority: string;
  caveats: { enforcer: string; terms: string; args: string }[];
  salt: string;
  signature: string;
};

export const getDelegationManagerAddress = query({
  args: {},
  handler: async () => {
    const env = getSmartAccountsEnvironment(CHAIN_ID);
    return env.DelegationManager;
  },
});

export const submitDelegation = mutation({
  args: {
    delegation: v.object({
      delegate: v.string(),
      delegator: v.string(),
      authority: v.string(),
      caveats: v.array(
        v.object({
          enforcer: v.string(),
          terms: v.string(),
          args: v.string(),
        }),
      ),
      salt: v.string(),
      signature: v.string(),
    }),
  },
  returns: v.union(v.null(), v.object({
    delegationHash: v.string(),
    txHash: v.string(),
  })),
  handler: async (_ctx, args) => {
    const env = getSmartAccountsEnvironment(CHAIN_ID);
    const delegationManager = env.DelegationManager;

    const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

    const walletClient = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport: http(),
    });

    const delegation = args.delegation;

    const hash = await walletClient.writeContract({
      address: delegationManager as Address,
      abi: DelegationManager,
      functionName: "enableDelegation",
      args: [
        {
          delegate: delegation.delegate as Address,
          delegator: delegation.delegator as Address,
          authority: delegation.authority as `0x${string}`,
          caveats: delegation.caveats.map((c) => ({
            enforcer: c.enforcer as Address,
            terms: c.terms as `0x${string}`,
            args: c.args as `0x${string}`,
          })),
          salt: BigInt(delegation.salt),
          signature: delegation.signature as `0x${string}`,
        },
      ],
    });

    const delegationHash = keccak256(
      toBytes(delegation.delegate + delegation.delegator.slice(2) + delegation.salt.slice(2)),
    );

    return {
      delegationHash,
      txHash: hash,
    };
  },
});

export const getDelegationStatus = query({
  args: {
    userAddress: v.string(),
  },
  handler: async (ctx, args) => {
    return null;
  },
});
