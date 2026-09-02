// lib/services/blockchain.ts
import { ethers, Network, TransactionReceipt } from "ethers";
import { appConfig } from "@/lib/config/env";
import { factoryAbi } from "@/lib/abi/factoryAbi";
import { electionAbi } from "@/lib/abi/electionAbi";

// ─────────────────────────── Types ────────────────────────────────────────

export interface ElectionRecord {
  address: string;
  title: string;
  description: string;
  createdAt: number;
  startTime: number;
  endTime: number;
}

export interface ElectionInfo {
  address: string;
  title: string;
  description: string;
  isActive: boolean;
  isVotingOpen: boolean;
  startTime: number;
  endTime: number;
  createdAt: number;
  totalVotes: number;
  candidateCount: number;
}

export interface CandidateResult {
  id: number;
  name: string;
  voteCount: number;
  percentage: number;
}

export interface VoterStatus {
  registered: boolean;
  voted: boolean;
  timestamp: number;
}

export interface MyVote {
  voted: boolean;
  candidateId: number;
  candidateName: string;
  timestamp: number;
}

// ─────────────────────────── Providers ────────────────────────────────────

const PROBE_TIMEOUT_MS = 6_000;

function makeReadProvider(url: string): ethers.JsonRpcProvider {
  // Pinning the network skips the chainId round-trip every provider otherwise makes,
  // and batchMaxCount:1 keeps us compatible with public nodes that reject JSON-RPC batches.
  const network = Network.from(appConfig.chainId);
  return new ethers.JsonRpcProvider(url, network, { staticNetwork: network, batchMaxCount: 1 });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

// Endpoints that have already failed this session, so we stop re-probing them.
const deadEndpoints = new Set<string>();
let readProvider: Promise<ethers.JsonRpcProvider> | null = null;
let readProviderUrl = "";

async function resolveReadProvider(): Promise<ethers.JsonRpcProvider> {
  let candidates = appConfig.rpcUrls.filter((u) => !deadEndpoints.has(u));
  if (!candidates.length) {
    // Everything is marked dead — give them all another chance rather than giving up.
    deadEndpoints.clear();
    candidates = appConfig.rpcUrls;
  }

  const failures: string[] = [];
  for (const url of candidates) {
    const provider = makeReadProvider(url);
    try {
      await withTimeout(provider.getBlockNumber(), PROBE_TIMEOUT_MS);
      readProviderUrl = url;
      return provider;
    } catch (e: any) {
      provider.destroy();
      deadEndpoints.add(url);
      failures.push(`${hostOf(url)} (${e?.shortMessage ?? e?.message ?? "unreachable"})`);
    }
  }

  throw new Error(
    `Could not reach any ${appConfig.chainName} RPC endpoint. Tried: ${failures.join(", ")}. ` +
    `Check your connection, or set NEXT_PUBLIC_RPC_URL to a working node.`
  );
}

export async function getReadProvider(): Promise<ethers.JsonRpcProvider> {
  if (!readProvider) {
    readProvider = resolveReadProvider().catch((e) => {
      readProvider = null; // never cache a total failure — let the next call retry
      throw e;
    });
  }
  return readProvider;
}

async function dropReadProvider(): Promise<void> {
  const current = readProvider;
  readProvider = null;
  readProviderUrl = "";
  try { (await current)?.destroy(); } catch { /* already gone */ }
}

// An RPC node that dies mid-session surfaces as a transport error, not a contract revert.
function isRpcTransportError(e: any): boolean {
  if (!e) return false;
  if (["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT"].includes(e.code)) return true;
  const msg = String(e.shortMessage ?? e.message ?? "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("could not detect network") || msg.includes("timed out");
}

// Wraps every read so a node going down rotates us to the next endpoint instead of
// surfacing a bare "Failed to fetch" to the user.
async function readWithFailover<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isRpcTransportError(e)) throw e;
    await dropReadProvider();
    return fn();
  }
}

function getWriteProvider(): ethers.BrowserProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not available.");
  }
  return new ethers.BrowserProvider(window.ethereum);
}

async function getSigner(): Promise<ethers.Signer> {
  const provider = getWriteProvider();
  return provider.getSigner();
}

