// lib/adapters/wallet.ts
import { appConfig } from "@/lib/config/env";

declare global {
  interface Window {
    ethereum?: any;
  }
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
    if (!this.isInstalled()) throw new Error("MetaMask not installed. Please install it from metamask.io");
    await this.ensureCorrectNetwork();
    const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts.length) throw new Error("No accounts returned from MetaMask.");
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
    if (chainId.toLowerCase() !== appConfig.chainHex.toLowerCase()) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: appConfig.chainHex }],
        });
      } catch (err: any) {
        if (err.code === 4902) {
          await this.addNetwork();
        } else {
          throw new Error(`Please switch MetaMask to ${appConfig.chainName}.`);
        }
      }
    }
  }

  private async addNetwork(): Promise<void> {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: appConfig.chainHex,
        chainName: appConfig.chainName,
        nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
        rpcUrls: [appConfig.rpcUrl],
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
