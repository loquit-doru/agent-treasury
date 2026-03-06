# 🏦 AgentTreasury CORE

**Autonomous CFO for DAOs** - A multi-agent system for treasury management, yield generation, and on-chain credit scoring.

Built for **Tether Hackathon Galactica: WDK Edition 1** (February 2026)

## 🎯 Overview

AgentTreasury CORE is an autonomous treasury management system that:

- **Manages DAO funds** with security-first design (multi-sig, timelock, daily limits)
- **Generates yield** through DeFi protocols (Aave/Compound)
- **Provides on-chain credit** with AI-powered scoring
- **Operates 24/7** with autonomous agents making data-driven decisions

## 🏗️ Architecture

```
agenttreasury-core/
├── contracts/              # Solidity smart contracts
│   ├── TreasuryVault.sol   # Multi-sig treasury with yield
│   └── CreditLine.sol      # On-chain credit scoring
├── backend/                # Node.js + Express
│   ├── src/agents/
│   │   ├── TreasuryAgent.ts   # Yield optimization, security
│   │   └── CreditAgent.ts     # Credit scoring, lending
│   ├── orchestrator/
│   │   └── EventBus.ts        # Agent communication
│   └── index.ts            # API server + WebSocket
└── frontend/               # React + TypeScript
    └── src/components/     # Dashboard UI
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Ethereum wallet with Sepolia ETH
- OpenAI API key

### 1. Clone & Install

```bash
git clone <repo-url>
cd agenttreasury-core

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup

```bash
# Backend .env
cp backend/.env.example backend/.env

# Edit backend/.env with your values:
OPENAI_API_KEY=your_openai_key
AGENT_PRIVATE_KEY=your_wallet_private_key
RPC_URL=https://rpc.sepolia.org
CHAIN_ID=11155111
USDT_ADDRESS=0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
TREASURY_VAULT_ADDRESS=<deployed_address>
CREDIT_LINE_ADDRESS=<deployed_address>
```

### 3. Deploy Contracts

```bash
cd contracts
# Install Foundry or Hardhat
# Deploy contracts to Sepolia
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### 4. Start Backend

```bash
cd backend
npm run dev
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## 📊 Features

### TreasuryAgent

- ✅ Self-custodial wallet via WDK
- ✅ Real-time USDt balance monitoring
- ✅ Deposit/withdraw with security validations
- ✅ Yield farming on Aave/Compound
- ✅ Emergency stop mechanism
- ✅ Daily limits (10,000 USDt)
- ✅ Multi-sig simulation (2-of-3 for large amounts)

### CreditAgent

- ✅ On-chain credit scoring (0-1000)
- ✅ LLM-enhanced risk analysis
- ✅ Automatic tier assignment
  - Excellent (800+): $5,000 at 5% APR
  - Good (600-799): $2,000 at 10% APR
  - Poor (<600): $500 at 15% APR
- ✅ Loan lifecycle management
- ✅ Default detection

### Smart Contracts

**TreasuryVault.sol**
- ReentrancyGuard + AccessControl
- Propose/Execute pattern with 1h timelock
- Daily volume tracking
- Pause mechanism
- Protocol allowlist

**CreditLine.sol**
- On-chain credit profiles
- Interest calculation: `(principal * rate * time) / (365 days * 10000)`
- Loan tracking and defaults

### Frontend Dashboard

- ✅ Real-time USDt balance (5s refresh)
- ✅ Credit score with progress bar
- ✅ Borrow/Repay buttons (functional)
- ✅ Active loans list
- ✅ Live agent decision logs
- ✅ Agent status indicator

## 🔧 Configuration

### Security Constraints

```javascript
const CONSTRAINTS = {
  MAX_DAILY_VOLUME: 10000 * 10**6,  // 10k USDt
  MAX_SINGLE_TX: 1000 * 10**6,      // 1k USDt
  ALLOWED_PROTOCOLS: ['aave', 'compound'],
  EMERGENCY_PAUSE: true,
  MULTISIG_THRESHOLD: 1000 * 10**6  // >1k needs 2 signatures
};
```

### Credit Scoring Algorithm

```typescript
function calculateScore(history: CreditHistory): number {
  let score = 500; // Base
  
  // Positive factors
  score += Math.min(history.transactionCount * 2, 200);
  score += Math.min(history.volumeUSD / 100, 150);
  score += history.repaidLoans * 100;
  score += Math.min(history.accountAge / 10, 50);
  
  // Negative factors
  score -= history.defaults * 200;
  
  return Math.min(Math.max(score, 0), 1000);
}
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Contract tests
cd contracts
forge test

# Frontend tests
cd frontend
npm test
```

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/dashboard` | GET | Full dashboard data |
| `/api/treasury` | GET | Treasury state |
| `/api/treasury/sync` | POST | Sync treasury state |
| `/api/credit/:address` | GET | Credit profile |
| `/api/credit/:address/evaluate` | POST | Evaluate credit |
| `/api/loans` | GET | All active loans |
| `/ws` | WS | WebSocket for real-time updates |

## 🔐 Security

- **ReentrancyGuard** on all external functions
- **AccessControl** for role-based permissions
- **Timelock** on large withdrawals (1 hour)
- **Multi-sig** for transactions > $1,000
- **Daily limits** to prevent draining
- **Emergency pause** for crisis response
- **Protocol allowlist** for yield farming

## 📈 Performance

- Balance updates: Every 5 seconds
- Agent decisions: Logged in real-time
- WebSocket: Sub-100ms latency
- API response: < 500ms

## 🎥 Demo

[Link to demo video]

## 📝 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- Tether for WDK and hackathon opportunity
- OpenAI for GPT-4 API
- Aave/Compound for yield protocols
- OpenZeppelin for secure contract libraries

---

**Built with ❤️ for Tether Hackathon 2026**
