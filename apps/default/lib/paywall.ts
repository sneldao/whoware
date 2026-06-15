import { createWalletClient, custom, encodeFunctionData, parseAbi, type Address, type Chain } from "viem";
import { polygonAmoy } from "viem/chains";
import { sendVia1ShotRelayer, USDC_AMOY_ADDRESS } from "./1shot";

export const POLYGON_AMOY_CHAIN: Chain = polygonAmoy;

export const ARCHIVE_PRICE_USDC = 1_000_000n; // 1 USDC (6 decimals)

export const TREASURY_ADDRESS: Address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

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
      } catch {
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
  } catch {
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
 */
export async function sendArchivePayment(
  playerAddress: Address,
): Promise<string | null> {
  // Try 1Shot Permissionless Relayer first for gasless experience
  const transferData = encodeTransfer(TREASURY_ADDRESS, ARCHIVE_PRICE_USDC);
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
      args: [TREASURY_ADDRESS, ARCHIVE_PRICE_USDC],
    });
    return hash;
  } catch (error) {
    console.error("Failed to send archive payment:", error);
    return null;
  }
}
