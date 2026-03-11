# AgentTreasury — Hackathon Plan (Mar 2-22, 2026)

> **⚠️ NOTE**: This is the original planning document. The project was initially developed on Sepolia testnet and has since been fully migrated to **Arbitrum One mainnet**. Sepolia references below are historical.

> Tether Hackathon Galactica | DoraHacks | Best Overall Strategy
>
> **Concept**: CFO autonom pentru DAOs — Treasury Agent + Credit Agent, construit cu WDK + OpenClaw.

---

## REGULI DE AUR

1. **NU scrie cod care apelează WDK API înainte de 6 Martie** — walkthrough-ul oficial e pe 6. Tot ce presupunem e risc de rewrite
2. **NU inventa metrici** ("23% mai mult yield") — jurații tehnici întreabă sursa
3. **NU mock-ui ceea ce poți face real** — demo funcțional > features fake
4. **NU adăuga features noi dacă cele existente nu sunt 100%** — completeness > breadth
5. **Testează după FIECARE pas** — nu acumula cod netestat
6. **Commit mic și des** — nu pierde muncă

---

## CALENDAR HACKATHON

| Dată | Eveniment Hackathon | Acțiunea Noastră |
|------|---------------------|------------------|
| Mar 1 | Ultima zi Week 0 | Research WDK/OpenClaw, repo setup |
| Mar 3 | Opening Ceremony & Kickoff | Participăm, aflăm ce caută jurații |
| **Mar 6** | **WDK & OpenClaw walkthrough** | **CRITICAL — aflăm API real, nu scrie cod WDK înainte!** |
| Mar 9 | Submissions Portal Opens | Submit DRAFT pe DoraHacks |
| **Mar 10** | **Technical Deep-Dive** | Participăm: patterns wallets + agents + Tether tokens |
| Mar 16-18 | Mentor Feedback Sessions | Rezervăm slot, primim feedback |
| Mar 19 | Final AMA | Ultimele întrebări |
| Mar 20-22 | Daily Office Hours | Debug, polish, submit |
| **Mar 22, 23:59 UTC** | **DEADLINE** | **Submit final (noi: max 20:00 UTC = 4h buffer)** |

---

## ARHITECTURA SIMPLIFICATĂ

```
┌─────────────────────────────────────────┐
│         REACT DASHBOARD (Live)          │
│    • Balanțe reale WDK                  │
│    • Credit score vizibil               │
│    • Butoane Borrow/Repay funcționale   │
│    • Logs decizii agent în timp real    │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│       BACKEND (Node.js + Express)       │
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │  TREASURY   │◄──►│   CREDIT    │    │
│  │   AGENT     │    │   AGENT     │    │
│  │             │    │             │    │
│  │ • WDK Core  │    │ • Scoring   │    │
│  │ • Yield     │    │ • Lending   │    │
│  │ • Security  │    │ • Risk Mgmt │    │
│  └──────┬──────┘    └──────┬──────┘    │
│         │    wdk-mcp / OpenClaw         │
└─────────┼──────────────────┼────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────┐
│      SMART CONTRACTS (Sepolia)          │
│                                         │
│  1. TreasuryVault (deposit/withdraw/    │
│     propose/execute/pause)              │
│  2. CreditLine (profile/borrow/repay)  │
│                                         │
│  USDt testnet de la Pimlico/Candide    │
└─────────────────────────────────────────┘
```

---

## FAZA 0 — PREGĂTIRE (Mar 1, azi)

| # | Task | Verificare | Status |
|---|------|-----------|--------|
| 0.1 | Citit integral WDK docs (docs.wallet.tether.io) | Notițe despre API real | ⬜ |
| 0.2 | Citit wdk-core GitHub (cod sursă, nu doar README) | Lista de metode reale | ⬜ |
| 0.3 | Citit wdk-mcp GitHub (ce tools expune) | Lista celor 35 tools | ⬜ |
| 0.4 | Citit OpenClaw docs + GitHub | Cum se configurează agents | ⬜ |
| 0.5 | Instalat toolchain: Foundry, Node 22+ | `forge --version` merge | ⬜ |
| 0.6 | Creat repo GitHub `agent-treasury` | Repo public, README minimal | ⬜ |
| 0.7 | Join Discord Tether Developer Hub | Acces canale #wdk-support, #find-team | ⬜ |

