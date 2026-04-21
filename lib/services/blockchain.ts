// lib/services/blockchain.ts
import { ethers, TransactionReceipt } from "ethers";
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

function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(appConfig.rpcUrl);
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

// ─────────────────────────── Factory Service ──────────────────────────────

export const FactoryService = {
  readContract() {
    if (!appConfig.factoryAddress) throw new Error("Factory address not configured. Did you deploy the contract?");
    return new ethers.Contract(appConfig.factoryAddress, factoryAbi, getReadProvider());
  },

  async writeContract() {
    if (!appConfig.factoryAddress) throw new Error("Factory address not configured.");
    const signer = await getSigner();
    return new ethers.Contract(appConfig.factoryAddress, factoryAbi, signer);
  },

  async getOwner(): Promise<string> {
    return (await this.readContract()).owner();
  },

  async getAllElections(): Promise<ElectionRecord[]> {
    const raw: any[] = await (await this.readContract()).getAllElections();
    return raw.map((r) => ({
      address:     r.electionAddress,
      title:       r.title,
      description: r.description,
      createdAt:   Number(r.createdAt),
      startTime:   Number(r.startTime),
      endTime:     Number(r.endTime),
    }));
  },

  async createElection(
    title: string,
    description: string,
    candidates: string[],
    startTime: number,
    endTime: number,
  ): Promise<{ hash: string; address: string }> {
    const contract = await this.writeContract();
    const tx = await contract.createElection(title, description, candidates, startTime, endTime);
    const receipt: TransactionReceipt = await tx.wait();
    const log = receipt.logs.find(
      (l: any) => l.fragment?.name === "ElectionCreated"
    );
    const address = log ? (log as any).args[0] : "";
    return { hash: receipt.hash, address };
  },
};

// ─────────────────────────── Election Service ─────────────────────────────

export const ElectionService = {
  readContract(address: string) {
    return new ethers.Contract(address, electionAbi, getReadProvider());
  },

  async writeContract(address: string) {
    const signer = await getSigner();
    return new ethers.Contract(address, electionAbi, signer);
  },

  async getInfo(address: string): Promise<ElectionInfo> {
    const raw = await this.readContract(address).getElectionInfo();
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
  },

  async getResults(address: string): Promise<CandidateResult[]> {
    const [names, counts]: [string[], bigint[]] = await this.readContract(address).getResults();
    const total = counts.reduce((a, b) => a + b, BigInt(0));
    return names.map((name, i) => ({
      id:         i,
      name,
      voteCount:  Number(counts[i]),
      percentage: total > BigInt(0) ? Math.round((Number(counts[i]) / Number(total)) * 100) : 0,
    }));
  },

  async getVoterStatus(address: string, voter: string): Promise<VoterStatus> {
    const [registered, voted, timestamp] = await this.readContract(address).getVoterStatus(voter);
    return { registered, voted, timestamp: Number(timestamp) };
  },

  async getMyVote(address: string): Promise<MyVote> {
    const contract = await this.writeContract(address);
    const [voted, candidateId, candidateName, timestamp] = await contract.getMyVote();
    return { voted, candidateId: Number(candidateId), candidateName, timestamp: Number(timestamp) };
  },

  async registerVoters(address: string, voters: string[]): Promise<string> {
    const contract = await this.writeContract(address);
    const tx = await contract.registerVoters(voters);
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
    const tx = await contract.activate();
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async deactivate(address: string): Promise<string> {
    const contract = await this.writeContract(address);
    const tx = await contract.deactivate();
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async vote(address: string, candidateId: number): Promise<string> {
    const contract = await this.writeContract(address);
    const tx = await contract.vote(candidateId);
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
