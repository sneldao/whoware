import { createWalletClient, custom, type Address, type Chain } from "viem";
import { polygonAmoy } from "viem/chains";

export const POLYGON_AMOY_CHAIN: Chain = polygonAmoy;

export const USDC_AMOY_ADDRESS: Address = "0x41E94EB019C0762f9Bfcf9FB1E58725BfB0e7582";

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

export async function sendArchivePayment(
  playerAddress: Address,
): Promise<string | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;

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