**OUTPUT**: Înțelegere clară a ce poate/nu poate WDK. Zero cod scris.

---

## FAZA 1 — FUNDAȚIE FĂRĂ WDK (Mar 2-5)

Scriem doar ce **sigur** nu se schimbă: smart contracts, structura proiect, backend schelet.

| # | Task | Verificare | Risc |
|---|------|-----------|------|
| 1.1 | Structura monorepo: `contracts/`, `backend/`, `frontend/`, `agents/` | Directoare create, package.json-uri | Mic |
| 1.2 | `TreasuryVault.sol` — deposit, withdraw, propose, execute, pause | `forge test` trece | Zero — Solidity pur |
| 1.3 | `CreditLine.sol` — profile, borrow, repay, score-to-limit | `forge test` trece | Zero — Solidity pur |
| 1.4 | Deploy script Foundry pe Sepolia | Contracte deployate, adrese salvate | Zero |
| 1.5 | Ia USDt testnet de la faucet Pimlico/Candide | Ai USDt în wallet-ul de test | Zero |
| 1.6 | Backend Express schelet: `/health`, `/api/treasury/balance`, `/api/credit/score` | Server pornește, health OK | Mic |
| 1.7 | Frontend React schelet: layout, wallet connect (wagmi/viem) | Pagina se încarcă, wallet se conectează | Mic |
| 1.8 | SOUL.md files pentru agenți (text, nu cod) | Fișiere în `agents/treasury/`, `agents/credit/` | Zero |

### CE NU FACEM ÎN FAZA 1:
- ~~Import `@tether/wdk-core`~~ — nu știm API-ul real
- ~~Cod care presupune `wdk.defi.getYieldOpportunities()`~~ — probabil nu există
- ~~Integrare OpenClaw~~ — așteptăm walkthrough

**OUTPUT**: Contracte deployate pe Sepolia, backend/frontend schelet, ZERO dependență pe WDK.

---

## FAZA 2 — POST-WALKTHROUGH (Mar 6-12)

**Mar 6 = WDK & OpenClaw walkthrough.** Trei scenarii posibile:

| Scenariu | Implicație |
|----------|-----------|
| A) WDK are DeFi modules | Integrăm yield direct prin WDK |
| B) WDK e doar wallet (probabil) | WDK pt wallet, ethers.js pt DeFi |
| C) WDK API e diferit radical | Adaptăm în 1-2 zile |

| # | Task | Verificare | Depinde de |
|---|------|-----------|-----------|
| 2.1 | Participăm la walkthrough (Mar 6) | Notițe cu API real | - |
| 2.2 | Adaptăm backend la API-ul WDK real | Balance check merge cu WDK | Walkthrough |
| 2.3 | WDK wallet create + seed management | Wallet creat, seed salvat | 2.1 |
| 2.4 | WDK send USDt pe Sepolia | Tx confirmată pe explorer | 2.3 |
| 2.5 | wdk-mcp server setup (dacă e relevant) | MCP tools funcționale | 2.1 |
| 2.6 | Treasury Agent: logica de decizie (LLM call) | Agent decide invest/hold cu reasoning | 2.4 |
| 2.7 | Credit Agent: scoring on-chain reputation | Returnează scor bazat pe tx history | 2.4 |
| 2.8 | Conectare agenți la smart contracts | Agent poate apela propose() | 2.6, 2.7 |
| 2.9 | **Submit DRAFT pe DoraHacks (Mar 9)** | Draft vizibil pe portal | 2.4 minim |
| 2.10 | Participăm la Technical Deep-Dive (Mar 10) | Notițe + ajustări | - |

### CE NU FACEM ÎN FAZA 2:
- ~~Al 3-lea agent~~ — doar dacă 2.1-2.8 sunt 100%
- ~~Dashboard complex~~ — doar backend, API funcțional
- ~~Demo video~~ — prea devreme

**OUTPUT**: Treasury + Credit agents funcționali end-to-end pe Sepolia cu WDK real.

---

## FAZA 3 — DASHBOARD & INTEGRARE (Mar 13-18)

