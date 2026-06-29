import { createWalletClient, custom, encodeFunctionData, parseAbi, type Address, type Chain } from "viem";
import { polygonAmoy } from "viem/chains";
import { sendVia1ShotRelayer, USDC_AMOY_ADDRESS } from "./1shot";
import { logger } from "./logger";

export const POLYGON_AMOY_CHAIN: Chain = polygonAmoy;

export const ARCHIVE_PRICE_USDC = 1_000_000n; // 1 USDC (6 decimals)

export const TREASURY_ADDRESS: Address = "0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a";

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function encodeTransfer(to: Address, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
    functionName: "transfer",
    args: [to, amount],
  });
}

export async function switchToPolygonAmoy(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) return false;
  try {
    await (window as any).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${polygonAmoy.id.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    if (error?.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${polygonAmoy.id.toString(16)}`,
              chainName: polygonAmoy.name,
              nativeCurrency: polygonAmoy.nativeCurrency,
              rpcUrls: [polygonAmoy.rpcUrls.default.http[0]],
              blockExplorerUrls: [polygonAmoy.blockExplorers?.default.url],
            },
          ],
        });
        return true;
      } catch (e) {
        logger.warn("paywall.addPolygonAmoyNetwork", e);
        return false;
      }
    }
    return false;
  }
}

export async function ensureCorrectNetwork(): Promise<boolean> {
  const chainId = await getCurrentChainId();
  if (chainId === polygonAmoy.id) return true;
  return switchToPolygonAmoy();
}

export async function getCurrentChainId(): Promise<number | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const hex = await (window as any).ethereum.request({
      method: "eth_chainId",
    });
    return parseInt(hex, 16);
  } catch (e) {
    logger.warn("paywall.getCurrentChainId", e);
    return null;
  }
}

/**
 * Send USDC archive payment via 1Shot Permissionless Relayer (gasless).
 *
 * The relayer handles gas abstraction — the user pays for gas in USDC
 * tokens rather than MATIC. No signup or pre-funding needed.
 *
 * Falls back to direct MetaMask transaction if 1Shot is unavailable.
 *
 * The `treasuryOverride` and `amountOverride` come from the 402 response —
 * the server is the source of truth for the recipient and price. The
 * defaults below match Convex env `PAYWALL_TREASURY_ADDRESS` and the
 * hardcoded 1 USDC archive price; passing the 402 values keeps client and
 * server in agreement if those change.
 */
export async function sendArchivePayment(
  playerAddress: Address,
  options: { treasuryOverride?: Address; amountOverride?: bigint } = {},
): Promise<string | null> {
  const treasury = options.treasuryOverride ?? TREASURY_ADDRESS;
  const amount = options.amountOverride ?? ARCHIVE_PRICE_USDC;

  // Try 1Shot Permissionless Relayer first for gasless experience
  const transferData = encodeTransfer(treasury, amount);
  const taskId = await sendVia1ShotRelayer(USDC_AMOY_ADDRESS, transferData);

  if (taskId) {
    return taskId;
  }

  // Fallback: direct USDC transfer via MetaMask (user pays gas)
  const chainId = await getCurrentChainId();
  if (chainId !== polygonAmoy.id) {
    const switched = await switchToPolygonAmoy();
    if (!switched) return null;
  }

  const client = createWalletClient({
    account: playerAddress,
    chain: polygonAmoy,
    transport: custom((window as any).ethereum),
  });

  try {
    const hash = await client.writeContract({
      address: USDC_AMOY_ADDRESS,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [treasury, amount],
    });
    return hash;
  } catch (error) {
    logger.error("paywall.sendArchivePayment", error);
    return null;
  }
}
