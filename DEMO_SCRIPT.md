# AgentTreasury CORE — Demo Video Script (v6)
## Tether Hackathon Galáctica: WDK Edition 1 | Lending Bot Track

> **Target: 2:00–2:30.** Everything visual on dashboard.
> No curl. No JSON. Show the system working, not the code.

---

### 🎬 HOOK (0:00 – 0:12)

**[Screen: Dashboard — full view, agents running, 4-5 events in timeline, Health Score visible]**

> *"A hundred and fifty thousand USDt in a DAO vault. No CFO. No multisig committee.*
> *Two AI agents manage everything — lending, yield, risk scoring.*
> *Let me show you how it works."*
>
> *(Dashboard already live — KPIs, health score 96/100, timeline with pre-existing events)*

---

### 💸 LOAN FLOW (0:12 – 0:40)

**[Screen: Dashboard — trigger a loan, watch timeline update LIVE]**

> A borrower connects and requests USDt.
> The Credit Agent evaluates: 7 on-chain factors, ML default prediction, LLM reasoning.
> Score: 750. Risk: 1.4%. Approved.
>
> Loan disbursed on-chain. Interest rate set. 30-day terms.
> The entire flow — autonomous.
>
> *(Point to Activity Timeline — each step appears live with reasoning text)*

---

### 💰 TREASURY + YIELD (0:40 – 0:55)

**[Screen: Dashboard — KPIs + yield positions]**

> Meanwhile, the Treasury Agent manages idle capital.
> It found Aave at 4.2% — invested automatically.
> When yield comes in, it auto-repays inter-agent debt. Oldest first.
>
> *(Point to yield positions panel + KPI cards — briefly)*

---

### 🤝 BOARD MEETING (0:55 – 1:20)

**[Screen: Dashboard — trigger board meeting, watch agents debate in timeline]**

> These agents don't just execute. They **debate**.
>
> Treasury proposes a yield allocation. Credit pushes back — it needs liquidity for upcoming loans.
> They negotiate. They reach consensus.
>
> This is a real Board Meeting — LLM-to-LLM dialogue. Not scripted.
> Every meeting produces different arguments.
>
> *(Let timeline fill with board meeting events — ~15s of live agent dialogue)*

---

### 🛡️ ML + ZK + HEALTH (1:20 – 1:40)

**[Screen: Dashboard — Health Score + BonusFeatures cards]**

> Health Score: 96 out of 100. Excellent. Six weighted factors.
>
> ML model predicts loan defaults with 7 features — calibrated against real DeFi liquidation data.
> ZK-inspired proofs let borrowers prove their credit tier
> without revealing the exact score. Privacy by design.
>
> *(Quick scroll through BonusFeatures cards)*

---

### 🔧 WDK + ON-CHAIN (1:40 – 1:55)

**[Screen: Arbiscan tabs — pre-opened]**

> Under the hood — Tether's WDK handles wallets and signing.
> And this is live on Arbitrum One.
>
> TreasuryVault — real contract. CreditLine — real transactions.
> Every loan, every repayment — on-chain and verifiable.
>
> *(Switch between pre-opened Arbiscan tabs — 3 seconds each)*

---

### 🏗️ TECH + REPO (1:55 – 2:10)

**[Screen: GitHub repo — brief scroll]**

> React + Tailwind + WebSocket dashboard. Express + TypeScript backend.
> Solidity + Foundry contracts. Groq LLM with configurable failover — 24/7 uptime, zero cost.
> Open source. 11 out of 11 requirements. All bonus tracks covered.
>
> *(Scroll briefly through repo structure)*

---

### 🎯 CTA (2:10 – 2:25)

**[Screen: Dashboard full view — agents running]**

> AgentTreasury CORE.
>
> Autonomous lending. Yield optimization. Inter-agent governance.
> ML risk scoring. ZK credit proofs.
>
> Two AI agents. One treasury. **Full autonomy with on-chain safety.**
>
> *(Hold dashboard as final shot — 3 seconds, agents still producing events)*

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

### Strategy: Record in Segments

1. Hook + Loan Flow (0:00–0:40)
2. Treasury + Board Meeting (0:40–1:20)
3. ML/ZK + Health (1:20–1:40)
4. WDK + Arbiscan + Repo + CTA (1:40–2:25)

### Browser Setup

- [x] Chrome Guest Mode sau profil curat
- [x] Bookmarks bar: HIDDEN
- [x] Zoom: **125%**
- [x] Dark mode dashboard confirmed
- [x] DevTools: CLOSED
- [x] Notifications: Do Not Disturb
- [x] Max 3 tabs: Dashboard | Arbiscan | GitHub

### Pre-Record Checklist

- [ ] OBS scenes configurate și testate
- [ ] Test recording 30s — verifică audio levels
- [ ] Dashboard pre-populat: 4-5 events, 1 loan activ, yield positions
- [ ] Board Meeting endpoint testat
- [ ] Arbiscan tabs pre-deschise cu contractele

**Pre-trigger (30s înainte de record):**
```bash
curl -X POST https://treasury.proceedgate.dev/api/treasury/sync
curl -X POST https://treasury.proceedgate.dev/api/credit/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28/evaluate
```

## ℹ️ Key Facts

- **Repo**: github.com/loquit-doru/agent-treasury
- **Live Dashboard**: agent-treasury.pages.dev
- **Live API**: treasury.proceedgate.dev
- **Stack**: WDK + OpenClaw + Solidity 0.8.20 + Foundry + Groq (LLaMA 3.3 70B) + configurable LLM failover + React + Tailwind + WebSocket
- **Contracts (Arbitrum One)**:
  - TreasuryVault: `0x5503e9d53592B7D896E135804637C1710bDD5A64`
  - CreditLine: `0x236AB6D30F70D7aB6c272aCB3b186D925Bcae1a0`
  - USDt: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
- **Track**: Lending Bot (11/11 requirements)
- **Agents**: Treasury Agent (yield, risk, pause) + Credit Agent (scoring, lending, repayment)
- **Bonuses**: Inter-agent lending, ML default prediction, ZK-inspired credit proofs, yield-based debt servicing, treasury health scoring
