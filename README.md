# AgentTreasury CORE

**Autonomous CFO for DAOs** — Two AI agents that hold, lend, and manage USDt on-chain without human intervention.

Built for **Tether Hackathon Galáctica: WDK Edition 1** (March 2–22, 2026)

> **Tracks**: 🏦 Lending Bot · 🤖 Agent Wallets · 🌊 Autonomous DeFi Agent

## What It Does

AgentTreasury is a **2-agent autonomous financial system** that manages a DAO treasury:

| Agent | Responsibilities |
|-------|-----------------|
| **Treasury Agent** | Yield optimization (Aave via WDK), withdrawal proposals, emergency pause, daily volume caps |
| **Credit Agent** | On-chain credit scoring (500–1000), 3-tier lending (5%/10%/15% APR), default detection, repayment tracking |

Both agents **hold and manage USDt autonomously**, make LLM-powered decisions, and debate strategy in periodic **Board Meetings** (inter-agent dialogue).

### Hackathon Track Alignment

#### 🏦 Lending Bot — Must Haves ✅
- ✅ Agent makes lending decisions **without human prompts** (credit scoring + LLM evaluation)
- ✅ All transactions settle **on-chain using USDt** (Arbitrum One mainnet)
- ✅ Agent **autonomously tracks and collects repayments** (30-day terms, auto-default)

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
- ✅ **ZK credit proofs** — Borrowers can prove their credit score meets a tier threshold (e.g., "≥800 = Excellent") without revealing the exact score. Uses SHA-256 commitments + Fiat-Shamir bit-decomposition range proofs. See `backend/src/services/ZKCreditProof.ts`

### Key Integrations

| Technology | Role |
|-----------|------|
| **WDK** (`@tetherto/wdk`, `wdk-wallet-evm`, `wdk-protocol-lending-aave-evm`) | Self-custodial wallet, Aave lending |
| **OpenClaw** | Agent identity (SOUL.md), skills, MCP tool definitions |
| **Foundry** | Smart contract tests (31 tests) & deployment |
| **Groq** (LLaMA 3.3 70B) | Primary LLM for agent reasoning |  
| **OpenRouter** (Gemini Flash) | Failover LLM — auto-switches on 429/5xx |
| **MCP Server** | 15 tools for external agent access (stdio transport) |
| **Ethers.js v6** | Read-only contract interactions |

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
│       │   └── ZKCreditProof.ts       # ZK range proofs for credit tier privacy
│       ├── mcp-server.ts         # MCP server (stdio, 15 tools)
│       └── index.ts              # API + WebSocket server
├── frontend/                     # React 18 + Vite + Tailwind
│   └── src/
│       ├── pages/Dashboard.tsx   # Main dashboard (timeline, agents, loans)
│       ├── components/           # AgentStatus, LiveLogs, WalletConnect
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

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + agent status |
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

- Agents use WDK self-custodial wallets — no private keys on server
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
- Production setup: Groq (primary) + OpenRouter Gemini Flash (fallback) — both free, 24/7 uptime

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

**API**: `POST /api/credit/:address/zk-proof` (generate) · `POST /api/credit/verify-proof` (verify)

## Design Decisions

### Why Two Agents Instead of One?
Separation of concerns: the Treasury Agent optimizes yield without worrying about credit risk, while the Credit Agent focuses on scoring without yield pressure. Board Meetings create productive tension — the Treasury Agent might want to lock more capital in Aave, but the Credit Agent argues for lending reserves. This debate (powered by LLM) produces better allocation than a single-agent approach.

### Why On-Chain Credit Scoring?
The credit formula (`500 + min(txCount*2, 200) + min(volume/100, 150) + repaidLoans*100 + min(age/10, 50) - defaults*200`) uses only publicly verifiable on-chain data. No off-chain oracles or trusted third parties. The score determines loan tier, amount cap, and interest rate autonomously.

### Why WDK + ethers.js Dual Approach?
WDK handles wallet management and Aave lending (via `wdk-protocol-lending-aave-evm`). ethers.js handles direct smart contract reads and custom transactions (credit scoring, loan issuance). This gives us WDK's self-custodial guarantees for wallet ops and ethers.js flexibility for custom contracts.

### Why EventBus Instead of Direct Calls?
Agents communicate through a pub/sub EventBus rather than direct method calls. This decouples them, enables the Telegram bot and WebSocket clients to observe all activity, and makes adding new subscribers (analytics, audit log, etc.) trivial.

## Known Limitations

- **Aave yield may fail on local Anvil fork** — `TreasuryVault: protocol not allowed` if Aave protocol address isn't allowlisted on-chain. Works correctly on Arbitrum One with proper setup.
- **In-memory state** — Agent decisions and dialogue rounds are stored in memory. A backend restart loses history. Persistent storage (SQLite/Postgres) is a natural next step.
- **Single-node deployment** — Not designed for horizontal scaling. One backend instance manages both agents.
- **No WDK for CreditLine contracts** — WDK handles wallet + Aave; custom smart contract interactions (CreditLine) use ethers.js directly since WDK doesn't have a lending-credit protocol module.
- **Deployed on Arbitrum One mainnet** — Production deployment with real USDt. Initial development was on Sepolia, now fully migrated to Arbitrum One.

## License

MIT
