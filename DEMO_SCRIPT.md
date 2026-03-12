# AgentTreasury CORE — Demo Video Script (v8 — concise)
## Tether Hackathon Galáctica: WDK Edition 1 | Lending Bot Track

> **Target: 3:30–4:30.** Dashboard walkthrough + live triggers + on-chain proof.
> Details in README — demo shows it working.

---

## DASHBOARD OVERVIEW (0:00 – 0:40)

### 🎬 HOOK (0:00 – 0:10)

**[Screen: Dashboard full view — agents running, events flowing]**

> *"Two AI agents. One DAO treasury. Real USDt on Arbitrum mainnet.*
> *No humans in the loop. This is AgentTreasury CORE."*

---

### 📊 KPIs + HEALTH (0:10 – 0:40)

**[Screen: Dashboard — scroll through top section slowly]**

> *"Here's the live dashboard.*
> *Top row: Treasury Balance 13 USDt liquid, Daily Volume 3 USDt,*
> *2 Yield Positions at 4% average APY, 2 Credit Profiles, 3 active loans.*
> *Health Score: 55 out of 100, rated Fair — liquidity is low,*
> *but overdue, yield, volume, and debt all at 100%.*
>
> *Below — Balance History chart updating in real time,*
> *and the Credit Score Distribution: one borrower at 624, one at 725.*
>
> *Everything goes through Tether's WDK — self-custodial wallet, primary signer on every transaction."*

---

## LIVE DEMO (0:40 – 2:30)

### 💸 LOANS (0:40 – 1:15)

**[Screen: Dashboard — Active Loans table + trigger new loan]**

> *"Active Loans table: 3 loans — two at 2 USDt with 5% rate, one at 1 USDt at 10%. Total exposure: 5 USDt.*
>
> *Let's trigger a new one.*
> *ML model scores the borrower — 7 on-chain factors. If default risk exceeds 60%, it's blocked before the LLM even runs.*
> *LLM negotiates terms, agent calls borrowForCustom on-chain — loan created, USDt disbursed.*
> *Watch the Decision Audit Trail on the right — every step with full reasoning."*
>
> *(Trigger: POST /api/credit/.../borrow → watch timeline update live)*

---

### 💰 YIELD + INTER-AGENT (1:15 – 1:50)

**[Screen: Dashboard — Yield Positions panel]**

> *"Yield Positions panel shows the agent's tracked positions — Aave V3 and Compound V3.*
> *The agent autonomously picks protocol, allocates amount, and signs through WDK.*
>
> *Inter-agent lending: Credit Agent requests funds from Treasury, capped at 20% per request.*
> *When yield is harvested, revenue auto-repays inter-agent debt — oldest first.*
> *No human in the loop."*

---

### 🤝 BOARD MEETING (1:50 – 2:20)

**[Screen: Dashboard — Agent Chat panel, Board Meeting events live]**

> *"Every 3 minutes — a Board Meeting. LLM-to-LLM debate, 5 turns.*
> *Treasury proposes, Credit pushes back, Risk weighs in.*
> *Consensus is extracted and executed automatically. Every meeting is different — not scripted.*
>
> *You can follow it live in the Agent Chat panel."*
>
> *(Hold 10-15s to show real-time debate turns appearing)*

---

### 🔗 ON-CHAIN PROOF (2:20 – 3:30)

**[Screen: Arbiscan — open each TX link from ONCHAIN_PROOF.md]**

> *"Let me show the on-chain proof. All of this is real, on Arbitrum One mainnet.*
>
> *WDK wallet: 0xcF34... — created through Tether's WDK SDK, BIP-39 seed phrase.*
> *This wallet has AGENT_ROLE and EXECUTOR_ROLE on both smart contracts.*
> *Here are the 4 role grant transactions — verified on Arbiscan."*
>
> *(Show 2 Arbiscan TX tabs: one Vault AGENT_ROLE, one Credit AGENT_ROLE)*
>
> *"And here's the end-to-end WDK proof — the wallet approved and supplied 0.5 USDt into Aave V3.*
> *Approve TX, Supply TX — both executed through WDK, zero ethers.js fallback.*
> *Before: 1 USDt. After: 0.5 liquid + 0.5 in Aave collateral.*
> *Health factor: max, no debt. All verifiable right here on Arbiscan."*
>
> *(Show approve TX → supply TX on Arbiscan)*

---

### 🏁 BONUS FEATURES + CTA (3:30 – 4:15)

**[Screen: Back to Dashboard — scroll to bonus section]**