| # | Task | Verificare | Prioritate |
|---|------|-----------|-----------|
| 3.1 | Dashboard: Treasury panel cu date LIVE din WDK | Balanță reală afișată | P0 |
| 3.2 | Dashboard: Credit panel cu scor + borrow/repay | Butoane funcționale, tx reale | P0 |
| 3.3 | Dashboard: Agent logs în timp real (WebSocket) | Vezi decizii agent live | P0 |
| 3.4 | End-to-end test: deposit → agent decide → invest → credit → borrow | Flow complet fără erori | P0 |
| 3.5 | Error handling: ce se întâmplă dacă tx fail? | Mesaj clar, retry logic | P1 |
| 3.6 | Emergency stop button funcțional | pause() pe contract, UI reflectă | P1 |
| 3.7 | **Rezervă slot mentor feedback** | Booking confirmat | P0 |
| 3.8 | Participă la mentor session | Feedback notat, ajustări făcute | P0 |

### DECIZIE CRITICĂ pe Mar 15:
Dacă 3.1-3.4 sunt ✅, adăugăm Tipping Agent basic? **DA** doar dacă totul e solid. **NU** altfel.

**OUTPUT**: Dashboard funcțional cu date reale. Demo-ready.

---

## FAZA 4 — FINALIZARE (Mar 19-22)

| # | Task | Verificare | Deadline |
|---|------|-----------|---------|
| 4.1 | Participăm la Final AMA (Mar 19) | Ultimele întrebări clarificate | Mar 19 |
| 4.2 | README complet: setup, arhitectură, design decisions, limitări | Cineva nou poate rula proiectul | Mar 20 |
| 4.3 | Demo video (max 3 min): hook → soluție → demo live → tech → impact | Video uploadat, link funcțional | Mar 21 |
| 4.4 | Final testing pe Sepolia | Toate features merg | Mar 21 |
| 4.5 | Deploy frontend (Vercel/Cloudflare Pages) | URL live | Mar 21 |
| 4.6 | Update submission pe DoraHacks (final) | Toate câmpurile completate | Mar 22 AM |
| 4.7 | **SUBMIT FINAL** | Confirmare DoraHacks | **Mar 22, max 20:00 UTC** |

**Buffer**: 4 ore înainte de deadline (23:59 UTC).

---

## CRITERII JURIZARE — MAPARE DIRECTĂ

| Criteriu juriu | Cum acoperim | Evidența |
|---|---|---|
| **Innovation** | Agent autonom de treasury cu credit scoring — categorie "Legend" | Concept unic |
| **Technical Execution** | Smart contracts testate, WDK nativ, cod curat | Forge tests, TS strict |
| **User Experience** | Dashboard simplu, balanțe live, logs transparente | 1 click: vezi ce face agentul |
| **Completeness** | Demo funcțional end-to-end pe Sepolia | Video demonstrativ |
| **WDK usage** (obligatoriu) | Wallet create, balance, send — toate prin WDK | Import vizibil în cod |
| **OpenClaw/agent** (obligatoriu) | wdk-mcp + SOUL.md agents | Integrare vizibilă |
| **Tether tokens** (obligatoriu) | USDt pe Sepolia cu faucet real | Tx-uri pe explorer |
| **README clar** (obligatoriu) | Setup, arhitectură, limitări | Documentație completă |

---

## CE NU FACEM NICIODATĂ

| Don't | De ce |
|-------|-------|
| Hardcodăm date în dashboard | Jurații verifică — dacă nu avem date reale, afișăm "No data yet" |
| Inventăm statistici de performance | Nu avem backtesting, nu avem proof |
| Integrăm Rumble | API neclar, nu merită riscul |
| Facem ZK proofs | Complexitate prea mare, reward mic |
| Facem multi-chain | Sepolia e suficient |
| Scriem cod duplicat | DRY, un singur loc de truth |
| Ignorăm feedback-ul mentorilor | Ei știu ce caută juriul |
| Trimitem la 23:55 UTC | Murphy's Law: ceva va merge prost |

---

## STACK TEHNIC FINAL

