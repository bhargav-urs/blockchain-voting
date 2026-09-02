// lib/hooks/useWallet.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { WalletAdapter } from "@/lib/adapters/wallet";
import { appConfig } from "@/lib/config/env";

const adapter = WalletAdapter.getInstance();

export type WalletState = {
  account: string | null;
  isInstalled: boolean;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  error: string | null;
  clearError: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
};

export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null);
  // Resolved after mount: window.ethereum does not exist during SSR, and reading it
  // during render would hydrate the button into the wrong state.
  const [isInstalled, setIsInstalled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkNetwork = useCallback(async () => {
    if (!adapter.isInstalled() || typeof window === "undefined") return;
    const chainId: string = await window.ethereum.request({ method: "eth_chainId" });
    setIsCorrectNetwork(chainId.toLowerCase() === appConfig.chainHex.toLowerCase());
  }, []);

  // Some wallet builds inject window.ethereum a tick after load. Checking only once
  // on mount would tell a user who has MetaMask to go and install it.
  useEffect(() => {
    const sync = () => setIsInstalled(adapter.isInstalled());
    sync();
    if (adapter.isInstalled()) return;

    window.addEventListener("ethereum#initialized", sync);
    const timer = setTimeout(sync, 2_000);
    return () => {
      window.removeEventListener("ethereum#initialized", sync);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    adapter.getCurrentAccount().then((acc) => {
      setAccount(acc);
      if (acc) checkNetwork();
    });

    const unsubAccount = adapter.onAccountChange((acc) => {
      setAccount(acc);
      setError(null);
    });

    const unsubChain = adapter.onChainChange(() => checkNetwork());

    return () => { unsubAccount(); unsubChain(); };
  }, [checkNetwork]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const acc = await adapter.connect();
      setAccount(acc);
      setIsCorrectNetwork(true);
    } catch (e: any) {
      setError(e.message ?? "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { account, isInstalled, isConnecting, isCorrectNetwork, error, clearError, connect, disconnect };
}
