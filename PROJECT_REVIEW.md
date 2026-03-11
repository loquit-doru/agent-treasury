# AgentTreasury CORE — Project Overview (AI Review Document)

> **Purpose**: This document describes the complete project for external AI review.
> Please analyze the architecture, implementation quality, and suggest improvements
> before we record the hackathon demo video.

---

## What Is This?

**AgentTreasury CORE** is an autonomous DAO CFO system: two AI agents that cooperate
to manage a treasury, optimize yield, score borrowers, and lend USDt — all on-chain, 
all without human intervention.

Built for the **Tether Hackathon Galáctica: WDK Edition 1** → **Lending Bot Track**.

**Claim**: 11 out of 11 Lending Bot requirements implemented.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.20, Foundry, deployed on Arbitrum One |
| Backend | Node.js, Express, TypeScript, ethers.js |
| AI/LLM | Groq (LLaMA 3.3 70B) via OpenAI-compatible API |
| Wallet | WDK (`@tetherto/wdk-wallet-evm` v1.0.0-beta.8, `@tetherto/wdk-protocol-lending-aave-evm` v1.0.0-beta.3) — self-custodial, BIP-39 seed phrase |
| Frontend | React 18, Vite, Tailwind CSS, WebSocket |
| MCP | OpenClaw MCP server with 15 tools (stdio transport) |
| Token | USDt (native Tether on Arbitrum One, 6 decimals) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Dashboard (port 5173)                  │
│   Real-time via WebSocket — balance, loans, agent decisions      │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP + WS
┌────────────────────────▼────────────────────────────────────────┐
│                  Express Backend (port 3001)                     │
│                                                                  │
│  ┌──────────────────┐   EventBus    ┌──────────────────┐        │
│  │  Treasury Agent   │◄────────────►│   Credit Agent    │        │
│  │  • Yield mgmt     │  (decoupled) │  • Credit scoring │        │
│  │  • Risk assess    │              │  • Loan approval  │        │
│  │  • Capital alloc  │              │  • ML prediction  │        │
│  │  • Emergency pause│              │  • ZK proofs      │        │
│  └────────┬──────────┘              └────────┬──────────┘        │
│           │          Board Meetings           │                  │
│           │      (every 45s, 5 topics)        │                  │
│           │       LLM-driven dialogue         │                  │
│           │                                   │                  │
│  ┌────────▼───────────────────────────────────▼──────────┐      │
│  │              Inter-Agent Lending Service                │      │
│  │  Credit borrows from Treasury (max 20% of vault)       │      │
│  │  Yield revenue auto-repays inter-agent debt            │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  ML Default Predictor │ ZK Credit Proof │ LLM Client │ MCP (15) │
└────────────────────────┬────────────────────────────────────────┘
                         │ ethers.js + WDK
┌────────────────────────▼────────────────────────────────────────┐
│                    Arbitrum One                                    │
│   TreasuryVault (timelock + multi-sig + daily limits)            │
│   CreditLine (3-tier: Excellent/Good/Poor, auto-default 30d)    │
│   USDt (native Tether, 6 decimals)                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts (Deployed on Arbitrum One)

### TreasuryVault (`0xCD24C4F53227623dFf2486B9E064aCa02e3064e5`)
- Holds 50,000 USDt
- **1-hour timelock** on withdrawals
- **Daily volume limit**: 10,000 USDt/day
- **Single tx limit**: 1,000 USDt
- **Multi-sig**: >1,000 USDt requires 2 signatures
- Roles: AGENT_ROLE, GUARDIAN_ROLE, EXECUTOR_ROLE
- Key functions: `deposit()`, `proposeWithdrawal()`, `signTransaction()`, `executeWithdrawal()`, `investInYield()`, `harvestYield()`

### CreditLine (`0x183A70Ec460A61427Bb17BB5cc20715bAd595507`)
- 3-tier credit system:
  - **Excellent** (≥800): 5,000 USDt limit, 5% APR
  - **Good** (600–799): 2,000 USDt limit, 10% APR
  - **Poor** (0–599): 500 USDt limit, 15% APR
- On-chain loan storage with default tracking (auto-default after 30 days)
- Key functions: `updateProfile()`, `borrowFor()`, `repay()`, `markDefaulted()`, `calculateInterest()`, `getActiveLoans()`

### USDt (`0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`)
- Native Tether on Arbitrum One with 6 decimals

---

## The Two Agents

### Treasury Agent
**Role**: Yield optimization, risk management, capital allocation, emergency pause.

**Monitoring loop** (every 30 seconds):
1. Sync state from chain (real balance read)
2. Evaluate yield opportunities via LLM
3. Check pending transactions
4. Risk assessment
5. Every 10 cycles (~5 min): Harvest yield + auto-repay inter-agent debt

**Yield positions** (seeded for deterministic demo reproducibility; agent logic is fully functional):
- Aave V3: 5,000 USDt @ 4.2% APY
- Compound V3: 3,000 USDt @ 3.8% APY
- Accrual formula: `elapsed_years × APY% × principal` (linear, not real DeFi returns)
- In production, these would be populated from real Aave/Compound contract interactions.

