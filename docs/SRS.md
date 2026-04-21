# Software Requirements Specification (SRS)

## ChainVote — Decentralised Blockchain Voting System

**Document Version:** 2.0  
**Project:** ChainVote  
**Status:** Final  
**Network:** Polygon Amoy Testnet  
**Last Updated:** 2025

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Stakeholders & User Classes](#3-stakeholders--user-classes)
4. [System Context](#4-system-context)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Smart Contract Requirements](#7-smart-contract-requirements)
8. [Security Requirements](#8-security-requirements)
9. [Privacy Requirements](#9-privacy-requirements)
10. [Interface Requirements](#10-interface-requirements)
11. [Constraints & Assumptions](#11-constraints--assumptions)
12. [Project Structure](#12-project-structure)
13. [Data Models](#13-data-models)
14. [Error Handling](#14-error-handling)
15. [Acceptance Criteria](#15-acceptance-criteria)
16. [Glossary](#16-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for **ChainVote**, a decentralised voting application built on the Polygon blockchain. It is intended for developers maintaining or extending the system, administrators deploying it, and auditors verifying its correctness.

### 1.2 Scope

ChainVote enables:
- Admin creation and management of one or more elections
- Voter authentication via MetaMask wallet (no passwords, no backend accounts)
- Immutable, tamper-proof vote casting on the Polygon blockchain
- Public, privacy-preserving result display (aggregate tallies, not individual choices)
- Fully free operation using Polygon Amoy test tokens

### 1.3 Definitions

See [Section 16 — Glossary](#16-glossary).

### 1.4 Intended Audience

- Smart contract developers
- Frontend developers
- System administrators / teachers deploying ChainVote
- Security auditors

### 1.5 Overview

This SRS is organised into functional requirements (what the system does), non-functional requirements (performance, security, usability), smart contract specifications, and a reference project structure.

---

## 2. Overall Description

### 2.1 Product Perspective

ChainVote operates entirely on-chain. It consists of:

1. **Smart Contracts** (Solidity) deployed to Polygon Amoy: `ElectionFactory` and `Election`
2. **Frontend** (Next.js 14) served statically, communicating with the blockchain via ethers.js and MetaMask

There is no backend server, no database, and no centralised authority that can alter or censor votes.

### 2.2 Product Functions

- Deploy and manage election smart contracts
- Register eligible voters by wallet address
- Cast cryptographically signed votes on-chain
- Display real-time public results
- Provide shareable election URLs

### 2.3 Operating Environment

| Component | Technology |
|---|---|
| Blockchain | Polygon Amoy Testnet (EVM-compatible) |
| Smart Contracts | Solidity 0.8.24, compiled with Hardhat |
| Frontend | Next.js 14, React 18, TypeScript |
| Wallet | MetaMask browser extension |
| Blockchain Library | ethers.js v6 |
| Deployment | Vercel (frontend), Polygon Amoy (contracts) |

---

## 3. Stakeholders & User Classes

### 3.1 Admin (Factory Owner)

The Ethereum wallet that deployed the `ElectionFactory` contract. Has exclusive rights to:
- Create new elections
- Activate / deactivate elections
- Register and remove voter wallets
- Set and update election time windows (before votes are cast)

Only one admin exists per factory deployment. This is enforced by the `onlyOwner` modifier in the smart contract.

### 3.2 Voter

Any registered wallet address. Can:
- View the active ballot
- Cast exactly one, permanent, immutable vote per election
- View their own vote receipt

### 3.3 Public Observer

Any user (wallet or not). Can:
- View all elections and their current status
- View aggregate results (vote counts, percentages)
- Verify results on PolygonScan

---

## 4. System Context

```
┌─────────────┐       MetaMask         ┌────────────────────┐
│   Browser   │◄──────────────────────►│   Polygon Amoy     │
│  (Next.js)  │                        │   Blockchain       │
│             │       ethers.js        │                    │
│  Frontend   │◄──────────────────────►│  ElectionFactory   │
│   Pages:    │                        │  Election (×N)     │
│  - Home     │                        │                    │
│  - Elections│       Read (RPC)       └────────────────────┘
│  - Election │◄──────────────────────►   RPC Provider
│  - Admin    │                           (Polygon Amoy)
└─────────────┘
```

The frontend reads blockchain state via a public RPC endpoint. Write operations (create election, register voters, cast vote) require MetaMask signature.

---

## 5. Functional Requirements

### FR-1: Election Creation

| ID | Requirement |
|---|---|
| FR-1.1 | The admin MUST be able to create a new election by providing: title, description, candidate names (≥2), start time (Unix timestamp), end time (Unix timestamp). |
| FR-1.2 | The system MUST reject creation if title is empty. |
| FR-1.3 | The system MUST reject creation if fewer than 2 candidates are provided. |
| FR-1.4 | The system MUST reject creation if start time ≥ end time. |
| FR-1.5 | Each created election MUST be deployed as a separate smart contract. |
| FR-1.6 | The factory contract MUST maintain an on-chain registry of all created elections. |

### FR-2: Election Status Control

| ID | Requirement |
|---|---|
| FR-2.1 | The admin MUST be able to activate an election (set `isActive = true`). |
| FR-2.2 | The admin MUST be able to deactivate an election at any time (set `isActive = false`). |
| FR-2.3 | Voting MUST be rejected when `isActive = false`, regardless of time window. |
| FR-2.4 | Voting MUST be rejected when `block.timestamp < startTime`. |
| FR-2.5 | Voting MUST be rejected when `block.timestamp > endTime`. |

### FR-3: Voter Registration

| ID | Requirement |
|---|---|
| FR-3.1 | The admin MUST be able to register one or more voter wallet addresses in a single transaction. |
| FR-3.2 | The admin MUST be able to remove a voter who has not yet voted. |
| FR-3.3 | The admin MUST NOT be able to remove a voter who has already voted. |
| FR-3.4 | Registering the same address twice MUST be idempotent (no error, no duplicate registration). |
| FR-3.5 | The zero address MUST be rejected during voter registration. |

### FR-4: Vote Casting

| ID | Requirement |
|---|---|
| FR-4.1 | A registered voter MUST be able to cast exactly one vote per election. |
| FR-4.2 | The system MUST reject a vote from an unregistered address. |
| FR-4.3 | The system MUST reject a second vote from an address that has already voted. |
| FR-4.4 | The system MUST reject a vote for an invalid candidate ID. |
| FR-4.5 | A vote MUST increment the target candidate's `voteCount` and the election's `totalVotes`. |
| FR-4.6 | The transaction timestamp MUST be recorded for the voter. |

### FR-5: Results

| ID | Requirement |
|---|---|
| FR-5.1 | Anyone MUST be able to view the names and vote counts of all candidates. |
| FR-5.2 | The system MUST calculate and display vote percentages. |
| FR-5.3 | Results MUST update in real time (auto-refresh ≤ 30 seconds). |
| FR-5.4 | After the election ends, the system MUST highlight the winner. |

### FR-6: Voter Link

| ID | Requirement |
|---|---|
| FR-6.1 | Each election MUST have a unique, shareable URL (e.g., `/election/0xABC...`). |
| FR-6.2 | The admin MUST be able to copy the voter link from the Admin Portal. |

### FR-7: Admin Portal

| ID | Requirement |
|---|---|
| FR-7.1 | The admin portal MUST require MetaMask connection. |
| FR-7.2 | The admin portal MUST display a warning if the connected wallet is not the factory owner. |
| FR-7.3 | The admin MUST be able to see all elections, select one, and manage it. |
| FR-7.4 | The admin MUST be able to view current results of any election. |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|---|---|
| NFR-1.1 | The frontend MUST load initial content in ≤ 3 seconds on a 10 Mbps connection. |
| NFR-1.2 | Blockchain reads MUST complete in ≤ 5 seconds under normal RPC conditions. |
| NFR-1.3 | Smart contract gas usage MUST be minimised (optimizer enabled, 200 runs). |

### 6.2 Reliability

| ID | Requirement |
|---|---|
| NFR-2.1 | All vote data MUST persist permanently on-chain, unaffected by frontend downtime. |
| NFR-2.2 | The system MUST remain functional even if the frontend goes offline; votes can still be cast directly via ethers.js or Hardhat. |

### 6.3 Usability

| ID | Requirement |
|---|---|
| NFR-3.1 | MetaMask connection MUST be achievable in ≤ 3 user interactions. |
| NFR-3.2 | The ballot page MUST clearly display the voter's eligibility, registration status, and whether they have voted. |
| NFR-3.3 | All error messages MUST be human-readable and actionable. |
| NFR-3.4 | The UI MUST be responsive and usable on mobile devices. |

### 6.4 Maintainability

| ID | Requirement |
|---|---|
| NFR-4.1 | All contract ABIs MUST be maintained as TypeScript constants in `lib/abi/`. |
| NFR-4.2 | All blockchain interaction MUST go through the service layer in `lib/services/blockchain.ts`. |
| NFR-4.3 | Environment variables MUST be documented in `.env.example`. |

### 6.5 Portability

| ID | Requirement |
|---|---|
| NFR-5.1 | The frontend MUST be deployable to any static hosting platform (Vercel, Netlify, GitHub Pages). |
| NFR-5.2 | Contracts MUST be deployable to any EVM-compatible testnet by changing `hardhat.config.js`. |

---

## 7. Smart Contract Requirements

### 7.1 ElectionFactory

| Requirement |
|---|
| Deployer becomes the immutable `owner`. |
| `createElection(title, description, candidates[], startTime, endTime)` — restricted to owner. |
| Maintains `ElectionRecord[]` array with address, title, description, timestamps. |
| `getAllElections()` returns all records for the frontend. |
| `isElectionFromFactory(addr)` enables frontend to verify contract provenance. |
| Emits `ElectionCreated(address, title, startTime, endTime, createdAt)`. |

### 7.2 Election

| Requirement |
|---|
| `owner` and `factory` are immutable — set at construction and never changed. |
| `vote(candidateId)` checks: isActive, time window, registered, not already voted. |
| `voterChoice` is a `private` mapping — inaccessible from outside the contract. |
| `getResults()` returns names and vote counts — never individual voter choices. |
| `getVoterStatus(addr)` returns `(registered, voted, timestamp)` — NOT the candidate ID. |
| `getMyVote()` is callable only by the voter themselves — returns their own choice. |
| `VoteCast` event emits `voter`, `candidateId`, `timestamp` — NOT `candidateName`. |
| All admin functions use `onlyOwner` modifier with custom error `NotOwner`. |
| All error states use custom errors (not `require` strings) for gas efficiency. |

---

## 8. Security Requirements

| ID | Requirement |
|---|---|
| SEC-1 | All admin functions MUST revert with `NotOwner` if called by a non-owner. |
| SEC-2 | Vote casting MUST be atomic — all checks happen before state changes. |
| SEC-3 | The `voterChoice` mapping MUST be `private`. No public getter should expose it. |
| SEC-4 | The zero address MUST be rejected in `registerVoters`. |
| SEC-5 | `updateTimeWindow` MUST be blocked once any votes have been cast (`totalVotes > 0`). |
| SEC-6 | Private keys MUST never be committed to version control (enforced via `.gitignore`). |
| SEC-7 | The admin address MUST never be hard-coded in frontend source code. |
| SEC-8 | The frontend MUST validate that connected wallet is on the correct chain before any write. |
| SEC-9 | Contract must be verified on PolygonScan for public auditability. |

---

## 9. Privacy Requirements

| ID | Requirement |
|---|---|
| PRV-1 | The `voterChoice` mapping MUST be `private` — no Solidity getter is generated. |
| PRV-2 | `getVoterStatus(addr)` MUST NOT return the candidate chosen by the voter. |
| PRV-3 | The `VoteCast` event MUST NOT emit the candidate's name, only the ID and timestamp. |
| PRV-4 | The frontend MUST NOT display which candidate any specific voter chose. |
| PRV-5 | `getMyVote()` MAY return the caller's own choice — this is intentional self-disclosure. |

> **Note:** On-chain data is technically accessible to sophisticated analysts who replay transactions. These requirements prevent easy casual disclosure, not determined forensic analysis. For maximum privacy, use zero-knowledge proofs (not in scope for this version).

---

## 10. Interface Requirements

### 10.1 Pages

| Route | Description |
|---|---|
| `/` | Landing page with feature overview and CTAs |
| `/elections` | Public list of all elections with status |
| `/election/[address]` | Ballot, voter status, live results, contract info |
| `/admin` | Admin portal — create elections, manage, register voters |

### 10.2 MetaMask Integration

- The application MUST detect MetaMask presence and display install prompt if absent.
- The application MUST request account access via `eth_requestAccounts`.
- The application MUST switch or add the correct network automatically.
- The application MUST listen to `accountsChanged` and `chainChanged` events.

### 10.3 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | Yes | JSON-RPC endpoint for read operations |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Decimal chain ID |
| `NEXT_PUBLIC_CHAIN_HEX` | Yes | Hex chain ID for MetaMask |
| `NEXT_PUBLIC_CHAIN_NAME` | Yes | Human-readable network name |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | Deployed factory contract address |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | No | Block explorer base URL |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | No | Admin wallet address (display only) |
| `PRIVATE_KEY` | Deploy-only | Deployer private key (never expose to frontend) |

---

## 11. Constraints & Assumptions

| Constraint/Assumption |
|---|
| Users must have MetaMask installed and configured. |
| Users need free test MATIC from the Polygon faucet to vote (gas fee ≈ 0.0001 MATIC). |
| Block confirmation time on Polygon Amoy is approximately 2–4 seconds. |
| The admin retains custody of their private key; losing it means losing admin access. |
| Polygon Amoy is a testnet — data is periodically reset by the Polygon team (unlikely but possible). |
| The RPC URL `https://rpc-amoy.polygon.technology` is public and rate-limited; for production use a paid RPC provider (Alchemy, QuickNode). |

---

## 12. Project Structure

```
blockchain-voting/
│
├── contracts/
│   ├── ElectionFactory.sol         # Factory: deploy & track elections
│   └── Election.sol                # Individual election with full voting logic
│
├── scripts/
│   ├── deploy-local.js             # Hardhat localhost deployment
│   └── deploy-amoy.js              # Polygon Amoy testnet deployment
│
├── test/
│   └── Election.test.js            # Full test suite (Mocha/Chai + Hardhat)
│
├── app/                            # Next.js 14 App Router
│   ├── layout.tsx                  # Root layout + NavBar
│   ├── globals.css                 # Full design system CSS
│   ├── page.tsx                    # / — Landing page
│   ├── elections/
│   │   └── page.tsx                # /elections — Elections list
│   ├── election/
│   │   └── [address]/
│   │       └── page.tsx            # /election/:addr — Ballot + results
│   └── admin/
│       └── page.tsx                # /admin — Admin portal
│
├── components/
│   ├── NavBar.tsx                  # Top navigation with wallet status
│   ├── WalletButton.tsx            # Connect/display wallet button
│   └── ui.tsx                      # Shared UI: Alert, Spinner, CopyBox, etc.
│
├── lib/
│   ├── abi/
│   │   ├── factoryAbi.ts           # ElectionFactory ABI
│   │   └── electionAbi.ts          # Election ABI
│   ├── adapters/
│   │   └── wallet.ts               # MetaMask wallet adapter
│   ├── hooks/
│   │   └── useWallet.ts            # React wallet state hook
│   ├── services/
│   │   └── blockchain.ts           # ethers.js service layer
│   └── config/
│       └── env.ts                  # Environment variable config
│
├── docs/
│   ├── SRS.md                      # This document
│   ├── README.md                   # → same as root README.md
│   └── MANUAL.md                   # Local + deployment guide
│
├── .env.example                    # Environment variable template
├── .gitignore
├── hardhat.config.js               # Hardhat/Solidity configuration
├── next.config.js                  # Next.js configuration
├── package.json
└── tsconfig.json
```

---

## 13. Data Models

### Election (On-chain State)

```solidity
struct Candidate {
  string  name;        // Candidate display name
  uint256 voteCount;   // Number of votes received
}

address   factory;             // Factory that created this election
address   owner;               // Admin wallet (immutable)
string    title;               // Election title
string    description;         // Description for voters
bool      isActive;            // Admin gate
uint256   startTime;           // Unix timestamp
uint256   endTime;             // Unix timestamp
uint256   createdAt;           // Unix timestamp
uint256   totalVotes;          // Aggregate vote counter

Candidate[]                  candidates;           // Public candidate list
mapping(address => bool)     isRegisteredVoter;
mapping(address => bool)     hasVoted;
mapping(address => uint256)  voterChoice;          // PRIVATE
mapping(address => uint256)  votedAt;
```

### ElectionRecord (Factory registry)

```solidity
struct ElectionRecord {
  address electionAddress;
  string  title;
  string  description;
  uint256 createdAt;
  uint256 startTime;
  uint256 endTime;
}
```

### Frontend Types

```typescript
interface ElectionInfo {
  address:        string;
  title:          string;
  description:    string;
  isActive:       boolean;
  isVotingOpen:   boolean;
  startTime:      number;   // Unix seconds
  endTime:        number;
  createdAt:      number;
  totalVotes:     number;
  candidateCount: number;
}

interface CandidateResult {
  id:         number;
  name:       string;
  voteCount:  number;
  percentage: number;
}

interface VoterStatus {
  registered: boolean;
  voted:      boolean;
  timestamp:  number;       // When they voted (0 if not voted)
}
```

---

## 14. Error Handling

### Smart Contract Custom Errors

| Error | Trigger |
|---|---|
| `NotOwner()` | Non-owner calls admin function |
| `VotingNotOpen()` | `isActive=false` OR outside time window |
| `AlreadyVoted()` | Voter calls `vote()` a second time |
| `NotRegistered()` | Unregistered address calls `vote()` |
| `InvalidCandidate()` | `candidateId >= candidates.length` |
| `EmptyTitle()` | Empty string passed as title |
| `NeedAtLeastTwoCandidates()` | `candidates.length < 2` |
| `InvalidTimeWindow()` | `startTime >= endTime` |
| `ZeroAddress()` | Zero address in voter registration |
| `ElectionAlreadyHasVotes()` | `updateTimeWindow` called after voting |

### Frontend Error Handling

- All blockchain calls wrapped in try/catch
- Ethers.js `reason` / `shortMessage` extracted for user-friendly messages
- MetaMask rejection (code 4001) gracefully handled
- Network mismatch triggers automatic chain switch
- Contract not configured shows setup instructions

---

## 15. Acceptance Criteria

| Criteria | Test |
|---|---|
| Admin can create election | `npm test` — factory creation tests pass |
| Non-admin cannot create election | `npm test` — `NotOwner` revert tests pass |
| Registered voter votes once | `npm test` — vote + AlreadyVoted tests pass |
| Unregistered voter blocked | `npm test` — `NotRegistered` revert test passes |
| Vote after deadline blocked | `npm test` — time window test passes |
| Results show correct counts | `npm test` — tally test passes |
| Privacy: voterChoice not exposed | `npm test` — VoteCast event structure test passes |
| Frontend loads without errors | `npm run dev` — no console errors |
| Admin portal requires correct wallet | Manual test: connect non-admin wallet → warning shown |
| Voter link shares correct URL | Manual test: copy link → opens correct ballot |

---

## 16. Glossary

| Term | Definition |
|---|---|
| **Admin** | The Ethereum wallet that deployed the `ElectionFactory` contract |
| **Blockchain** | A distributed, immutable ledger of transactions |
| **Candidate** | A named option on a ballot that voters choose between |
| **Chain ID** | A numeric identifier for a specific blockchain network |
| **Contract Address** | The unique on-chain address of a deployed smart contract |
| **dApp** | Decentralised Application — a frontend connected to a blockchain backend |
| **Election** | A smart contract instance representing one voting event |
| **Factory** | A smart contract that deploys and tracks other contracts |
| **Gas** | A fee paid to the network for executing transactions (free on testnet) |
| **Immutable** | Data that cannot be changed or deleted once written to the blockchain |
| **MATIC** | The native token of Polygon, used to pay gas fees |
| **MetaMask** | A browser wallet used to sign blockchain transactions |
| **Polygon Amoy** | An EVM-compatible Ethereum testnet operated by the Polygon team |
| **Private Key** | A secret cryptographic key used to sign transactions — the "password" for a wallet |
| **RPC** | Remote Procedure Call — an API endpoint for reading blockchain state |
| **Smart Contract** | Self-executing code deployed on the blockchain |
| **Testnet** | A blockchain network for testing; uses free, worthless test tokens |
| **Transaction Hash** | A unique fingerprint (hex string) identifying a blockchain transaction |
| **Voter** | A registered wallet address eligible to cast one vote in an election |
| **Wallet Address** | A public Ethereum address (`0x...`) derived from a private key |
