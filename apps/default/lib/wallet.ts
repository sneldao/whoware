import { createWalletClient, custom, type Address, type Chain } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";

export const TARGET_CHAIN: Chain = mantleSepoliaTestnet;

export interface WalletState {
  address: Address | null;
  isConnected: boolean;
  chainId: number | null;
  isCorrectChain: boolean;
}

export async function requestAccounts(): Promise<Address | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getConnectedAddress(): Promise<Address | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const accounts = await (window as any).ethereum.request({
      method: "eth_accounts",
    });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function switchToMantle(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) return false;
  try {
    await (window as any).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${TARGET_CHAIN.id.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    if (error?.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${TARGET_CHAIN.id.toString(16)}`,
              chainName: TARGET_CHAIN.name,
              nativeCurrency: TARGET_CHAIN.nativeCurrency,
              rpcUrls: [TARGET_CHAIN.rpcUrls.default.http[0]],
              blockExplorerUrls: [TARGET_CHAIN.blockExplorers?.default.url],
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

export function isMetaMaskAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).ethereum;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