**LLM personality**: Conservative, data-driven, capital preservation first.

### Credit Agent
**Role**: Borrower evaluation, credit scoring, loan approval, portfolio monitoring.

**Monitoring loop** (every 60 seconds):
- Portfolio scan + overdue detection

**Credit Scoring Formula** (deterministic base + LLM enhancement):
```
Base = 500
+ min(txCount × 2, 200)       // Transaction history
+ min(volumeUSD / 100, 150)   // On-chain volume
+ repaidLoans × 100           // Repayment history
+ min(accountAge / 10, 50)    // Account age
- defaults × 200              // Default penalties
```

**On-chain data used**:
- `provider.getTransactionCount(address)` — real
- ETH balance × 2500 — volume estimate (proxy)
- Account age estimated from tx count (simplified for scoring)

**LLM personality**: Fair but cautious, treasury capital preservation priority.

---

## Bonus Features (4/4 implemented)

### 1. ML Default Prediction
**Logistic regression** with 7 features. Weights derived from analysis of ~1,000
simulated DeFi lending outcomes calibrated against known default patterns from
Aave/Compound historical liquidation events (2022-2024):

| Feature | Weight | Direction |
|---------|--------|-----------|
| txCount (normalized) | -0.8 | More tx → safer |
| volume (normalized) | -0.6 | Higher volume → safer |
| repaymentRate | -2.5 | Better history → safer |
| accountAge (normalized) | -0.9 | Older → safer |
| creditScore (normalized) | -1.8 | Higher score → safer |
| utilizationRate | +1.4 | Higher util → riskier |
| defaultHistory | +3.2 | Past defaults → riskier |

**Safety mechanism**: P(default) > 60% → loan **auto-blocked** before LLM evaluation.

### 2. ZK-Inspired Credit Proofs
Proves "credit score ≥ tier threshold" without revealing exact score.
This is a **lightweight ZK-inspired privacy layer** using commitment schemes and range proofs:
- SHA-256 commitment to (score + nonce)
- Bit-decomposition range proof for (score - threshold)
- Fiat-Shamir heuristic for non-interactive verification
- Verifier learns only the tier (not the score)

> Production implementation would use Circom + snarkjs for full zk-SNARK verification.

### 3. Inter-Agent Lending
Credit Agent borrows capital from Treasury Agent via EventBus:
1. `credit:capital_request` → { amount, reason }
2. Treasury evaluates: max 20% of vault per request
3. `treasury:capital_allocated` → { allocated, reason }
4. Loan tracked: { id, status, amount, dates }

### 4. Yield → Auto Debt Repayment
Every 10 Treasury monitor cycles (~5 minutes):
1. Sum accrued yield across all positions
2. Emit `treasury:yield_harvested`
3. InterAgentLending auto-repays outstanding loans (oldest first)
4. Remainder available for reinvestment

---

## Board Meetings (Inter-Agent Dialogue)

Runs every **45 seconds** (5 rotating topics):
1. Capital allocation
2. Risk review
3. Yield vs lending opportunity cost
4. Emergency preparedness / stress testing
5. Portfolio health

**Flow**: Treasury state → LLM generates Treasury voice → Credit state → LLM generates Credit voice → LLM synthesizes consensus → emit event to dashboard.

All dialogue rounds visible in real-time on the React dashboard.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Agent status check |
| GET | `/api/ai-decisions` | Structured AI decision audit trail (agent, action, context, decision) |
| GET | `/api/treasury/health` | Treasury Health Score (0-100) with component breakdown |
| POST | `/api/stress-test` | Simulate adverse scenarios (market_crash, bank_run, yield_collapse) |
| GET | `/api/dashboard` | Complete system state (real data) |
| GET | `/api/treasury` | Balance, volume, pending txs, yield |
| POST | `/api/treasury/withdrawal/propose` | Propose withdrawal (1h timelock) |
| POST | `/api/yield/invest` | Invest in yield protocol |
| GET | `/api/yield/opportunities` | Scan yield opportunities |
| POST | `/api/credit/:addr/evaluate` | Score borrower (on-chain + LLM) |
| POST | `/api/credit/:addr/borrow` | Request loan (auto-evaluated) |
| POST | `/api/credit/:addr/repay` | Repay loan |
| GET | `/api/credit/:addr/default-prediction` | ML default probability |
| POST | `/api/credit/:addr/zk-proof` | Generate ZK credit tier proof |
| POST | `/api/inter-agent/request-capital` | Credit borrows from Treasury |
| POST | `/api/inter-agent/harvest` | Harvest yield + auto-repay debt |

---

## MCP Server (OpenClaw)

15 tools exposed via stdio transport for external AI agent integration:
- Treasury operations (balance, withdraw, invest, harvest)
- Credit operations (score, borrow, repay, profile)
- Analytics (portfolio, risk, yield)
- Bonus features (ZK proof, ML prediction)

---

