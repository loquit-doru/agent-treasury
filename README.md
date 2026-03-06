# AgentTreasury CORE

**Autonomous CFO for DAOs** — Multi-agent treasury management with on-chain credit scoring.

Built for **Tether Hackathon Galactica: WDK Edition 1** (March 2-22, 2026)

## Overview

AgentTreasury CORE is a 2-agent autonomous system that manages DAO funds:

- **Treasury Agent** — yield optimization (Aave via WDK), multi-sig withdrawal proposals, emergency pause, daily volume limits
- **Credit Agent** — on-chain credit scoring (500-1000), 3-tier lending (5%/10%/15% APR), default detection

Both agents use **Tether WDK** for self-custodial wallet management and **OpenClaw** agent workspace for behavioral governance.

### Key integrations

| Technology | Role |
|-----------|------|
| **WDK** (`@tetherto/wdk`) | Self-custodial wallet, Aave lending protocol |
| **OpenClaw** | Agent identity (SOUL.md), skills, tool definitions |
| **Foundry** | Smart contract testing & deployment |
| **OpenAI GPT-4** | Agent reasoning for yield/credit decisions |
| **Ethers.js v6** | Read-only contract interactions |

## Architecture

```
agent-treasury/
├── agents/                     # OpenClaw agent workspace
│   ├── AGENTS.md               # Agent roster & communication rules
│   ├── SOUL.md                 # Behavioral identity & constraints
│   ├── TOOLS.md                # Available MCP tools
│   ├── treasury/SKILL.md       # Treasury agent skill
│   └── credit/SKILL.md         # Credit agent skill
├── contracts/                  # Solidity 0.8.20 (Foundry)
│   ├── TreasuryVault.sol       # Multi-sig vault + yield
│   ├── CreditLine.sol          # Credit scoring + lending
│   ├── test/                   # Forge tests
│   └── script/Deploy.s.sol     # Deployment script
├── backend/                    # Node.js + Express + WS
│   └── src/
│       ├── agents/             # TreasuryAgent, CreditAgent
│       ├── services/wdk.ts     # WDK initialization service
│       ├── orchestrator/       # EventBus pub/sub
│       └── index.ts            # API + WebSocket server
├── frontend/                   # React 18 + Vite + Tailwind
│   └── src/
│       ├── App.tsx             # Main dashboard
│       ├── components/         # AgentStatus, LiveLogs, WalletConnect
│       ├── hooks/              # useDashboard, useWebSocket
│       └── types/              # Shared types
├── foundry.toml                # Forge configuration
└── package.json                # Root scripts
```

## Quick Start

### Prerequisites

- Node.js 22+
- Foundry (forge, anvil)
- OpenAI API key (optional — works without it via algorithmic fallback)

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
cd backend && npx ts-node src/index.ts

# 5. Test
curl http://localhost:3001/health
curl http://localhost:3001/api/dashboard
curl -X POST http://localhost:3001/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/evaluate
```

Or run the automated demo script (Windows):
```powershell
$env:OPENAI_API_KEY = "sk-..."   # optional
.\scripts\demo-local.ps1
```

### Full Setup (Sepolia)

#### Prerequisites (additional)
- WDK seed phrase (12/24-word mnemonic)
- Sepolia ETH for gas
- Sepolia RPC URL (Alchemy/Infura)

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
OPENAI_API_KEY=sk-...
WDK_SEED_PHRASE="your twelve word mnemonic phrase goes here ..."
RPC_URL=https://rpc.sepolia.org
CHAIN_ID=11155111
USDT_ADDRESS=0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
AAVE_POOL_ADDRESS=0x6Ae43d3271ff6888e7Fc43Fd7321a503104E31D7
TREASURY_VAULT_ADDRESS=<deployed>
CREDIT_LINE_ADDRESS=<deployed>
```

### 3. Deploy Contracts

```bash
npm run contracts:test           # Run Forge tests first
npm run contracts:deploy         # Deploy to Sepolia
```

### 4. Run

```bash
# Terminal 1 — Backend (port 3001)
npm run dev:backend

# Terminal 2 — Frontend (port 3000)
npm run dev:frontend
```

Visit `http://localhost:3000` for the dashboard.

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
| `/api/dashboard` | GET | Full dashboard data |
| `/api/treasury` | GET | Treasury state |
| `/api/treasury/sync` | POST | Force treasury sync |
| `/api/credit/:address` | GET | Credit profile |
| `/api/credit/:address/evaluate` | POST | Evaluate/update credit |
| `/api/credit/:address/loans` | GET | User loans |
| `/api/loans` | GET | All active loans |
| `/api/decisions` | GET | Agent decision log |
| `/api/yield/opportunities` | GET | Current yield opportunities |
| `/api/emergency/pause` | POST | Emergency stop |
| `/ws` | WS | Real-time events |

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

## License

MIT