| Component | Tehnologie | Motivație |
|-----------|-----------|-----------|
| Wallet SDK | Tether WDK (@tether/wdk-core) | Obligatoriu la hackathon |
| Agent Framework | OpenClaw + wdk-mcp | Obligatoriu la hackathon |
| Smart Contracts | Solidity 0.8.20, Foundry | Speed + testing |
| Backend | Node.js 22+, Express, TypeScript | Familiar, rapid |
| Frontend | React 18+, wagmi, viem, Tailwind | Wallet connect nativ |
| Blockchain | Ethereum Sepolia (testnet) | Faucets disponibile |
| LLM | OpenAI GPT-4 / Claude | Decizii agent |
| Deploy | Vercel (frontend), Railway (backend) | Free tier sufficient |

---

## PITCH STRUCTURE (3 min)

**Min 0:00-0:30 — Problemă**
"DAOs dețin milioane în trezorerii inactive. Pierd yield zilnic. Management manual e lent și riscant."

**Min 0:30-1:30 — Demo Live**
- Balanța reală USDt pe Sepolia
- Agentul analizează oportunități
- Credit scoring on-chain
- Împrumut automat, investiție, yield

**Min 1:30-2:30 — Tehnologie**
WDK nativ → OpenClaw orchestrare → Smart contracts security-first → Testat pe Sepolia

**Min 2:30-3:00 — Impact**
Scalabil. 24/7. Zero erori umane. Viitorul trezoreriilor autonome.

---

## RESEARCH NOTES (completat Mar 1, 2026)

---

### WDK-core (github.com/tetherto/wdk)

**Package**: `@tetherto/wdk` | **Versiune**: v1.0.0-beta.5 (Dec 2025) | **Limbaj**: JavaScript 100%

#### API Real (confirmat din cod sursă):

```js
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

// Inițializare cu seed phrase (12 cuvinte)
const wdk = new WDK(seed)
  .registerWallet('ethereum', WalletManagerEvm, evmConfig)
  .registerProtocol('ethereum', 'aave', LendingAaveEvm, aaveConfig)

// Get account
const account = await wdk.getAccount('ethereum', 0)

// Send transaction
const { hash, fee } = await account.sendTransaction(tx)

// DeFi protocols (pe account, NU pe wdk!)
const aave = account.getLendingProtocol('aave')
const swap = account.getSwapProtocol('paraswap')
const bridge = account.getBridgeProtocol('usdt0')
```

#### Metode WDK (constructor):
- `registerWallet(blockchain, WalletClass, config)` → chainează
- `registerProtocol(blockchain, label, ProtocolClass, config)` → chainează
- `registerMiddleware(blockchain, fn)` → chainează
- `getAccount(blockchain, index?)` → `IWalletAccountWithProtocols`
- `getAccountByPath(blockchain, path)` → `IWalletAccountWithProtocols`
- `getFeeRates(blockchain)` → `FeeRates`
- `dispose()` → cleanup
- **Static**: `getRandomSeedPhrase()`, `isValidSeedPhrase(phrase)`

#### Metode Account:
- `sendTransaction(tx)` → `{ hash, fee }`
- `getSwapProtocol(label)` → `ISwapProtocol`
- `getBridgeProtocol(label)` → `IBridgeProtocol`
- `getLendingProtocol(label)` → `ILendingProtocol`
- `registerProtocol(label, Protocol, config)` → chainare

#### Module disponibile (CONFIRMATE):

**Wallet modules:**
| Package | Chain |
|---------|-------|
| `@tetherto/wdk-wallet-evm` | Ethereum, Polygon, Arbitrum |
| `@tetherto/wdk-wallet-evm-erc4337` | EVM fără gas |
| `@tetherto/wdk-wallet-ton` | TON |
| `@tetherto/wdk-wallet-ton-gasless` | TON fără gas |
| `@tetherto/wdk-wallet-btc` | Bitcoin |
| `@tetherto/wdk-wallet-tron` | TRON |
| `@tetherto/wdk-wallet-solana` | Solana |

**Protocol modules:**
| Package | Funcție |
|---------|---------|
| `@tetherto/wdk-protocol-swap-paraswap-evm` | Token swaps pe EVM |
| `@tetherto/wdk-protocol-bridge-usdt0-evm` | Bridge între EVM chains |
| `@tetherto/wdk-protocol-bridge-usdt0-ton` | Bridge TON → alte chains |
| **`@tetherto/wdk-protocol-lending-aave-evm`** | **Lending/borrowing pe EVM** ⭐ |

