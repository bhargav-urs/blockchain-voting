// lib/config/env.ts

// Public Polygon Amoy RPC endpoints, in preference order. Reads try each in turn,
// so one provider going down no longer takes the whole app with it.
// Ordered by what each endpoint can actually serve, measured against this app:
//  - tenderly  handles ordinary reads AND wide eth_getLogs ranges, so it leads
//  - drpc      serves wide ranges too but throttles aggressively under load
//  - publicnode is fast for ordinary reads but prunes historical logs
//  - zan       applies compute-unit limits that exclude eth_getLogs
// Note that an Alchemy free-tier key set via NEXT_PUBLIC_RPC_URL takes precedence for
// ordinary reads but caps eth_getLogs at 10 blocks, so vote-log scans rotate past it
// to whichever endpoint here can serve the range.
const FALLBACK_RPC_URLS = [
  "https://polygon-amoy.gateway.tenderly.co",
  "https://polygon-amoy.drpc.org",
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://api.zan.top/polygon-amoy",
];

// polygon.technology retired its public Amoy endpoint and the hostname no longer
// resolves, so every request to it dies as a bare "Failed to fetch". Strip it
// wherever it turns up — including from a stale NEXT_PUBLIC_RPC_URL still set in
// the deployment environment.
const RETIRED_RPC_HOSTS = ["rpc-amoy.polygon.technology"];

function isUsableRpcUrl(url: string): boolean {
  try {
    return !RETIRED_RPC_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false; // not a valid URL
  }
}

function resolveRpcUrls(): string[] {
  // NEXT_PUBLIC_* must be read as static literals so Next.js can inline them.
  const configured = [
    ...(process.env.NEXT_PUBLIC_RPC_URLS || "").split(","),
    process.env.NEXT_PUBLIC_RPC_URL || "",
  ]
    .map((u) => u.trim())
    .filter(Boolean)
    .filter(isUsableRpcUrl);

  return Array.from(new Set([...configured, ...FALLBACK_RPC_URLS]));
}

const rpcUrls = resolveRpcUrls();

export const appConfig = {
  rpcUrls,
  // Single URL for consumers that can only take one (e.g. MetaMask's add-network call).
  rpcUrl:      rpcUrls[0],
  chainId:     parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "80002"),
  chainHex:    process.env.NEXT_PUBLIC_CHAIN_HEX    || "0x13882",
  chainName:   process.env.NEXT_PUBLIC_CHAIN_NAME   || "Polygon Amoy",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || "https://amoy.polygonscan.com",
  factoryAddress: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "",
  adminAddress:   process.env.NEXT_PUBLIC_ADMIN_ADDRESS   || "",
};
