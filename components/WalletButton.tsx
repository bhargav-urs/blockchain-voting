"use client";
// components/WalletButton.tsx

import { useWallet } from "@/lib/hooks/useWallet";
import { formatAddress } from "@/lib/services/blockchain";

export function WalletButton() {
  const { account, isInstalled, isConnecting, connect, error, clearError } = useWallet();

  if (account) {
    return (
      <button className="wallet-btn" title={account}>
        <span className="wallet-btn-dot" />
        <span className="wallet-btn-addr">{formatAddress(account)}</span>
      </button>
    );
  }

  // Without the extension there is nothing to connect to, so point at the install
  // page rather than handing the user a button that can only ever fail.
  if (!isInstalled) {
    return (
      <a
        className="btn btn-outline btn-sm"
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Install MetaMask
      </a>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className={`btn btn-outline btn-sm ${isConnecting ? "btn-loading" : ""}`}
        onClick={connect}
        disabled={isConnecting}
      >
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>

      {/* A failed connection used to be swallowed entirely, so the button appeared
          to do nothing at all. Anchored to the button so it works from the navbar. */}
      {error && (
        <div
          className="alert alert-error"
          role="alert"
          onClick={clearError}
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            width: "max-content", maxWidth: 300, zIndex: 100,
            cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <span className="alert-icon">❌</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
