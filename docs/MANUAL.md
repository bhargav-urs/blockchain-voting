# 📖 ChainVote — Complete Setup & Deployment Manual

This manual walks you through every step: running locally, pushing to GitHub, and deploying live for free.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Polygon Amoy Testnet Deployment](#3-polygon-amoy-testnet-deployment)
4. [Push to GitHub](#4-push-to-github)
5. [Deploy Frontend to Vercel (Free)](#5-deploy-frontend-to-vercel-free)
6. [Admin Workflow](#6-admin-workflow)
7. [Student / Voter Workflow](#7-student--voter-workflow)
8. [Troubleshooting](#8-troubleshooting)
9. [Reset / Redeploy](#9-reset--redeploy)

---

## 1. Prerequisites

### 1.1 Install Node.js

Download Node.js 18+ from [nodejs.org](https://nodejs.org).

Verify:
```bash
node --version   # should print v18.x.x or higher
npm --version    # should print 9.x.x or higher
```

### 1.2 Install MetaMask

1. Go to [metamask.io](https://metamask.io)
2. Install the browser extension for Chrome, Firefox, or Brave
3. Create a new wallet or import an existing one
4. **Save your seed phrase somewhere safe**

### 1.3 Set up Git

Download from [git-scm.com](https://git-scm.com) if not already installed.

```bash
git --version  # should print git version 2.x.x
```

---

## 2. Local Development

### 2.1 Install the project

```bash
# Clone (or unzip the project folder) then navigate to it:
cd blockchain-voting

# Install all dependencies
npm install
```

This installs both the Next.js frontend and Hardhat (Ethereum development framework).

### 2.2 Start a local blockchain node

Open **Terminal 1** and run:

```bash
npm run node
```

This starts a Hardhat local blockchain at `http://127.0.0.1:8545`. You'll see 20 test accounts listed — each has 10,000 fake ETH. **Keep this terminal running.**

### 2.3 Deploy contracts to local blockchain

Open **Terminal 2** and run:

```bash
npm run deploy:local
```

You should see:
```
Deploying with account: 0xf39Fd6e51...
✅ ElectionFactory deployed to: 0x5FbDB2315...
📝 .env.local updated with factory address.
🚀 Run 'npm run dev' to start the frontend.
```

> The script automatically creates `.env.local` for you with the factory address and other settings.

### 2.4 Start the frontend

Still in Terminal 2 (or open Terminal 3):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2.5 Configure MetaMask for local development

You need to add the Hardhat local network to MetaMask:

1. Open MetaMask → click the network dropdown (top center)
2. Click **Add network** → **Add a network manually**
3. Fill in:
   - **Network name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency symbol:** ETH
4. Click **Save**
5. Switch to the **Hardhat Local** network

### 2.6 Import a test account to MetaMask

The Hardhat node printed 20 test accounts. To use one:

1. Copy the first private key shown (line: `Private Key: 0xac0974bec39...`)
2. Open MetaMask → click account icon → **Import Account**
3. Paste the private key → Import
4. This account is now your **admin wallet** on local

### 2.7 Run tests

```bash
npm test
```

All tests should pass. You'll see a summary of each test case.

---

## 3. Polygon Amoy Testnet Deployment

This is the public, permanently-accessible version. No cost — uses free test MATIC.

### 3.1 Get your admin wallet's private key

> ⚠️ **NEVER share your private key with anyone. Never commit it to git.**

In MetaMask:
1. Click the three dots next to your account → **Account Details**
2. Click **Show private key** → enter your MetaMask password
3. Copy the private key (starts with `0x`)

### 3.2 Get free test MATIC

1. Go to the [Polygon Faucet](https://faucet.polygon.technology)
2. Select **Amoy** network
3. Paste your wallet address (starts with `0x`)
4. Click **Submit** — you'll receive 0.5 MATIC (more than enough)
5. Wait ~30 seconds for the transaction to confirm

You can check your balance at [amoy.polygonscan.com](https://amoy.polygonscan.com)

### 3.3 Configure your .env.local

```bash
cp .env.example .env.local
```

Open `.env.local` in a text editor and set:

```bash
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_CHAIN_HEX=0x13882
NEXT_PUBLIC_CHAIN_NAME=Polygon Amoy
NEXT_PUBLIC_FACTORY_ADDRESS=   # leave blank for now, deploy script will fill this
NEXT_PUBLIC_EXPLORER_BASE_URL=https://amoy.polygonscan.com

# ⚠️ PRIVATE KEY — NEVER SHARE OR COMMIT THIS
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

### 3.4 Deploy to Amoy

```bash
npm run deploy:amoy
```

You should see:
```
Deploying to Polygon Amoy (testnet)
Deployer: 0xYOUR_ADDRESS
✅ ElectionFactory deployed!
   Address: 0xCONTRACT_ADDRESS
   Tx Hash: 0xTXHASH
   Explorer: https://amoy.polygonscan.com/address/0xCONTRACT_ADDRESS
📝 .env.local updated.
```

Your `.env.local` is automatically updated with the factory address.

### 3.5 Add Polygon Amoy to MetaMask

MetaMask may prompt you automatically. If not:

1. Open MetaMask → Networks → Add network manually
2. Fill in:
   - **Network name:** Polygon Amoy
   - **RPC URL:** `https://rpc-amoy.polygon.technology/`
   - **Chain ID:** `80002`
   - **Currency symbol:** MATIC
   - **Block explorer:** `https://amoy.polygonscan.com`
3. Save and switch to Polygon Amoy

### 3.6 Test locally against Amoy

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000), connect MetaMask (on Polygon Amoy), go to `/admin` and create a test election.

---

## 4. Push to GitHub

### 4.1 Create a GitHub repository

1. Go to [github.com](https://github.com) → Sign in
2. Click **New repository** (green button)
3. Name it `blockchain-voting`
4. Leave it **Private** if you don't want others to see your code (or Public for open source)
5. **Do NOT** initialise with README or .gitignore — the project already has these
6. Click **Create repository**

### 4.2 Push your code

In the project folder terminal:

```bash
git init
git add .
git commit -m "feat: initial ChainVote implementation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/blockchain-voting.git
git push -u origin main
```

> ✅ The `.gitignore` excludes `.env.local` and `node_modules` — your private key is safe.

### 4.3 Verify .env.local is excluded

Run:
```bash
git status
```

You should NOT see `.env.local` listed. If you do, stop and run:
```bash
git rm --cached .env.local
```

---

## 5. Deploy Frontend to Vercel (Free)

Vercel provides free frontend hosting with zero-config Next.js deployment.

### 5.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 5.2 Login to Vercel

```bash
vercel login
```

Choose "GitHub" and authorise. Or create a free account at [vercel.com](https://vercel.com).

### 5.3 Deploy

From the project folder:

```bash
vercel --prod
```

Answer the prompts:
- **Set up and deploy?** → Y
- **Which scope?** → your username
- **Link to existing project?** → N
- **Project name?** → `blockchain-voting` (or any name)
- **Which directory?** → `.` (current)
- **Override settings?** → N

Vercel will give you a URL like: `https://blockchain-voting-abc123.vercel.app`

### 5.4 Set environment variables on Vercel

The deployed app needs the environment variables. Set them in the Vercel dashboard:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project → **Settings** → **Environment Variables**
3. Add each variable (from your `.env.local`):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | `https://rpc-amoy.polygon.technology/` |
| `NEXT_PUBLIC_CHAIN_ID` | `80002` |
| `NEXT_PUBLIC_CHAIN_HEX` | `0x13882` |
| `NEXT_PUBLIC_CHAIN_NAME` | `Polygon Amoy` |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | `0xYOUR_FACTORY_ADDRESS` |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | `https://amoy.polygonscan.com` |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | `0xYOUR_ADMIN_ADDRESS` |

> ⚠️ Do NOT add `PRIVATE_KEY` to Vercel. That's only needed for deployment and never for the frontend.

### 5.5 Redeploy after setting env vars

```bash
vercel --prod
```

Or click **Redeploy** in the Vercel dashboard.

### 5.6 Share the link

Your app is now live at your Vercel URL. Share it with your students!

Example: `https://blockchain-voting.vercel.app`

---

## 6. Admin Workflow

### Step 1: Connect your admin wallet

1. Open the app → click **Connect Wallet** in the top-right
2. MetaMask pops up → click **Connect**
3. Make sure you're on **Polygon Amoy** network

### Step 2: Go to Admin Portal

Click **Admin** in the top navigation.

You should see a green **Admin** badge next to your address.

### Step 3: Create an election

On the **Create** tab:

1. Enter a **title** (e.g., "Best Club President 2025")
2. Enter a **description** (optional context for voters)
3. Set **Opens** and **Closes** date/times
4. Enter **candidate names** — one per line, at least 2
5. Paste voter wallet addresses in the **Pre-register Voters** box (one per line, or comma-separated)
6. Click **Deploy Election to Blockchain** → approve in MetaMask

> If you have voters to register: click **Deploy** first (creates the election), then the app auto-registers voters in a second transaction.

### Step 4: Activate the election

On the **Manage** tab:

1. Select your election from the left sidebar
2. Click **▶ Activate Election** → approve in MetaMask
3. The election is now LIVE (but voting only works within the time window)

### Step 5: Share the voter link

In the **Manage** tab, find the **Voter Link** card and click **Copy**.

Send the link to your students via email, LMS (Moodle, Canvas, Blackboard), etc.

### Step 6: Monitor results

Results update in real time on the election page. You can also see them in the Admin Portal → Manage tab.

### Step 7: Close the election

Click **⏸ Deactivate** to manually close voting at any time, regardless of the time window.

---

## 7. Student / Voter Workflow

### Step 1: Install MetaMask

1. Go to [metamask.io](https://metamask.io)
2. Install the browser extension
3. Create a new wallet (or use existing one)
4. **Note your wallet address** (0x... at the top) — this is what you give to the admin

### Step 2: Get free test MATIC

1. Go to [faucet.polygon.technology](https://faucet.polygon.technology)
2. Select **Amoy**
3. Paste your wallet address
4. Click **Submit**
5. Wait ~30 seconds

You only need to do this once. The gas fee for voting is tiny (~0.0001 MATIC).

### Step 3: Click the election link

Click the link your teacher/admin sent you. You'll see the ballot page.

### Step 4: Connect your wallet

Click **Connect MetaMask** → Approve in the MetaMask popup.

MetaMask may ask you to switch to **Polygon Amoy** — click **Switch network**.

### Step 5: Check your eligibility

You'll see:
- ✓ **Registered** — you can vote
- ✗ **Not Registered** — contact your admin; they need to add your wallet address

### Step 6: Vote

1. Click on a candidate card to select them
2. Click **Vote for [Candidate Name]**
3. MetaMask shows a transaction — click **Confirm**
4. Wait ~5 seconds for the transaction to confirm
5. ✅ Your vote is recorded forever on the blockchain!

### Step 7: Verify on PolygonScan (optional)

After voting, you'll see a transaction hash. Click it to see your vote on [amoy.polygonscan.com](https://amoy.polygonscan.com).

---

## 8. Troubleshooting

### "Factory address not configured"

- Make sure you ran `npm run deploy:local` or `npm run deploy:amoy`
- Check that `.env.local` exists and has `NEXT_PUBLIC_FACTORY_ADDRESS=0x...`
- Restart `npm run dev` after updating `.env.local`

### "Not Registered" even though admin added your address

- Admin: Double-check the exact wallet address — even one wrong character fails
- Admin: Make sure the register transaction was confirmed (visible on PolygonScan)
- Student: Make sure you're connected with the correct MetaMask account (top of MetaMask)

### MetaMask shows wrong network

- Click the network dropdown in MetaMask
- Switch to **Polygon Amoy** (or **Hardhat Local** for local dev)
- If Polygon Amoy isn't listed: Networks → Add network → fill in the details from Section 3.5

### Transaction keeps spinning / fails

- Increase gas fee: in MetaMask transaction popup → click gas fee → select "Fast"
- Make sure you have MATIC balance (get free test MATIC from the faucet)
- If on local: make sure `npm run node` is still running in a terminal

### "Could not load election" error

- Check your internet connection
- The Polygon Amoy RPC may be temporarily down — wait 1 minute and refresh
- For local: make sure `npm run node` is running

### Vercel deployment shows old version

- Push a new commit to GitHub → Vercel auto-deploys
- Or run `vercel --prod` again

### npm install fails

```bash
# Clear cache and retry:
rm -rf node_modules package-lock.json
npm install
```

---

## 9. Reset / Redeploy

### Redeploy contracts (new factory)

If you want a fresh start:

```bash
# For Amoy:
npm run deploy:amoy

# The script updates .env.local automatically.
# Update Vercel env vars with the new factory address.
```

> Old elections are still on-chain — you just won't see them in the new factory's list.

### Clear local blockchain state

When you stop and restart `npm run node`, all local state is wiped. Redeploy:

```bash
npm run deploy:local
```

### Rotate deployer wallet

1. Create a new MetaMask account
2. Get test MATIC for it from the faucet
3. Update `PRIVATE_KEY` in `.env.local`
4. Deploy again: `npm run deploy:amoy`
5. The new wallet becomes the admin

---

## 🎉 You're Live!

Your ChainVote app is:
- ✅ **Smart contracts** deployed on Polygon Amoy (permanent, free)
- ✅ **Frontend** hosted on Vercel (permanent, free)
- ✅ **Accessible** to anyone with your Vercel URL
- ✅ **Tamper-proof** — no one can change the votes, not even you

Share your Vercel URL with your class and happy voting! 🗳️
