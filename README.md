# ⛓ ChainVote — Decentralised Blockchain Voting

> Transparent, tamper-proof elections powered by Polygon Amoy testnet, Next.js 14, Hardhat, and MetaMask.  
> **Completely free** to run — no real money required.

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Immutable votes** | Every vote is a permanent on-chain transaction — unalterable by anyone |
| **MetaMask authentication** | No passwords, no accounts — your wallet is your identity |
| **One vote per wallet** | Enforced at the smart contract level; mathematically impossible to double-vote |
| **Public results, private choices** | Aggregate vote counts are visible to all; who voted for whom is never revealed |
| **Admin-controlled access** | Only the deployer wallet can create elections and register eligible voters |
| **Start/end scheduling** | Elections have a defined open window; voting outside it is rejected by the contract |
| **Shareable voter links** | Share a single URL — registered voters click it and vote |
| **Free testnet** | Polygon Amoy testnet with free test MATIC — no real cost |
| **100% on-chain** | No backend server, no database — everything lives on the blockchain |

---

## 🏗 Architecture

```
blockchain-voting/
├── contracts/
│   ├── ElectionFactory.sol   # Deploys & tracks all elections
│   └── Election.sol          # Individual election logic + vote storage
├── scripts/
│   ├── deploy-local.js       # Deploy to Hardhat localhost
│   └── deploy-amoy.js        # Deploy to Polygon Amoy testnet
├── test/
│   └── Election.test.js      # Full Hardhat test suite (privacy, security, logic)
├── app/                      # Next.js 14 App Router pages
│   ├── page.tsx              # Landing page
│   ├── elections/page.tsx    # Public elections list
│   ├── election/[address]/   # Individual ballot + live results
│   └── admin/page.tsx        # Admin portal (create, manage, register voters)
├── components/               # Shared React components
├── lib/
│   ├── abi/                  # Contract ABIs
│   ├── adapters/wallet.ts    # MetaMask adapter
│   ├── hooks/useWallet.ts    # React wallet hook
│   └── services/blockchain.ts # All ethers.js contract interactions
└── docs/
    ├── SRS.md                # Software Requirements Specification
    └── MANUAL.md             # Local run + deploy guide
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | Runtime |
| npm | ≥ 9 | Package manager |
| MetaMask | Latest | Browser wallet |

### 1. Install

```bash
git clone https://github.com/YOUR_USERNAME/blockchain-voting.git
cd blockchain-voting
npm install
```

### 2. Run locally (zero cost, zero setup)

```bash
# Terminal 1 — start the local blockchain
npm run node

# Terminal 2 — deploy contracts
npm run deploy:local

# Terminal 3 — start the frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect MetaMask to **Hardhat Local** network (`localhost:8545`, chain ID `31337`).

> The deploy script automatically writes your `.env.local` with the factory contract address.

### 3. Deploy to Polygon Amoy testnet (public & free)

```bash
# Get free test MATIC first:
# https://faucet.polygon.technology (select Amoy)

# Copy and fill in your deployer private key:
cp .env.example .env.local
# Edit .env.local → set PRIVATE_KEY=0x...

npm run deploy:amoy
npm run dev
```

Share your Vercel/Railway deployment URL — it's publicly accessible, free, and on-chain.

---

## 🔐 Smart Contracts

### `ElectionFactory.sol`
- Owned by the deployer address
- Deploys individual `Election` contracts
- Keeps an on-chain registry of all elections

### `Election.sol`
- **Immutable core**: once created, candidate list and owner are permanent
- **Privacy-preserving**: `voterChoice` is a private mapping — no external call can see who voted for whom
- `getVoterStatus(addr)` returns `(registered, voted, timestamp)` — NOT the candidate chosen
- `getMyVote()` — voters can only view their OWN choice via this function
- The `VoteCast` event emits `candidateId` and `timestamp` only — NOT the candidate's name
- Admin can activate/deactivate; voting also requires `block.timestamp ∈ [startTime, endTime]`

---

## 🧪 Tests

```bash
npm test
```

The test suite covers:

- Factory ownership and access control
- Election creation with invalid parameters
- Voter registration and removal
- Voting: success, double-vote prevention, unregistered voter, invalid candidate
- Time-window enforcement (voting before open, after close)
- Privacy: `VoteCast` event structure verification
- Result tallying accuracy

---

## 🛡 Security Design

| Threat | Mitigation |
|---|---|
| Double voting | Smart contract `hasVoted` mapping — enforced on-chain |
| Unregistered vote | `isRegisteredVoter` check before every vote |
| Vote manipulation | Blockchain immutability — transactions cannot be altered |
| Fake admin | Only deployer address can call owner-restricted functions |
| Identity linking | `voterChoice` is a private mapping; events omit candidate names |
| Out-of-window voting | Dual guard: admin `isActive` flag AND Unix timestamp check |

---

## 📡 Networks

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Polygon Amoy (testnet) | 80002 | https://rpc-amoy.polygon.technology | https://amoy.polygonscan.com |
| Hardhat localhost | 31337 | http://127.0.0.1:8545 | — |

---

## 🌐 Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set the following environment variables in your Vercel dashboard:

```
NEXT_PUBLIC_RPC_URL
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_CHAIN_HEX
NEXT_PUBLIC_CHAIN_NAME
NEXT_PUBLIC_FACTORY_ADDRESS
NEXT_PUBLIC_EXPLORER_BASE_URL
NEXT_PUBLIC_ADMIN_ADDRESS
```

The app is fully static-compatible — no serverless functions needed.

---

## 👩‍🏫 Classroom Use

1. Teacher deploys the factory contract once (takes 1 minute).
2. Teacher creates an election from the Admin Portal, setting start/end dates.
3. Teacher collects student MetaMask wallet addresses and pastes them into the voter registration box.
4. Teacher copies the election link and shares it (email, LMS, etc.).
5. Students click the link, connect MetaMask, and vote during the election window.
6. Anyone can see results in real time on the election page or on PolygonScan.

---

## 📄 License

MIT — free to use, modify, and distribute.
