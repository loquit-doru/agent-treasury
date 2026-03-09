# AgentTreasury CORE — Demo Video Script
## Tether Hackathon Galáctica: WDK Edition 1 | Lending Bot Track

---

### 🎬 INTRO (0:00 – 0:25)

**[Screen: Title card or dashboard splash]**

> **AgentTreasury CORE** — Autonomous CFO for DAOs.
>
> Two AI agents manage a DAO treasury: one optimizes yield,
> the other scores borrowers and lends USDt — all on-chain,
> all autonomous, no human prompts needed.
>
> Built with **WDK**, **OpenClaw**, **Solidity**, and **Groq LLM**.

---

### 🏗️ ARCHITECTURE (0:25 – 0:45)

**[Screen: README diagram or whiteboard sketch]**

> The system has two agents:
>
> **Treasury Agent** — manages 50,000 USDt in a smart contract vault on Sepolia.
> It scans DeFi protocols like Aave and Compound, picks the best yield,
> and invests idle capital automatically.
>
> **Credit Agent** — scores borrowers using 7 on-chain factors,
> assigns risk tiers, and disburses undercollateralized loans.
> An ML model blocks high-risk borrowers before the LLM even sees them.
>
> They communicate via an EventBus, hold Board Meetings to debate strategy,
> and large transactions require Telegram human-in-the-loop approval.

---

### 📊 STEP 1 — SYSTEM HEALTH (0:45 – 0:55)

**[Screen: Terminal → `/health` response]**

> Both agents are live and connected to the Sepolia testnet.
> Treasury: active. Credit: active. System healthy.

---

### 💰 STEP 2 — TREASURY STATE (0:55 – 1:10)

**[Screen: Terminal → `/api/treasury` response]**

> The vault holds **50,000 USDt** — real tokens on Sepolia.
> You can see two active yield positions:
> **Aave V3** at 4.2% APY and **Compound V3** at 3.8% APY,
> both generating revenue automatically.

---

### 🖥️ STEP 3 — LIVE DASHBOARD (1:10 – 1:25)

**[Screen: Browser → agent-treasury.pages.dev]**

> The React dashboard shows everything in real-time via WebSocket:
> vault balance, active loans, agent decisions, and yield positions.
> This is the Agent Activity Timeline — every decision both agents
> made, with full LLM reasoning visible.

---

### 📈 STEP 4 — CREDIT SCORING (1:25 – 1:45)

**[Screen: Terminal → `/api/credit/:address/evaluate`]**

> When we evaluate a borrower, the Credit Agent analyzes their
> on-chain history: transaction count, volume, repayment rate,
> account age, and default history.
>
> This borrower gets a score of **750** — that's a "Good" tier,
> which means 10% APR and a 2,000 USDt credit limit.
> The agent decided this autonomously — no human prompt.

---

### 🤖 STEP 5 — ML DEFAULT PREDICTION (1:45 – 2:00)

**[Screen: Terminal → `/api/credit/:address/default-prediction`]**

> Before any loan is approved, a logistic regression model
> predicts the probability of default using 7 features.
> This borrower has only **1.4% default risk** — classified as "low".
>
> If risk exceeds 60%, the loan is auto-blocked
> before the LLM even evaluates it. Safety first.

---

### 🔐 STEP 6 — ZK CREDIT PROOFS (2:00 – 2:15)

**[Screen: Terminal → `/api/credit/:address/zk-proof`]**

> Borrowers can prove their credit tier without revealing their exact score.
> This is a zero-knowledge range proof using SHA-256 commitments
> and the Fiat-Shamir heuristic.
>
> The verifier learns only that the score qualifies for "Good" tier —
> nothing more. Privacy-preserving credit.

---

### 💸 STEP 7 — AUTONOMOUS LENDING (2:15 – 2:30)

**[Screen: Terminal → `/api/credit/:address/borrow`]**

> Now the borrower requests 1,000 USDt.
> The Credit Agent evaluates the score, assigns a tier,
> sets the interest rate, and disburses the loan —
> all autonomously, settled on-chain with USDt.
>
> 30-day terms, automatic default detection if not repaid.

---

### 🤝 STEP 8 — INTER-AGENT LENDING (2:30 – 2:45)

**[Screen: Terminal → `/api/inter-agent/request-capital`]**

> Here's where it gets interesting. The Credit Agent can borrow
> capital from the Treasury Agent to expand its lending pool.
>
> This happens via EventBus — fully decoupled.
> Treasury evaluates the request, caps it at 20% of vault balance,
> and allocates the funds. Two agents, one financial system.

---

### 🔄 STEP 9 — YIELD → AUTO DEBT REPAYMENT (2:45 – 3:00)

**[Screen: Terminal → `/api/inter-agent/harvest`]**

> Revenue from yield investments automatically repays inter-agent debt.
> Treasury harvests accrued yield from Aave and Compound,
> then services outstanding loans — oldest first.
>
> The 500K inter-agent loan is now fully repaid from earned revenue.
> **Agents use earned revenue to service debt** — that's Bonus #9.

---

### 🎯 CLOSING (3:00 – 3:20)

**[Screen: Terminal → final summary card]**

> AgentTreasury CORE hits **all 11 out of 11** Lending Bot requirements:
>
> ✅ 3 must-haves — autonomous lending, on-chain USDt, auto-repayment
> ✅ 4 nice-to-haves — credit scoring, LLM negotiation, yield reallocation, minimal collateral
> ✅ 4 bonuses — inter-agent lending, ML prediction, ZK proofs, debt servicing from yield
>
> Plus: Board Meetings where agents debate strategy,
> Telegram alerts with human-in-the-loop approval,
> and emergency pause for safety.
>
> All live on Sepolia. All open-source.
> **AgentTreasury CORE** — autonomous finance, done right.

---

## ℹ️ Key Facts (for description / submission form)

- **Repo**: github.com/loquit-doru/agent-treasury
- **Live Dashboard**: agent-treasury.pages.dev
- **Live API**: treasury.proceedgate.dev
- **Stack**: WDK + OpenClaw + Solidity 0.8.20 + Foundry + Groq (LLaMA 3.3 70B) + React + Tailwind + WebSocket
- **Contracts (Sepolia)**:
  - TreasuryVault: `0x4f3afE989B6911Ea5E6a324E834d0b39A0C894Fc`
  - CreditLine: `0x4B386c556F664d8823887a7ea0a8284D498E76b9`
  - MockUSDt: `0xddedeaDa24e18D41f9EbFfD306A2972385dF6A77`
- **Track**: Lending Bot (11/11 requirements)
- **Agents**: Treasury Agent (yield, risk, pause) + Credit Agent (scoring, lending, repayment)
- **Bonuses**: Inter-agent lending, ML default prediction, ZK credit proofs, yield-based debt servicing