#### ⚠️ DESCOPERIRE CRITICĂ:
**WDK ARE modul de Aave Lending!** `@tetherto/wdk-protocol-lending-aave-evm` există oficial.
Asta înseamnă:
- NU avem nevoie de ethers.js direct pentru DeFi
- Yield Agent poate folosi WDK nativ pentru Aave deposit/withdraw
- Jurații vor fi impresionați — folosim WDK end-to-end, nu doar wallet
- **Trebuie investigat**: ce metode expune `ILendingProtocol` (supply, borrow, withdraw, repay?)

#### Ce NU are WDK:
- NU are `wdk.defi.getYieldOpportunities()` — asta e inventată
- NU are dashboard/UI built-in
- NU are management de chei multi-sig
- Seed phrase-ul e responsabilitatea noastră (self-custody)

---

### wdk-mcp (github.com/dieselftw/wdk-mcp)

**Autor**: dieselftw (1 contributor — proiect comunitar) | **Runtime**: Bun | **Port**: 8080

#### Tools reale (18 tools, NU 35 cum spuneau docs hackathon):

| Tool | Funcție |
|------|---------|
| `create_seed` | Creează seed entry |
| `list_seeds` | Listează toate seed-urile |
| `get_seed` | Fetch un seed după ID |
| `update_seed` | Update metadata/phrase |
| `delete_seed` | Șterge un seed |
| `create_wallet` | Creează wallet legat de un seed |
| `list_wallets` | Listează toate wallet-urile |
| `get_wallet` | Fetch un wallet după ID |
| `add_wallet_address` | Atașează o adresă |
| `update_wallet` | Update metadata wallet |
| `delete_wallet` | Șterge un wallet |
| `get_balance` | Balanță pentru o adresă |
| `send_transaction` | Trimite o tranzacție |
| `set_api_key` | Stochează API key local |
| `get_api_key` | Citește un API key |
| `list_api_keys` | Listează API keys |
| `delete_api_key` | Șterge un API key |
| `get_database_stats` | Stats + config path |

#### Arhitectură:
- Stocare: `wdk-data.json` (JSON simplu, **NU** criptat)
- FastMCP server pe `http://localhost:8080/mcp`
- Optional: Next.js Web UI pe port 3000
- Optional: ngrok pentru access remote LLM

#### Limitări (din README):
- ⚠️ JSON store, necriptat
- EVM/ETH only (nu suportă alte chains OOB)
- No bridging, no cross-chain
- Basic RPC, fără retry/backoff
- Dev only, validare minimală

#### Implicații pentru proiect:
- **Putem folosi wdk-mcp ca bridge între OpenClaw și WDK** 
- Dar e limitat — nu expune Aave/lending tools
- Probabil va trebui să-l extindem noi pentru Treasury Agent
- Sau folosim WDK SDK direct în backend-ul nostru + expunem via MCP custom

---

### OpenClaw (github.com/openclaw/openclaw)

**Versiune**: 2026.2.26 | **Stars**: 243k | **Contributors**: 942 | **Runtime**: Node ≥22 + pnpm

#### Ce este de fapt:
- Personal AI assistant local-first
- Gateway WebSocket pe `ws://127.0.0.1:18789`
- Multi-canal: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, WebChat
- Are MCP support (deci se integrează cu wdk-mcp)
- Control UI + WebChat built-in

#### Structura agent:
```
~/.openclaw/workspace/
├── AGENTS.md          # Instrucțiuni nivel top
├── SOUL.md            # Personalitate/comportament agent
├── TOOLS.md           # Tools disponibile
└── skills/
    └── <skill-name>/
        └── SKILL.md   # Fiecare skill
```