## Frontend

| Page | What It Shows |
|------|--------------|
| Dashboard | Agent activity timeline, balance chart, active loans, yield positions, quick actions |
| Analytics | Portfolio health, default prediction heatmap, loan performance |
| Wallet | User credit profile, loan request form, ZK proof generation |
| Landing | Project intro + architecture diagram |

**Real-time**: WebSocket pushes EventBus events to React (agent decisions appear instantly).

---

## What's Real vs Simulated

### Fully Real (On-Chain)
- Contract balance reads (ethers.js)
- Credit profile persistence (on-chain struct)
- Loan storage + repayment tracking
- Multi-sig + timelock logic
- WDK self-custodial wallet operations
- Default detection (auto-marked after 30 days)
- Daily volume tracking on-chain
- Transaction count for credit scoring

### Seeded (Deterministic for Reproducible Demo)
- Yield positions (2 positions at startup; agent decision logic is fully functional, only data source is seeded for testnet stability)
- 7-day balance history chart (seeded from current real state; real snapshots accumulate after startup)

### Simulated (LLM Context Only)
- Market condition scenarios (gas spikes, de-peg) — used only to vary agent reasoning
- Yield opportunity evaluation — LLM recommends protocol based on simulated context
- Aave on-chain integration often not active (AAVE_POOL_ADDRESS dependency)

---

## Hackathon Requirements Checklist

### Must-Haves (3/3)
| # | Requirement | Implementation |
|---|-------------|---------------|
| 1 | Autonomous lending decisions | Credit Agent evaluates + LLM decides, no human prompt |
| 2 | On-chain USDt settlement | CreditLine.borrowFor() settles on Arbitrum One with native USDt |
| 3 | Auto repayment tracking | 60s monitoring loop, auto-markDefaulted after 30 days |

### Nice-to-Haves (4/4)
| # | Requirement | Implementation |
|---|-------------|---------------|
| 4 | On-chain credit scoring | Deterministic formula + LLM enhancement + on-chain profile storage |
| 5 | LLM negotiates loan terms | Groq LLaMA 3.3 70B sets rate/limit based on scoring context |
| 6 | Yield reallocation | Treasury Agent monitors + LLM evaluates protocol APY vs risk |
| 7 | Undercollateralized lending | Tier-based (0% collateral for Excellent, 0% for all — score-gated) |

### Bonuses (4/4)
| # | Requirement | Implementation |
|---|-------------|---------------|
| 8 | Inter-agent lending | EventBus: Credit borrows from Treasury (max 20% of vault) |
| 9 | ML default prediction | Logistic regression, 7 features, auto-block above 60% |
| 10 | ZK credit proofs | SHA-256 commitment + Fiat-Shamir range proof (ZK-inspired privacy layer) |
| 11 | Yield-based debt servicing | Harvest yield → auto-repay inter-agent loans (oldest first) |

---

## Live URLs

- **GitHub**: https://github.com/loquit-doru/agent-treasury
- **Dashboard**: https://agent-treasury.pages.dev
- **API**: https://treasury.proceedgate.dev
- **Contracts on Arbiscan (Arbitrum One)**:
  - [TreasuryVault](https://arbiscan.io/address/0xCD24C4F53227623dFf2486B9E064aCa02e3064e5)
  - [CreditLine](https://arbiscan.io/address/0x183A70Ec460A61427Bb17BB5cc20715bAd595507)
  - [USDt](https://arbiscan.io/address/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9)

---

## Known Limitations (Be Honest About These)

1. **Yield accrual is deterministic for demo reproducibility** — not real Aave/Compound returns. The agent decision logic (evaluateYieldOpportunities, harvestAndServiceDebt) is fully functional. The integration layer exists (WDK Aave protocol registered) but data is seeded for testnet stability.

2. **Credit scoring volume estimate** — uses ETH balance × 2500 as a proxy for historical transaction volume.

3. **Native USDt on Arbitrum One** — real Tether, not a mock token.

4. **Chart history is seeded** — initial 7-day chart generated from current real state for deterministic demo. Real snapshots accumulate naturally after startup (every 30s sync cycle).

5. **LLM is optional** — system works without API key (deterministic scoring only), but loses the "AI negotiates terms" capability.

6. **ZK proofs are ZK-inspired** — uses SHA-256 commitment + Fiat-Shamir range proof (not Groth16/PLONK). Demonstrates the ZK concept; production would use Circom + snarkjs.

---

## Questions for the Reviewer

1. **Is the claim of 11/11 requirements credible** given the real-vs-simulated breakdown above?
2. **Are there any weak spots** a hackathon judge would likely probe?
3. **What would you emphasize** in a 3-minute demo video to maximize impact?
4. **Are there any quick improvements** (< 1 hour) that would significantly strengthen the submission?
5. **How does the ZK proof implementation hold up** — is the Fiat-Shamir + bit-decomposition approach convincing for a hackathon?
6. **Is the inter-agent communication (EventBus + Board Meetings)** a differentiator, or is it over-engineered for this track?
