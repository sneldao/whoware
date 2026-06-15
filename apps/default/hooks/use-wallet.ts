import { useCallback, useEffect, useState } from "react";
import {
  getConnectedAddress,
  requestAccounts,
  switchToMantle,
  getCurrentChainId,
  TARGET_CHAIN,
  shortenAddress,
  type WalletState,
} from "@/lib/wallet";
import { useSmartAccount } from "./use-smart-account";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    chainId: null,
    isCorrectChain: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const smartAccount = useSmartAccount();

  const refresh = useCallback(async () => {
    const address = await getConnectedAddress();
    const chainId = await getCurrentChainId();
    setState({
      address,
      isConnected: !!address,
      chainId,
      isCorrectChain: chainId === TARGET_CHAIN.id,
    });
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const address = await requestAccounts();
      const chainId = await getCurrentChainId();
      if (address && chainId !== TARGET_CHAIN.id) {
        await switchToMantle();
      }
      await refresh();
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, refresh]);

  const switchChain = useCallback(async () => {
    await switchToMantle();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    const ethereum = (window as any).ethereum;
    const handleAccountsChanged = () => void refresh();
    const handleChainChanged = () => void refresh();

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refresh]);

  return {
    ...state,
    isConnecting,
    connect,
    switchChain,
    smartAccount,
    shortenedAddress: state.address ? shortenAddress(state.address) : null,
  };
}
