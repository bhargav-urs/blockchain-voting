// lib/adapters/wallet.ts
import { appConfig } from "@/lib/config/env";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// MetaMask reports refusals and conflicts as numeric codes; surfacing them raw
// leaves the user staring at "User denied transaction signature".
function walletError(err: any, fallback: string): Error {
  const code = err?.code ?? err?.data?.originalError?.code;
  if (code === 4001) return new Error("Request rejected in MetaMask.");
  if (code === -32002) {
    return new Error("MetaMask already has a request open — finish or dismiss it in the extension, then try again.");
  }
  return new Error(err?.message ?? fallback);
}

export class WalletAdapter {
  private static instance: WalletAdapter;

  static getInstance(): WalletAdapter {
    if (!WalletAdapter.instance) WalletAdapter.instance = new WalletAdapter();
    return WalletAdapter.instance;
  }

  isInstalled(): boolean {
    return typeof window !== "undefined" && !!window.ethereum;
  }

  async connect(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error("MetaMask not detected. Install it from metamask.io, then reload this page.");
    }

    // Authorise the site first. MetaMask refuses wallet_switchEthereumChain and
    // wallet_addEthereumChain from a site the user has not connected yet, so doing
    // the network check first made the very first connection fail every time.
    let accounts: string[];
    try {
      accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    } catch (err: any) {
      throw walletError(err, "Could not connect to MetaMask.");
    }
    if (!accounts.length) {
      throw new Error("MetaMask returned no accounts. Unlock the extension and try again.");
    }

    await this.ensureCorrectNetwork();
    return accounts[0].toLowerCase();
  }

  async getCurrentAccount(): Promise<string | null> {
    if (!this.isInstalled()) return null;
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
      return accounts[0]?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  }

  async ensureCorrectNetwork(): Promise<void> {
    if (!this.isInstalled()) return;
    const chainId: string = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId.toLowerCase() === appConfig.chainHex.toLowerCase()) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: appConfig.chainHex }],
      });
    } catch (err: any) {
      // 4902 means the chain simply isn't in the wallet yet. Some builds bury it
      // inside a -32603 wrapper, so check the nested code too.
      const code = err?.code ?? err?.data?.originalError?.code;
      if (code !== 4902) {
        throw walletError(err, `Please switch MetaMask to ${appConfig.chainName}.`);
      }
      try {
        await this.addNetwork();
      } catch (addErr: any) {
        throw walletError(addErr, `Could not add ${appConfig.chainName} to MetaMask.`);
      }
    }
  }

  private async addNetwork(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: appConfig.chainHex,
        chainName: appConfig.chainName,
        // Polygon renamed MATIC to POL; MetaMask validates this against its own
        // record for chain 80002 and rejects the call outright on a mismatch.
        nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
        rpcUrls: appConfig.rpcUrls,
        blockExplorerUrls: appConfig.explorerUrl ? [appConfig.explorerUrl] : [],
      }],
    });
  }

  onAccountChange(cb: (account: string | null) => void): () => void {
    if (!this.isInstalled()) return () => {};
    const handler = (accounts: string[]) => cb(accounts[0]?.toLowerCase() ?? null);
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }

  onChainChange(cb: (chainId: string) => void): () => void {
    if (!this.isInstalled()) return () => {};
    window.ethereum.on("chainChanged", cb);
    return () => window.ethereum.removeListener("chainChanged", cb);
  }
}
