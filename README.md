# AgentTreasury CORE

**Autonomous CFO for DAOs** — Two AI agents that hold, lend, and manage USDt on-chain without human intervention.

Built for **Tether Hackathon Galáctica: WDK Edition 1** (March 2–22, 2026)

> **Tracks**: 🏦 Lending Bot · 🤖 Agent Wallets · 🌊 Autonomous DeFi Agent

---

### 🔴 Live Deployment (Arbitrum One Mainnet)

| Resource | URL / Address |
|----------|---------------|
| **Dashboard** | https://agent-treasury.pages.dev |
| **API** | https://treasury.proceedgate.dev |
| **TreasuryVault** | [`0x5503e9d53592B7D896E135804637C1710bDD5A64`](https://arbiscan.io/address/0x5503e9d53592B7D896E135804637C1710bDD5A64) |
| **CreditLine** | [`0x236AB6D30F70D7aB6c272aCB3b186D925Bcae1a0`](https://arbiscan.io/address/0x236AB6D30F70D7aB6c272aCB3b186D925Bcae1a0) |
| **USDt (Arbitrum)** | [`0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`](https://arbiscan.io/address/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9) |
| **Aave V3 Pool** | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| **WDK Wallet** | [`0xcF341c10f9173B6Fa4814f7a84b64653C25bEBed`](https://arbiscan.io/address/0xcF341c10f9173B6Fa4814f7a84b64653C25bEBed) (AGENT_ROLE + EXECUTOR_ROLE on both contracts) |
| **Deployer** | `0xE9a30BCbdE263eBfebB24768a3f9642044a9804c` (DEFAULT_ADMIN_ROLE) |

### 🧑‍⚖️ For Judges — Quick Evaluation

**1. See it live** — Open the [Dashboard](https://agent-treasury.pages.dev). The Treasury Agent and Credit Agent run autonomously with real USDt on Arbitrum One.

**2. Verify on-chain** — Click the TreasuryVault or CreditLine links above to see real transactions on Arbiscan.

**3. Test the API**:
```bash
# Health check
curl https://treasury.proceedgate.dev/health

# Dashboard data (treasury state, loans, agent decisions)
curl https://treasury.proceedgate.dev/api/dashboard

# Credit score an address
curl -X POST https://treasury.proceedgate.dev/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/evaluate

# ML default prediction
curl https://treasury.proceedgate.dev/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/default-prediction

# Generate ZK credit proof
curl -X POST https://treasury.proceedgate.dev/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/zk-proof
```

**4. Run contract tests** (31 Foundry tests):
```bash
npm run contracts:test
```

**5. WDK on-chain proof** (see [`ONCHAIN_PROOF.md`](ONCHAIN_PROOF.md) for full details):

All write transactions go through WDK as primary signer (`0xcF34...`). Verified on Arbitrum One mainnet:

| Proof | Transaction |
|-------|-------------|
| AGENT_ROLE grant (Vault) | [`0x26bb7311...`](https://arbiscan.io/tx/0x26bb7311729c8e50a7ffad327932c76781d4d8dd631d25c631a51d4432a6eb02) |
| EXECUTOR_ROLE grant (Vault) | [`0x8ecf85df...`](https://arbiscan.io/tx/0x8ecf85df9f9a15f73a67b193052e044016d7da93305e27cb3d0fc4f2ed603ee3) |
| AGENT_ROLE grant (Credit) | [`0x03ea9eb1...`](https://arbiscan.io/tx/0x03ea9eb141788f3cf12d96073186c63db5efa966273a7aa8d0d7468f8da02824) |
| EXECUTOR_ROLE grant (Credit) | [`0x80902fa2...`](https://arbiscan.io/tx/0x80902fa26e34434b594f54ef8fa1bdf48c957cbbb086fe61743c36eec64a0d2e) |
| USDt approve → Aave V3 | [`0x46f7966b...`](https://arbiscan.io/tx/0x46f7966bd2055e22273e6d3870232a2e630612d57b8e629ea8225585fd9d4bdc) |
| USDt supply → Aave V3 | [`0x2cccf89d...`](https://arbiscan.io/tx/0x2cccf89dfe2c17599dd1644e8e92c265d8218c9e3f5d730fe61a871b4c6d7152) |

---

## What It Does

AgentTreasury is a **2-agent autonomous financial system** that manages a DAO treasury:

| Agent | Responsibilities |
|-------|-----------------|
| **Treasury Agent** | Yield optimization (Aave via WDK), withdrawal proposals, emergency pause, daily volume caps |
| **Credit Agent** | On-chain credit scoring (500–1000), 3-tier lending (5%/10%/15% APR), default detection, repayment tracking |

Both agents **hold and manage USDt autonomously**, make LLM-powered decisions, and debate strategy in periodic **Board Meetings** (inter-agent dialogue).

### Hackathon Track Alignment

#### 🏦 Lending Bot — Must Haves ✅
- ✅ Agent makes lending decisions **without human prompts** — idle capital detection reads vault USDt balance, lowers score threshold, and proactively extends credit
- ✅ All transactions settle **on-chain using USDt** (Arbitrum One mainnet)
- ✅ Agent **autonomously tracks and collects repayments** with tiered penalty interest (5%/10%/15%) and credit freeze on default

#### 🏦 Lending Bot — Nice to Haves ✅
- ✅ **On-chain history for credit scores** — formula uses txCount, volume, repaid loans, defaults, account age
- ✅ **LLMs negotiate loan terms** — Credit Agent uses LLM to evaluate borrower risk and recommend tier
- ✅ **Agent reallocates capital to higher-yield opportunities** — Treasury Agent scans Aave, invests idle funds
- ✅ **Lending with minimal collateral** — undercollateralized loans based on credit score

#### 🤖 Agent Wallets — Must Haves ✅
- ✅ **OpenClaw** for agent reasoning (workspace: `agents/SOUL.md`, skills, `TOOLS.md`)
- ✅ **WDK primitives** for wallet creation, signing, accounts (`@tetherto/wdk`, `wdk-wallet-evm`)
- ✅ Agents **hold, send, and manage USDt autonomously**

#### 🤖 Agent Wallets — Nice to Haves ✅
- ✅ **Clear separation** between agent logic (LLM reasoning) and wallet execution (WDK + Smart Contracts)
- ✅ **Safety**: permissions (RBAC roles), daily limits, timelock, multi-sig, emergency pause

#### 🌊 Autonomous DeFi Agent — Must Haves ✅
- ✅ Agent decides **when and why** (LLM picks strategy, Board Meeting debates allocation)
- ✅ **USDt as base asset** for all operations
- ✅ **WDK** for wallet and transaction execution

#### 🏦 Lending Bot — Bonuses ✅
- ✅ **Inter-agent lending** — Credit Agent can borrow capital from Treasury Agent's pool via EventBus (`credit:capital_request` → `treasury:capital_allocated`). Treasury evaluates and caps at 20% of balance per request. See `backend/src/services/InterAgentLending.ts`
- ✅ **ML default prediction** — Logistic regression model predicts probability of loan default (0–100%) using 7 features: txCount, volume, repaymentRate, accountAge, creditScore, utilizationRate, defaultHistory. Critical risk (>60%) auto-blocks loans before LLM evaluation. See `backend/src/services/DefaultPredictor.ts`
- ✅ **ZK credit proofs** — Borrowers can prove their credit score meets a tier threshold (e.g., "≥800 = Excellent") without revealing the exact score. Uses SHA-256 commitments + Fiat-Shamir bit-decomposition range proofs + replay prevention (each proof has a unique ID, used proofs tracked in SQLite). See `backend/src/services/ZKCreditProof.ts`
- ✅ **Revenue-backed lending** — AI agents borrow against projected future earnings (invoice factoring for the agent economy). Tracks 24h/7d/30d rolling revenue, velocity trends, and computes borrow capacity at 50% of projected 30d revenue. See `backend/src/services/RevenueTracker.ts`
- ✅ **Autonomous debt restructuring** — ML-triggered, LLM-negotiated loan term modification. When `DefaultPredictor` flags >50% default probability, `DebtRestructuring` proposes new terms (extend duration, reduce rate, partial forgiveness, tranches). Auto-accepted for autonomous operation. See `backend/src/services/DebtRestructuring.ts`
- ✅ **Idle capital detection + proactive lending** — Agent reads vault USDt balance on-chain, detects idle capital (>500 USDt), lowers score threshold (700→600), and extends up to 3 proactive loans per cycle in aggressive mode (>2000 USDt idle)
- ✅ **Tiered penalty interest** — Overdue loans accrue penalty: 5% (1-7d), 10% (8-14d), 15% (15+d). Credit score reduces -10/day during grace period
- ✅ **Credit freeze on default** — Defaulted borrowers get `creditFrozen=true`, score -200, available credit zeroed. Must resolve defaults before new loans

### Key Integrations

| Technology | Role |
|-----------|------|
| **WDK** (`@tetherto/wdk`, `wdk-wallet-evm`, `wdk-protocol-lending-aave-evm`) | Server-side wallet (seed in `.env`), Aave lending |
| **OpenClaw** | Agent identity (SOUL.md), skills, MCP tool definitions |
| **Foundry** | Smart contract tests (31 tests) & deployment |
| **Groq** (LLaMA 3.3 70B) | Primary LLM for agent reasoning |  
| **Failover LLM** (configurable) | Any OpenAI-compatible provider — auto-switches on 429/5xx |
| **MCP Server** | 15 tools for external agent access (stdio transport) |
| **Ethers.js v6** | Read-only contract interactions |
| **SQLite (WAL)** | Persistent state: loans, profiles, decisions, ZK proof log (`better-sqlite3`) |

## Architecture

```
agent-treasury/
├── agents/                       # OpenClaw agent workspace
│   ├── SOUL.md                   # Behavioral identity & safety constraints
│   ├── AGENTS.md                 # Agent roster & communication rules
│   ├── TOOLS.md                  # Available MCP tools (15)
│   ├── treasury/SKILL.md         # Treasury agent skill
│   └── credit/SKILL.md           # Credit agent skill
├── contracts/                    # Solidity 0.8.20 (Foundry, 31 tests)
│   ├── TreasuryVault.sol         # Multi-sig vault + yield (RBAC, timelock)
│   ├── CreditLine.sol            # Credit scoring + lending (3 tiers)
│   ├── MockUSDT.sol              # Test token for local dev
│   └── script/Deploy.s.sol
├── backend/                      # Node.js + Express + WS
│   └── src/
│       ├── agents/
│       │   ├── TreasuryAgent.ts  # Yield optimization, withdrawal proposals
│       │   └── CreditAgent.ts    # Credit scoring, lending, repayment
│       ├── orchestrator/
│       │   ├── EventBus.ts       # Pub/sub for inter-agent communication
│       │   └── AgentDialogue.ts  # Board Meetings (LLM-driven debate)
│       ├── services/
│       │   ├── wdk.ts            # WDK wallet initialization
│       │   ├── LLMClient.ts      # Failover LLM wrapper (primary + fallback)
│       │   ├── DefaultPredictor.ts    # ML logistic regression for default prediction
│       │   ├── InterAgentLending.ts   # Inter-agent capital allocation via EventBus
│       │   ├── ZKCreditProof.ts       # ZK range proofs for credit tier privacy
│       │   ├── RevenueTracker.ts      # Revenue-backed lending (agent earnings tracking)
│       │   ├── DebtRestructuring.ts   # Autonomous debt restructuring (ML+LLM)
│       │   ├── StateDB.ts             # SQLite (WAL) persistence layer
│       │   └── StatePersistence.ts    # Dual-write: JSON + SQLite
│       ├── mcp-server.ts         # MCP server (stdio, 15 tools)
│       └── index.ts              # API + WebSocket server
├── frontend/                     # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/Dashboard.tsx   # Main dashboard (timeline, agents, loans)
│       ├── components/           # AgentStatus, LiveLogs, WalletButton
│       └── hooks/                # useDashboard, useWebSocket (real-time)
├── openclaw.config.json          # OpenClaw MCP server config
└── foundry.toml                  # Forge configuration
```

### System Flow

```
                    ┌─────────────────────┐
                    │    Smart Contracts   │
                    │  TreasuryVault.sol   │
                    │   CreditLine.sol     │
                    └────────▲────────────┘
                             │ ethers.js + WDK
                    ┌────────┴────────────┐
                    │      Backend         │
              ┌─────┤  Express + WS :3001  ├─────┐
              │     └─────────────────────┘      │
              │              │                    │
     ┌────────▼───┐  ┌──────▼──────┐   ┌────────▼────────┐
     │  Treasury   │  │   Credit    │   │  Agent Dialogue  │
     │   Agent     │  │   Agent     │   │ (Board Meetings) │
     │ yield/risk  │  │ score/lend  │   │  LLM debate/45s  │
     └──────┬──────┘  └──────┬──────┘   └────────┬────────┘
            │                │                    │
            └────────┬───────┘                    │
                     │  EventBus                  │
              ┌──────▼──────┐
              │   Frontend   │
              │  Dashboard   │
              │  WebSocket   │
              └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 22+
- Foundry (forge, anvil)
- LLM API key: Groq (free) or OpenAI (optional — agents fall back to deterministic logic without it)

### Quick Demo (Local — No testnet needed!)

The fastest way to see the system working:

```powershell
# 1. Start Anvil (local devnet)
anvil --host 127.0.0.1 --port 8545

# 2. Deploy contracts + seed vault with 50k USDt
forge script contracts/script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://127.0.0.1:8545 --broadcast

# 3. Copy .env.example → .env, fill in deployed addresses from step 2
cp backend/.env.example backend/.env

# 4. Start backend
cd backend && npx tsx src/index.ts

# 5. Test
curl http://localhost:3001/health
curl http://localhost:3001/api/dashboard
curl -X POST http://localhost:3001/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/evaluate
```

Or run the automated demo script (Windows):
```powershell
$env:GROQ_API_KEY = "gsk_..."   # optional (free at console.groq.com)
.\scripts\demo-local.ps1
```

### Full Setup (Arbitrum One)

#### Prerequisites (additional)
- WDK seed phrase (12/24-word mnemonic)
- ETH on Arbitrum One for gas
- Arbitrum RPC URL (public or Alchemy/Infura)

### 1. Install

```bash
git clone <repo-url>
cd agent-treasury

# Install all dependencies
npm run install:all

# Install Foundry deps
cd contracts && forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-commit
```

### 2. Environment Setup

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```bash
# LLM (primary — Groq is free at console.groq.com)
LLM_API_KEY=gsk_...
LLM_MODEL=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_PROVIDER_NAME=groq

# LLM failover (optional)
# LLM_FALLBACK_API_KEY=sk-...
# LLM_FALLBACK_MODEL=gpt-4
# LLM_FALLBACK_BASE_URL=https://api.openai.com/v1

# WDK
WDK_SEED_PHRASE="your twelve word mnemonic phrase goes here ..."

# Chain
RPC_URL=https://arbitrum-one-rpc.publicnode.com
CHAIN_ID=42161
USDT_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
AAVE_POOL_ADDRESS=0x794a61358D6845594F94dc1DB02A252b5b4814aD
TREASURY_VAULT_ADDRESS=<deployed>
CREDIT_LINE_ADDRESS=<deployed>
```

### 3. Deploy Contracts

```bash
npm run contracts:test           # Run Forge tests first
npm run contracts:deploy         # Deploy to Arbitrum One
```

### 4. Run

```bash
# Terminal 1 — Backend (port 3001)
npm run dev:backend

# Terminal 2 — Frontend (port 3000)
npm run dev:frontend
```

Visit `http://localhost:3000` for the dashboard.

### 5. MCP Server & OpenClaw Integration

The project exposes all Treasury and Credit agent capabilities via an **MCP (Model Context Protocol) server** that OpenClaw or any MCP-compatible client can use.

#### Run the MCP Server

```bash
# Build first
cd backend && npm run build

# Run MCP server (stdio transport — used by OpenClaw)
npm run mcp

# Or directly:
node dist/mcp-server.js
```

The MCP server proxies to the running backend API (default `http://localhost:3001`). Override with `BACKEND_URL` env var.

#### Available MCP Tools (15 tools)

| Tool | Description |
|------|-------------|
| `treasury_get_balance` | Get vault USDt balance |
| `treasury_get_state` | Full treasury state |
| `treasury_sync` | Force on-chain sync |
| `treasury_propose_withdrawal` | Propose withdrawal (1h timelock) |
| `treasury_invest_yield` | Invest in Aave |
| `treasury_get_yield_opportunities` | Scan yield protocols |
| `treasury_emergency_pause` | Freeze all ops |
| `credit_evaluate` | Credit score an address |
| `credit_get_profile` | Get credit profile |
| `credit_borrow` | Borrow USDt |
| `credit_repay` | Repay a loan |
| `credit_get_loans` | List active loans |
| `dashboard_get_data` | Full dashboard data |
| `agent_get_decisions` | Agent decisions with reasoning |
| `health_check` | Backend/agent status |

#### OpenClaw Configuration

The `agents/` directory is the OpenClaw workspace:

```
agents/
├── SOUL.md            # Agent behavioral identity & constraints
├── TOOLS.md           # MCP tool inventory (maps to MCP server)
├── AGENTS.md          # Agent roster & communication
├── treasury/SKILL.md  # Treasury agent capabilities
└── credit/SKILL.md    # Credit agent capabilities
```

OpenClaw config (`openclaw.config.json`):
```json
{
  "agent": { "model": "groq/llama-3.3-70b-versatile" },
  "mcpServers": {
    "agent-treasury": {
      "command": "node",
      "args": ["backend/dist/mcp-server.js"],
      "env": { "BACKEND_URL": "http://localhost:3001" }
    }
  }
}
```

## Smart Contracts

**TreasuryVault.sol** — Multi-sig vault with yield
- ReentrancyGuard + AccessControl + Pausable
- 1h timelock on all withdrawals
- 2-of-N multi-sig for amounts >= 1000 USDt (6 decimals)
- Daily volume cap: 10,000 USDt
- Protocol allowlist for yield investments

**CreditLine.sol** — On-chain credit scoring
- Score formula: `500 + min(txCount*2, 200) + min(volume/100, 150) + repaidLoans*100 + min(age/10, 50) - defaults*200`
- 3 tiers: Excellent (800+, 5k, 5%), Good (600+, 2k, 10%), Poor (<600, 500, 15%)
- Interest: `(principal * rate * time) / (365 days * 10000)`
- 30-day loan terms, automatic default detection
- Penalty interest tiers: +5% (1-7d overdue), +10% (8-14d), +15% (15+d)
- Credit freeze: defaulted borrowers blocked from new loans until resolved

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + agent status + persistence engine |
| `/api/db/stats` | GET | SQLite database statistics (table row counts) |
| `/api/dashboard` | GET | Full dashboard data (treasury, loans, decisions, dialogues) |
| `/api/treasury` | GET | Treasury state |
| `/api/treasury/sync` | POST | Force on-chain sync |
| `/api/treasury/withdrawal/propose` | POST | Propose USDt withdrawal |
| `/api/credit/:address` | GET | Credit profile |
| `/api/credit/:address/evaluate` | POST | Evaluate/update credit score |
| `/api/credit/:address/borrow` | POST | Borrow USDt |
| `/api/credit/:address/repay` | POST | Repay a loan |
| `/api/credit/:address/loans` | GET | User loans |
| `/api/loans` | GET | All active loans |
| `/api/decisions` | GET | Agent decision log with reasoning |
| `/api/yield/opportunities` | GET | Current yield opportunities |
| `/api/yield/invest` | POST | Invest in yield protocol |
| `/api/emergency/pause` | POST | Emergency stop |
| `/api/credit/:address/default-prediction` | GET | ML default probability for a borrower |
| `/api/credit/:address/zk-proof` | POST | Generate ZK proof that score meets tier |
| `/api/credit/verify-proof` | POST | Verify a ZK credit proof |
| `/api/inter-agent/lending` | GET | Inter-agent lending status + loans |
| `/api/inter-agent/request-capital` | POST | Credit Agent requests capital from Treasury |
| `/api/inter-agent/harvest` | POST | Trigger yield harvest → auto debt service |
| `/api/revenue/summary` | GET | Revenue tracking summary (all agents) |
| `/api/revenue/:agent/profile` | GET | Revenue profile for a specific agent |
| `/api/revenue/:agent/simulate` | POST | Simulate revenue events (demo) |
| `/api/revenue/:agent/borrow` | POST | Borrow against projected revenue |
| `/api/restructuring/proposals` | GET | Debt restructuring proposals |
| `/api/restructuring/:id/accept` | POST | Accept a restructuring proposal |
| `/ws` | WS | Real-time events (decisions, dialogues, alerts) |

## Testing

```bash
# Smart contract tests (Foundry)
npm run contracts:test

# Backend typecheck
cd backend && npm run typecheck

# Frontend build check
cd frontend && npm run build
```

## Security

- WDK wallet uses a server-side seed phrase (`WDK_SEED_PHRASE` in `.env`) — the server holds custody
- ethers.js fallback uses `DEPLOYER_PRIVATE_KEY` — keep `.env` secure and out of version control
- All vault writes go through timelock + multi-sig
- ReentrancyGuard on every `external` function
- Daily volume + single-tx caps
- Emergency pause via GUARDIAN_ROLE
- OpenClaw SOUL.md constrains agent behavior (safety-first, conservative risk, on-chain verification)

## LLM Failover

The `LLMClient` wrapper provides automatic failover between LLM providers:

```
Primary (Groq/LLaMA 3.3 70B) ──[429/5xx]──► Fallback (configurable)
         ▲                                            │
         └─── 60s cooldown ──────────────────────────┘
```

- Primary provider attempts first; on HTTP 429 or 5xx, falls back to secondary
- 60-second cooldown before retrying primary
- If no LLM is configured, agents use deterministic algorithmic fallbacks
- Configure via: `OPENAI_API_KEY`, `LLM_FALLBACK_API_KEY`, `LLM_FALLBACK_MODEL`, `LLM_FALLBACK_BASE_URL`
- Production example: Groq (primary) + any OpenAI-compatible fallback (e.g. OpenRouter, OpenAI, etc.)

## Inter-Agent Dialogue (Board Meetings)

Every 45 seconds, both agents participate in an LLM-driven debate on rotating topics:

1. **Capital Allocation** — How to split between yield, lending reserves, and liquid buffer
2. **Risk Review** — Current exposure, default risk, market conditions
3. **Yield vs Lending Trade-offs** — Where to allocate marginal capital
4. **Emergency Preparedness** — Pause triggers, recovery playbook
5. **Portfolio Health** — Overall position assessment

Each round: 4 LLM turns (2 per agent) → synthesized consensus → broadcast to dashboard via WebSocket.

## Bonus Features

### Inter-Agent Lending
Credit Agent can request capital from Treasury Agent when the lending pool is low. The Treasury evaluates and allocates up to 20% of its current balance per request. Communication happens via EventBus events (`credit:capital_request` → `treasury:capital_allocated` / `treasury:capital_declined`). All inter-agent loans are tracked with status (pending/allocated/repaid/declined).

**API**: `GET /api/inter-agent/lending` (status) · `POST /api/inter-agent/request-capital` (trigger request)

### ML Default Prediction
A logistic regression model predicts the probability of loan default before each borrow request. Features extracted from on-chain credit history: transaction count, volume, repayment rate, account age, credit score, utilization rate, and past default history. The model outputs a probability (0–100%), confidence score, risk bucket (low/medium/high/critical), and per-feature importance ranking.

**Integration**: If ML predicts "critical" risk (>60% default probability), the loan is auto-blocked before reaching the LLM. Otherwise, the ML prediction is included in the LLM prompt so it can factor probability into term negotiation.

**API**: `GET /api/credit/:address/default-prediction`

### ZK Credit Proofs
Borrowers can prove their credit score meets a minimum tier threshold (e.g., "Excellent ≥ 800") without revealing the exact score. Uses:
- **Commitment**: `SHA-256(score || nonce)` — hides the exact score
- **Range proof**: Bit-decomposition of `(score - threshold)` with per-bit commitments
- **Fiat-Shamir heuristic**: Deterministic challenge derived from all commitments (non-interactive)

The verifier confirms the proof is structurally valid, the tier threshold is recognized, and the Fiat-Shamir challenge is consistent — without learning the borrower's exact credit score.

**Replay prevention**: Each proof gets a unique `proofId` (128-bit random). Used proofs are stored in SQLite (`zk_proof_log` table). Attempting to verify the same proof twice returns `"Proof already used — replay detected"`. Expired proofs are cleaned up probabilistically.

**API**: `POST /api/credit/:address/zk-proof` (generate) · `POST /api/credit/verify-proof` (verify)

### Revenue-Backed Lending (Innovation)
AI agents can borrow against their projected future earnings — similar to invoice factoring in TradFi ($3.5T market) but for the AI agent economy. Nobody in DeFi or the AI agent ecosystem does this today.

The `RevenueTracker` service monitors agent revenue streams (task completions, yield harvests, inter-agent payments, service fees) and computes:
- **Rolling revenue**: 24h / 7d / 30d windows
- **Revenue velocity**: trend indicator (-1 to +1) showing acceleration or deceleration
- **Revenue consistency**: how regular the income stream is (0–1)
- **Borrow capacity**: 50% of projected 30d revenue (conservative)

Revenue-backed loans get favorable terms: 3% rate (vs standard 5-15%), 60-day duration. Minimum 3 revenue events + consistency > 0.1 required.

**API**: `GET /api/revenue/summary` · `GET /api/revenue/:agent/profile` · `POST /api/revenue/:agent/borrow`

### Autonomous Debt Restructuring (Innovation)
When a loan is at risk of default, the system autonomously restructures it — no human intervention needed. This is the first implementation of autonomous debt restructuring in the AI agent economy.

Flow: `CreditAgent monitor loop` → `DefaultPredictor` flags >50% default probability → `DebtRestructuring` uses LLM to negotiate new terms → auto-accept → apply to loan.

Restructuring options (LLM-negotiated):
- **Extend duration**: 7–90 additional days
- **Reduce interest rate**: minimum 100bps
- **Partial forgiveness**: up to 20% of principal
- **Split into tranches**: 1–4 payment tranches

Key principle: Getting 80% back through restructuring is better than getting 0% from a default.

**API**: `GET /api/restructuring/proposals` · `POST /api/restructuring/:id/accept`

### Idle Capital Detection & Proactive Lending
The Credit Agent reads the vault's USDt balance on-chain every monitoring cycle (120s) and detects idle capital — funds sitting in the treasury that could be earning interest through loans.

| Idle Capital | Behavior | Min Score | Max Proactive Loans/Cycle |
| --- | --- | --- | --- |
| < 500 USDt | Standard mode | 700 | 1 |
| 500–2000 USDt | Proactive mode | 650 | 1 |
| > 2000 USDt | Aggressive mode | 600 | 3 |

This is the core "agent decides without human prompts" feature: `idle capital → search borrowers → evaluate risk → lend`.

### Penalty Interest & Credit Freeze
Overdue loans accrue tiered penalty interest on top of the base rate:

| Days Overdue | Penalty Rate | Score Impact |
| --- | --- | --- |
| 1–7 | +5% annualized | -10/day (max -70) |
| 8–14 | +10% annualized | -10/day (max -140) |
| 15+ (grace expires) | **Default** | -200, credit frozen |

After a loan defaults, the borrower's credit is **frozen** — `available = 0`, no new loans possible until the default is resolved. This protects the treasury from repeat offenders.

## Design Decisions

### Why Two Agents Instead of One?
Separation of concerns: the Treasury Agent optimizes yield without worrying about credit risk, while the Credit Agent focuses on scoring without yield pressure. Board Meetings create productive tension — the Treasury Agent might want to lock more capital in Aave, but the Credit Agent argues for lending reserves. This debate (powered by LLM) produces better allocation than a single-agent approach.

### Why On-Chain Credit Scoring?
The credit formula (`500 + min(txCount*2, 200) + min(volume/100, 150) + repaidLoans*100 + min(age/10, 50) - defaults*200`) uses only publicly verifiable on-chain data. No off-chain oracles or trusted third parties. The score determines loan tier, amount cap, and interest rate autonomously.

### Why WDK + ethers.js Dual Approach?
WDK is the **primary signer** for all write transactions — both Treasury and Credit operations go through WDK first (see `TransactionService.ts`). ethers.js is the **fallback signer** and handles read-only contract queries. The WDK address (`0xf39Fd...`) has `AGENT_ROLE` on both contracts (granted on-chain). This gives us native WDK wallet ops for the hackathon while keeping ethers.js as safety net.

### Why EventBus Instead of Direct Calls?
Agents communicate through a pub/sub EventBus rather than direct method calls. This decouples them, enables WebSocket clients to observe all activity, and makes adding new subscribers (analytics, audit log, etc.) trivial.

## Known Limitations

- **Aave yield may fail on local Anvil fork** — `TreasuryVault: protocol not allowed` if Aave protocol address isn't allowlisted on-chain. Works correctly on Arbitrum One with proper setup.
- **Dual persistence (JSON + SQLite)** — Agent state is persisted to both `backend/data/*.json` (backward compat) and `backend/data/agent-treasury.db` (SQLite WAL mode). SQLite provides ACID transactions, crash safety, and query capability. Check `GET /api/db/stats` for live table counts.
- **Single-node deployment** — Not designed for horizontal scaling. One backend instance manages both agents.
- **WDK address differs from deployer** — WDK derives `0xf39Fd...` while deployer is `0xE9a30...`. Both have `AGENT_ROLE` on-chain. WDK is primary signer, ethers is fallback.
- **Deployed on Arbitrum One mainnet** — Production deployment with real USDt (16 USDt in vault).
- **ZK proofs are hash-based** — Uses SHA-256 commitments + Fiat-Shamir, not zk-SNARKs. The verifier learns `delta = score - threshold` (bounding the score range). Full privacy would require Circom + snarkjs. Replay prevention is enforced via SQLite proof log.
- **Groq rate limits** — Free tier has 100K tokens/day. Agents auto-fallback to deterministic logic on 429 errors.

## License

MIT