#### Config minimal:
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-6"
  }
}
```

#### Agent-to-Agent Communication:
- `sessions_list` — descoperă sesiuni/agenți activi
- `sessions_history` — transcript logs
- `sessions_send` — mesaj între agenți (reply-back + announce)

#### Cum se integrează cu WDK:
1. OpenClaw rulează local cu MCP support
2. Se conectează la wdk-mcp server
3. Primește access la tooluri: `create_wallet`, `get_balance`, `send_transaction`
4. Definim behaviour în SOUL.md
5. Agent-to-agent via sessions_* tools

#### Instalare (CONFIRMAT):
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw gateway --port 18789 --verbose
```

#### Chat commands utile (pentru demo):
- `/status` — status sesiune
- `/new` — reset
- `/think <level>` — off|minimal|low|medium|high|xhigh

---

## CONCLUZII RESEARCH — CE SE SCHIMBĂ

### ✅ Vești bune:
1. **WDK ARE Aave Lending nativ** — `getLendingProtocol('aave')` — nu trebuie ethers.js direct
2. **OpenClaw e masiv și stabil** (243k stars) — infrastructure de încredere
3. **wdk-mcp funcționează** — bridge real între OpenClaw și WDK
4. **API WDK e simplu** — `new WDK(seed).registerWallet().registerProtocol()`

### ⚠️ Ajustări necesare:
1. **Codul presupus anterior e GREȘIT** — nu există `wdk.defi.getYieldOpportunities()`. Trebuie `account.getLendingProtocol('aave').supply(...)` (probabil)
2. **wdk-mcp are doar 18 tools** (nu 35) — nu include lending/swap. Trebuie extins sau folosit WDK SDK direct
3. **wdk-mcp necesită Bun** nu Node — trebuie instalat Bun
4. **OpenClaw necesită pnpm** — adaugă la prerequisites

### 🔴 Riscuri noi identificate:
1. **`ILendingProtocol` interface necunoscut** — nu știm exact metodele (supply? deposit? borrow? repay?). Trebuie citit codul sursa al `@tetherto/wdk-protocol-lending-aave-evm`
2. **wdk-mcp e proiect de 1 persoană** — poate avea bug-uri, nu e battle-tested
3. **WDK e beta (v1.0.0-beta.5)** — pot fi breaking changes
4. **OpenClaw pe Windows necesită WSL2** — "strongly recommended"

### 📋 Acțiuni imediate (actualizat):
- [x] Task 0.2: Research WDK-core ✅
- [x] Task 0.3: Research wdk-mcp ✅  
- [x] Task 0.4: Research OpenClaw ✅
- [ ] **NOU**: Investighează `@tetherto/wdk-protocol-lending-aave-evm` — ce metode expune?
- [ ] **NOU**: Verifică dacă WDK funcționează pe Sepolia (sau doar mainnet?)
- [ ] **NOU**: Instalează Bun + pnpm ca prerequisites
- [ ] **NOU**: Testează `openclaw onboard` pe Windows/WSL2

### 🏗️ Arhitectura revizuită (post-research):
```
┌─────────────────────────────────────┐
│     REACT DASHBOARD (Live)          │
│     wagmi + viem                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     NODE.JS BACKEND (Express)       │
│                                     │
│  ┌────────────┐  ┌───────────────┐  │
│  │  TREASURY  │  │    CREDIT     │  │
│  │  AGENT     │  │    AGENT      │  │
│  │            │  │               │  │
│  │ WDK SDK    │  │ On-chain      │  │
│  │ direct:    │  │ reputation:   │  │
│  │ • wallet   │  │ • tx history  │  │
│  │ • balance  │  │ • scoring     │  │
│  │ • send     │  │ • limits      │  │
│  │ • aave ⭐  │  │               │  │
│  └────┬───────┘  └───────┬───────┘  │
└───────┼──────────────────┼──────────┘
        │                  │
        ▼                  ▼
┌──────────────────────────────────────┐
│  OPENCLAW GATEWAY (port 18789)       │
│  + wdk-mcp (port 8080)              │
│                                      │
│  SOUL.md → Agent behaviour           │
│  MCP → wallet tools                  │
│  sessions_* → agent-to-agent         │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  SMART CONTRACTS (Sepolia)           │
│  TreasuryVault + CreditLine          │
│  + USDt testnet (faucet)             │
└──────────────────────────────────────┘
```

---

*Ultima actualizare: Mar 1, 2026 — post-research complet*