> *"Quick bonus features.*
> *ML Default Prediction: logistic regression, 7 on-chain features, blocks high-risk borrowers before LLM evaluation.*
> *ZK Credit Proofs: borrowers prove their credit tier without revealing the exact score — SHA-256 commitments with Fiat-Shamir range proofs.*
> *Inter-agent lending: Credit borrows from Treasury, and yield revenue auto-services the debt.*
>
> *AgentTreasury CORE.*
> *Autonomous lending. ML risk gating. LLM yield strategy. ZK credit proofs.*
> *Inter-agent governance with Board Meetings. Revenue-based debt servicing.*
>
> *Built with WDK, OpenClaw, Solidity, and Groq.*
> *Every transaction on-chain. Every decision auditable. Details in the README and ONCHAIN_PROOF.md.*
> *Thank you."*

---

## 🎥 Recording Setup Guide

### Tool: OBS Studio + Live Voiceover

| Setting | Value |
|---------|-------|
| Resolution | 1920×1080 |
| FPS | 30 |
| Codec | H.264 MP4 |
| Bitrate | 8–12 Mbps |
| Voiceover | LIVE (nu TTS) |

### Strategy: Record in 3–4 Segments

| # | Segment | Duration | What's on screen |
|---|---------|----------|------------------|
| 1 | Hook + Dashboard overview | 0:00–0:40 | Dashboard top → scroll through KPIs, health, charts |
| 2 | Loans + Yield + Board Meeting | 0:40–2:20 | Dashboard live (trigger loan, show yield, wait for board meeting) |
| 3 | On-Chain Proof | 2:20–3:30 | Arbiscan tabs (role grants, approve TX, supply TX) |
| 4 | Bonus + CTA | 3:30–4:15 | Dashboard bonus section → closing |

### Browser Setup

- [x] Chrome Guest Mode sau profil curat
- [x] Bookmarks bar: HIDDEN
- [x] Zoom: **125%**
- [x] Dark mode dashboard confirmed
- [x] DevTools: CLOSED
- [x] Pre-open Arbiscan tabs: role grant TX + approve TX + supply TX (from ONCHAIN_PROOF.md)
- [x] Notifications: Do Not Disturb
- [x] 4 tabs pre-deschise: Dashboard | Arbiscan Vault | Arbiscan Credit | GitHub

### Pre-Record Checklist

- [ ] Backend running (port 3001) + cloudflared tunnel active
- [ ] OBS scenes configurate și testate
- [ ] Test recording 30s — verifică audio levels
- [ ] Dashboard pre-populat: 4-5 events, 1 loan activ, yield positions
- [ ] Board Meeting: check that one runs during recording window (every 180s)
- [ ] Arbiscan tabs pre-deschise cu contractele + AGENT_ROLE grant tx
- [ ] GitHub repo tab pre-deschis pe README

**Pre-trigger (60s înainte de record — populează dashboard):**
```bash
# Sync treasury state
curl -X POST http://localhost:3001/api/treasury/sync

# Pre-evaluate a credit profile (so data is warm)
curl -X POST http://localhost:3001/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/evaluate

# Check health
curl http://localhost:3001/health
```

**During recording — trigger these at the right moments:**
```bash
# Segment 2 (1:30): Trigger loan
curl -X POST http://localhost:3001/api/credit/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC/borrow \
  -H "Content-Type: application/json" -d '{"amount": 1000}'

# Segment 2 (2:30): Trigger harvest + debt service
curl -X POST http://localhost:3001/api/inter-agent/harvest
```

## ℹ️ Key Facts (Reference During Recording)

- **Repo**: github.com/loquit-doru/agent-treasury
- **Live Dashboard**: agent-treasury.pages.dev
- **Live API**: treasury.proceedgate.dev
- **Stack**: WDK + OpenClaw + Solidity 0.8.20 + Foundry + Groq (LLaMA 3.3 70B) + configurable LLM failover + React + Tailwind + WebSocket
- **Contracts (Arbitrum One)**:
  - TreasuryVault: `0x5503e9d53592B7D896E135804637C1710bDD5A64`
  - CreditLine: `0x236AB6D30F70D7aB6c272aCB3b186D925Bcae1a0`
  - USDt: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
  - Aave V3 Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
  - WDK Wallet (AGENT_ROLE): `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Track**: Lending Bot (11/11 requirements + all bonus tracks)
- **31 Foundry tests**: 17 CreditLine + 14 TreasuryVault — all passing
- **Agents**: Treasury Agent (yield, risk, pause) + Credit Agent (scoring, lending, repayment)
- **21 autonomous decision points** (11 Treasury + 10 Credit)
- **3 agentic payment flows**: Loan disbursement, inter-agent lending, autonomous collection
- **Bonuses**: Inter-agent lending, ML default prediction, ZK-inspired credit proofs, yield-based debt servicing, treasury health scoring
