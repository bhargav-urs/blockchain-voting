// lib/hooks/useWallet.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { WalletAdapter } from "@/lib/adapters/wallet";
import { appConfig } from "@/lib/config/env";

const adapter = WalletAdapter.getInstance();

export type WalletState = {
  account: string | null;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkNetwork = useCallback(async () => {
    if (!adapter.isInstalled() || typeof window === "undefined") return;
    const chainId: string = await window.ethereum.request({ method: "eth_chainId" });
    setIsCorrectNetwork(chainId.toLowerCase() === appConfig.chainHex.toLowerCase());
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

  return { account, isConnecting, isCorrectNetwork, error, connect, disconnect };
}