// Polygon Amoy often has minimum gas requirements that MetaMask doesn't fetch correctly.
// We manually read the current gas price from the network and add 25% buffer to ensure
// transactions get accepted on first try.
async function getGasOverrides(): Promise<{ gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> {
  try {
    const provider = getWriteProvider();
    const feeData = await provider.getFeeData();
    // Amoy requires minimum 25 gwei — we bump it to at least 30 gwei with buffer
    const MIN_GAS_PRICE = ethers.parseUnits("30", "gwei");
    const networkGasPrice = feeData.gasPrice ?? MIN_GAS_PRICE;
    const bumpedGasPrice = (networkGasPrice * BigInt(125)) / BigInt(100);
    const finalGasPrice = bumpedGasPrice > MIN_GAS_PRICE ? bumpedGasPrice : MIN_GAS_PRICE;
    return { gasPrice: finalGasPrice };
  } catch {
    return { gasPrice: ethers.parseUnits("30", "gwei") };
  }
}

// ─────────────────────────── Factory Service ──────────────────────────────

export const FactoryService = {
  async readContract() {
    if (!appConfig.factoryAddress) throw new Error("Factory address not configured. Did you deploy the contract?");
    return new ethers.Contract(appConfig.factoryAddress, factoryAbi, await getReadProvider());
  },

  async writeContract() {
    if (!appConfig.factoryAddress) throw new Error("Factory address not configured.");
    const signer = await getSigner();
    return new ethers.Contract(appConfig.factoryAddress, factoryAbi, signer);
  },

  async getOwner(): Promise<string> {
    return readWithFailover(async () => (await this.readContract()).owner());
  },

  async getAllElections(): Promise<ElectionRecord[]> {
    return readWithFailover(async () => {
      const raw: any[] = await (await this.readContract()).getAllElections();
      return raw.map((r) => ({
        address:     r.electionAddress,
        title:       r.title,
        description: r.description,
        createdAt:   Number(r.createdAt),
        startTime:   Number(r.startTime),
        endTime:     Number(r.endTime),
      }));
    });
  },

  async createElection(
    title: string,
    description: string,
    candidates: string[],
    startTime: number,
    endTime: number,
  ): Promise<{ hash: string; address: string }> {
    const contract = await this.writeContract();
    const overrides = await getGasOverrides();
    const tx = await contract.createElection(title, description, candidates, startTime, endTime, overrides);
    const receipt: TransactionReceipt = await tx.wait();
    const log = receipt.logs.find(
      (l: any) => l.fragment?.name === "ElectionCreated"
    );
    const address = log ? (log as any).args[0] : "";
    return { hash: receipt.hash, address };
  },
};

// Public RPCs cap eth_getLogs, so an unbounded queryFilter over all of history is
// rejected outright. We bracket the election's own window and walk it in chunks.
const LOG_CHUNK_SIZE = 9_000;
const AMOY_BLOCK_TIME_SECONDS = 2.1;
// A scan spans many sequential requests, so it needs a ceiling of its own — without one
// a node that accepts the range but never answers hangs the panel indefinitely.
const LOG_SCAN_TIMEOUT_MS = 20_000;
// Rotating four endpoints with a retry each could otherwise spin for minutes; past
// this the panel reports honestly instead of leaving a spinner up.
const LOG_TOTAL_BUDGET_MS = 45_000;

// An election's start block never changes, so resolving it is a one-time cost per
// browser. Failures here are never fatal — storage can be unavailable or full.
function cachedStartBlock(address: string): number | null {
  try {
    const raw = window.localStorage.getItem(`cv:startBlock:${appConfig.chainId}:${address}`);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch { return null; }
}

function rememberStartBlock(address: string, block: number): void {
  try {
    window.localStorage.setItem(`cv:startBlock:${appConfig.chainId}:${address}`, String(block));
  } catch { /* storage unavailable — recompute next time */ }
}

// Most free endpoints also prune old blocks, answering a historical getLogs with
// "history has been pruned" rather than a transport failure. That reads as an empty
// vote log unless we recognise it and move to a node that kept the history.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free endpoints throttle aggressively. This is a different failure from pruning and
// deserves a different explanation — telling someone to buy an archive node when they
// were merely rate-limited sends them down the wrong path.
function isRateLimitError(e: any): boolean {
  const status = String(e?.info?.responseStatus ?? e?.status ?? "");
  const msg = String(e?.error?.message ?? e?.shortMessage ?? e?.message ?? "");
  return /\b429\b/.test(status) || /\b429\b|rate.?limit|too many requests/i.test(msg);
}

function isHistoryUnavailableError(e: any): boolean {
  const msg = String(e?.error?.message ?? e?.shortMessage ?? e?.message ?? "").toLowerCase();
  return msg.includes("pruned")
    || msg.includes("history")
    || msg.includes("block range")
    || msg.includes("query returned more than");
}

export interface VoteLogEntry {
  hash: string;
  ts: number;
  block: number;
}

// Walks [fromBlock, toBlock] in chunks and returns the election's VoteCast entries.
async function scanVoteLog(
  provider: ethers.JsonRpcProvider,
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<VoteLogEntry[]> {
  const contract = new ethers.Contract(address, electionAbi, provider);
  const filter = contract.filters.VoteCast();
  const events: any[] = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    const end = Math.min(start + LOG_CHUNK_SIZE - 1, toBlock);
    events.push(...(await contract.queryFilter(filter, start, end)));
  }

  // One getBlock per distinct block rather than per event.
  const timestamps = new Map<number, number>();
  await Promise.all(
    Array.from(new Set(events.map((e) => e.blockNumber))).map(async (bn) => {
      const block = await provider.getBlock(bn);
      if (block) timestamps.set(bn, Number(block.timestamp));
    })
  );

  return events
    .map((e) => ({ hash: e.transactionHash, ts: timestamps.get(e.blockNumber) ?? 0, block: e.blockNumber }))
    .sort((a, b) => a.ts - b.ts);
}

// Locates a block at or before `targetTs`. A binary search over ~46M blocks costs
// ~25 sequential round-trips, which is enough on its own to earn a 429 from a free
// endpoint. Block time is near-constant, so interpolating between two known samples
// converges in about four requests instead, and we only need a safe lower bound —
// the caller widens the range anyway.
const BLOCK_SEARCH_TOLERANCE_SECONDS = 120;
const BLOCK_SEARCH_MAX_STEPS = 6;
const BLOCK_SEARCH_SAFETY_BLOCKS = 2_500;

async function findBlockByTimestamp(
  provider: ethers.JsonRpcProvider,
  targetTs: number,
  latest: number,
): Promise<number> {
  const head = await provider.getBlock(latest);
  if (!head || head.timestamp <= targetTs) return Math.max(1, latest);

  let refBlock = latest;
  let refTs = Number(head.timestamp);
  let secondsPerBlock = AMOY_BLOCK_TIME_SECONDS;
  let guess = Math.max(1, latest - Math.round((refTs - targetTs) / secondsPerBlock));

  for (let step = 0; step < BLOCK_SEARCH_MAX_STEPS; step++) {
    const block = await provider.getBlock(guess);
    if (!block) break;

    const ts = Number(block.timestamp);
    const drift = ts - targetTs;
    if (Math.abs(drift) <= BLOCK_SEARCH_TOLERANCE_SECONDS) {
      refBlock = guess;
      break;
    }

    // Recalibrate the rate from the two real samples before stepping again.
    if (guess !== refBlock) {
      const rate = (refTs - ts) / (refBlock - guess);
      if (Number.isFinite(rate) && rate > 0) secondsPerBlock = rate;
    }
    refBlock = guess;
    refTs = ts;

    const next = Math.max(1, Math.min(latest, guess - Math.round(drift / secondsPerBlock)));
    if (next === guess) break;
    guess = next;
  }

  // Step back far enough that any residual drift still leaves us before the target.
  const margin = Math.ceil(BLOCK_SEARCH_TOLERANCE_SECONDS / AMOY_BLOCK_TIME_SECONDS) + BLOCK_SEARCH_SAFETY_BLOCKS;
  return Math.max(1, Math.min(refBlock, guess) - margin);
}

// ─────────────────────────── Election Service ─────────────────────────────

export const ElectionService = {
  async readContract(address: string) {
    return new ethers.Contract(address, electionAbi, await getReadProvider());
  },

  async writeContract(address: string) {
    const signer = await getSigner();
    return new ethers.Contract(address, electionAbi, signer);
  },

  async getInfo(address: string): Promise<ElectionInfo> {
    return readWithFailover(async () => {
      const raw = await (await this.readContract(address)).getElectionInfo();
      return {
        address,
        title:          raw[0],
        description:    raw[1],
        isActive:       raw[2],
        isVotingOpen:   raw[3],
        startTime:      Number(raw[4]),
        endTime:        Number(raw[5]),
        createdAt:      Number(raw[6]),
        totalVotes:     Number(raw[7]),
        candidateCount: Number(raw[8]),
      };
    });
  },

  async getResults(address: string): Promise<CandidateResult[]> {
    return readWithFailover(async () => {
      const [names, counts]: [string[], bigint[]] = await (await this.readContract(address)).getResults();
      const total = counts.reduce((a, b) => a + b, BigInt(0));
      return names.map((name, i) => ({
        id:         i,
        name,
        voteCount:  Number(counts[i]),
        percentage: total > BigInt(0) ? Math.round((Number(counts[i]) / Number(total)) * 100) : 0,
      }));
    });
  },

  async getVoterStatus(address: string, voter: string): Promise<VoterStatus> {
    return readWithFailover(async () => {
      const [registered, voted, timestamp] = await (await this.readContract(address)).getVoterStatus(voter);
      return { registered, voted, timestamp: Number(timestamp) };
    });
  },

  // Every vote is a public VoteCast event. We surface the transaction, block and time
  // only — candidateId stays out of the returned shape so the UI can't leak who voted
  // for whom.
  async getVoteLog(address: string, fromTs: number, toTs: number): Promise<VoteLogEntry[]> {
    const provider = await getReadProvider();
    const latest = await provider.getBlockNumber();

    const cached = cachedStartBlock(address);
    const fromBlock = cached ?? await withTimeout(
      findBlockByTimestamp(provider, fromTs, latest),
      LOG_SCAN_TIMEOUT_MS,
    );
    if (cached === null) rememberStartBlock(address, fromBlock);
    // Estimating the upper bound from the block time saves a second binary search;
    // overshooting is harmless because the range is clamped to the chain head.
    const spanBlocks = Math.ceil(Math.max(0, toTs - fromTs) / AMOY_BLOCK_TIME_SECONDS * 1.2);
    const toBlock = Math.min(latest, fromBlock + spanBlocks + LOG_CHUNK_SIZE);

    // Whichever node is serving ordinary calls may still have pruned this range, so the
    // scan walks the endpoint list itself and keeps the first node that can answer.
    const failures: string[] = [];
    const deadline = Date.now() + LOG_TOTAL_BUDGET_MS;
    // The node already serving ordinary calls goes first; the rest are the fallback order.
    const candidates = Array.from(new Set([readProviderUrl, ...appConfig.rpcUrls].filter(Boolean)));
    for (const url of candidates) {
      if (Date.now() > deadline) break;
      const scanProvider = url === readProviderUrl ? provider : makeReadProvider(url);
      try {
        // A node can answer the range and still hiccup, so a transient failure is worth
        // one retry before we give up on it and lose an endpoint that has the history.
        for (let attempt = 0; ; attempt++) {
          try {
            return await withTimeout(
              scanVoteLog(scanProvider, address, fromBlock, toBlock),
              LOG_SCAN_TIMEOUT_MS,
            );
          } catch (e: any) {
            if (attempt === 0 && Date.now() < deadline && isRpcTransportError(e) && !isHistoryUnavailableError(e)) {
              await delay(750);
              continue;
            }
            throw e;
          }
        }
      } catch (e: any) {
        const reason = isRateLimitError(e) ? "rate-limited"
          : isHistoryUnavailableError(e) ? "history pruned"
          : "unreachable";
        failures.push(`${hostOf(url)} (${reason})`);
        if (!isRateLimitError(e) && !isHistoryUnavailableError(e) && !isRpcTransportError(e)) throw e;
      } finally {
        if (scanProvider !== provider) scanProvider.destroy();
      }
    }

    const throttled = failures.some((f) => f.includes("rate-limited"));
    const pruned = failures.some((f) => f.includes("history pruned"));
    const advice = throttled && !pruned
      ? "The public endpoints are throttling requests right now — try again shortly."
      : throttled
        ? "The public endpoints are either throttling requests or no longer keep blocks this old."
        : "Free endpoints prune old blocks.";
    throw new Error(
      `Could not read this election's logs from any RPC endpoint (tried ${failures.join(", ")}). ` +
      `${advice} Setting NEXT_PUBLIC_RPC_URL to a dedicated archive node makes this reliable.`
    );
  },

  async getMyVote(address: string): Promise<MyVote> {
    const contract = await this.writeContract(address);
    const [voted, candidateId, candidateName, timestamp] = await contract.getMyVote();
    return { voted, candidateId: Number(candidateId), candidateName, timestamp: Number(timestamp) };
  },

  async registerVoters(address: string, voters: string[]): Promise<string> {
    const contract = await this.writeContract(address);
    const overrides = await getGasOverrides();
    const tx = await contract.registerVoters(voters, overrides);
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async removeVoter(address: string, voter: string): Promise<string> {
    const contract = await this.writeContract(address);
    const tx = await contract.removeVoter(voter);
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async activate(address: string): Promise<string> {
    const contract = await this.writeContract(address);
    const overrides = await getGasOverrides();
    const tx = await contract.activate(overrides);
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async deactivate(address: string): Promise<string> {
    const contract = await this.writeContract(address);
    const overrides = await getGasOverrides();
    const tx = await contract.deactivate(overrides);
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async vote(address: string, candidateId: number): Promise<string> {
    const contract = await this.writeContract(address);
    const overrides = await getGasOverrides();
    const tx = await contract.vote(candidateId, overrides);
    const receipt = await tx.wait();
    return receipt.hash;
  },
};

// ─────────────────────────── Helpers ──────────────────────────────────────

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerTxUrl(hash: string): string {
  if (!appConfig.explorerUrl) return "";
  return `${appConfig.explorerUrl}/tx/${hash}`;
}

export function explorerAddressUrl(addr: string): string {
  if (!appConfig.explorerUrl) return "";
  return `${appConfig.explorerUrl}/address/${addr}`;
}
