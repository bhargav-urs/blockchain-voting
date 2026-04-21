"use client";
// components/WalletButton.tsx

import { useWallet } from "@/lib/hooks/useWallet";
import { formatAddress } from "@/lib/services/blockchain";

export function WalletButton() {
  const { account, isConnecting, connect, error } = useWallet();

  if (account) {
    return (
      <button className="wallet-btn" title={account}>
        <span className="wallet-btn-dot" />
        <span className="wallet-btn-addr">{formatAddress(account)}</span>
      </button>
    );
  }

  return (
    <button
      className={`btn btn-outline btn-sm ${isConnecting ? "btn-loading" : ""}`}
      onClick={connect}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
