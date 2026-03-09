# AgentTreasury CORE — Demo Video Script (v3 FINAL)
## Tether Hackathon Galáctica: WDK Edition 1 | Lending Bot Track

> **Target: 2:30–2:50.** Everything visual on dashboard. No curl. No JSON.
> Consensus: 3× AI reviewers + recording best practices applied.

---

### 🎬 HOOK (0:00 – 0:10)

**[Screen: Dashboard — full view, agents already running, 3-4 events in timeline]**

> *"Fifty thousand USDt in a DAO vault. No CFO. No multisig committee.*
> *Two AI agents manage everything — lending, yield, risk — fully autonomous.*
> *Let me show you."*
>
> *(Dashboard visible immediately — KPIs, health score, timeline with pre-existing events)*

---

### 💸 LOAN FLOW — END TO END (0:10 – 0:30)

**[Screen: Dashboard — trigger loan in background, watch timeline update LIVE]**

> A borrower connects and requests 1,000 USDt.
> The Credit Agent evaluates — 7 on-chain factors, ML default prediction, LLM reasoning.
> Score: 750. Risk: 1.4%. Approved.
>
> Loan disbursed on-chain. Interest rate set. 30-day terms.
> **Zero clicks. Fully autonomous.**
>
> *(Point to Activity Timeline — each step appears live with reasoning text)*

---

### 💰 TREASURY AGENT (0:30 – 0:40)

**[Screen: Dashboard — KPIs + yield positions]**

> The Treasury Agent manages the vault. It found Aave at 4.2% and Compound at 3.8% —
> invested idle capital automatically.
> When yield comes in, it auto-repays inter-agent debt. Oldest first.
>
> *(Point to yield positions panel + KPI cards — briefly)*

---

### 🤝 BOARD MEETING (0:40 – 1:05)

**[Screen: Dashboard — trigger board meeting, watch agents debate in timeline]**

> Now — these agents hold Board Meetings. Real LLM-to-LLM dialogue.
>
> Treasury proposes a yield allocation. Credit pushes back — needs liquidity for loans.
> They negotiate. They adapt.
>
> Not scripted. Every meeting produces different arguments.
>
> *(Let timeline fill with board meeting events — ~15-20s of live agent dialogue)*

---

### 🔥 STRESS TEST — LIVE (1:05 – 1:20)

**[Screen: Dashboard — click "Stress Test" button]**

> What if the market crashes 40%?
>
> *(Click the Stress Test button — slow, intentional mouse movement)*
>
> System simulates vault losses. Agents react.
> Health Score: still green. System survives.
>
> *(Point to Health Score gauge + stress test result panel)*

---

### 🛡️ TREASURY HEALTH + ML + ZK (1:20 – 1:35)

**[Screen: Dashboard — Health Score + scroll to BonusFeatures]**

> Health Score: 85 out of 100. Six weighted factors — liquidity, utilization, yield, debt.
>
> ML model uses 7 features calibrated against Aave/Compound liquidation data.
> ZK-inspired proofs let borrowers prove their tier without revealing the exact score.
>
> *(Quick scroll through BonusFeatures cards)*

---

### 🔧 WDK (1:35 – 1:45)

**[Screen: Dashboard — verbal mention + optional code screenshot flash]**

> Under the hood — Tether's WDK handles wallet operations.
> `wdk-wallet-evm` for wallet management, `wdk-protocol-lending-aave-evm` for DeFi.
> WDK is the primary path. Ethers.js is the fallback.

---

### ⛓️ ON-CHAIN PROOF (1:45 – 2:00)

**[Screen: Etherscan Sepolia — pre-opened tabs]**

> And this is live on Sepolia.
> TreasuryVault — real contract. CreditLine — real transactions.
>
> *(Switch to pre-opened Etherscan tabs — 3 seconds each, show recent txs)*

---

### 🏗️ TECH + REPO (2:00 – 2:15)

**[Screen: GitHub repo]**

> React + Tailwind + WebSocket dashboard.
> Express + TypeScript backend. Solidity + Foundry contracts.
> Groq LLM. Open source. 11 out of 11 requirements.
>
> *(Scroll briefly through repo — it's real code, not a mockup)*

---

### 🎯 CTA (2:15 – 2:30)

**[Screen: Dashboard — full view, agents still running]**

> AgentTreasury CORE. Autonomous lending, yield optimization,
> inter-agent governance.
>
> Two AI agents. One treasury. Zero human prompts.
>
> *(Dashboard running live as final shot — hold 3 seconds)*

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

**OBS Config:**
- Output → Recording Format: MP4
- Output → Video Encoder: x264 (sau NVENC cu GPU)
- Video → Base & Output Resolution: 1920×1080
- Video → FPS: 30

**OBS Scenes:**
1. Dashboard fullscreen
2. Etherscan tabs
3. GitHub repo

### Strategy: Record in Segments

Nu înregistra totul dintr-o bucată. Fă segment per section:
1. Hook + Loan Flow (0:00–0:30)
2. Treasury + Board Meeting (0:30–1:05)
3. Stress Test + Health + ML/ZK (1:05–1:35)
4. WDK + Etherscan + Repo + CTA (1:35–2:30)

Dacă greșești un segment → re-record doar acel segment.
Exportă o versiune raw înainte de orice editare.

### Browser Setup

- [x] Chrome Guest Mode sau profil curat (zero extensii, zero history)
- [x] Bookmarks bar: HIDDEN (Ctrl+Shift+B)
- [x] Zoom: **125%** (textul trebuie vizibil pe laptop/telefon)
- [x] Dark mode dashboard confirmed
- [x] DevTools: CLOSED
- [x] Notifications: Do Not Disturb
- [x] Max 3 tabs: Dashboard | Etherscan | GitHub
- [x] Terminal font: 16px+ (dacă apare)

### Voiceover Style

**Ton: technical + conversational.** Nu enterprise, nu marketing, nu excited pitch.

Bun: *"A borrower connects. The Credit Agent evaluates using on-chain data and a default prediction model. Loan approved, on-chain."*

Rău: *"Revolutionary AI-powered next-generation autonomous finance..."*

- Script pe bullet points, nu word-by-word
- Practice run 2-3× înainte
- Pauze scurte înainte de "wow moments"
- Dacă te bâlbâi puțin → pare autentic
- Mouse-ul se mișcă **LENT și intenționat** (nu haotic)

### Pre-Record Checklist

**Tehnic:**
- [ ] OBS scenes configurate și testate
- [ ] Test recording 30s — verifică audio levels (nu clip, nu încet)
- [ ] Browser curat, zoom 125%, bookmarks hidden
- [ ] Dashboard pre-populat: 3-4 events, 1 loan activ, yield positions populate
- [ ] Stress Test testat (funcționează?)
- [ ] Board Meeting endpoint testat
- [ ] Etherscan tabs pre-deschise cu contractele

**Conținut:**
- [ ] Script bullet points printat / pe al doilea monitor
- [ ] Practice run complet făcut cel puțin o dată
- [ ] Timing: Loan la 0:10, Board Meeting la 0:40, Stress Test la 1:05
- [ ] URLs vizibile la final (GitHub, live demo)

**Pre-trigger (30s înainte de record):**
```bash
# Pre-populate timeline with events
curl -X POST https://treasury.proceedgate.dev/api/treasury/sync
curl -X POST https://treasury.proceedgate.dev/api/credit/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28/evaluate
```

### Mouse Rules

- Mișcare LENTĂ și intenționată
- Hover pe elementele pe care vorbești
- Nu mișca mouse-ul când nu e relevant
- Indică cu cursorul, nu cu highlight random

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
- **Bonuses**: Inter-agent lending, ML default prediction, ZK-inspired credit proofs, yield-based debt servicing, stress testing, treasury health scoring
