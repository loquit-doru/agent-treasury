<#
.SYNOPSIS
  AgentTreasury CORE — Automated Demo Showcase
  Runs through ALL features for hackathon recording.

.DESCRIPTION
  Assumes backend is already running on localhost:3001.
  Run this while recording your screen (OBS/Loom).
  Each step has a title, colored output, and pause for visibility.

.NOTES
  Start backend first:  cd backend; npx tsx src/index.ts
  Then run:  .\scripts\demo-showcase.ps1
#>

param(
    [string]$BaseUrl = 'http://localhost:3001',
    [int]$PauseSec = 3
)

$ErrorActionPreference = 'Continue'

# ── Helpers ──

function Write-Title {
    param([string]$Step, [string]$Title, [string]$Subtitle)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor DarkCyan
    Write-Host "  STEP $Step — $Title" -ForegroundColor Cyan
    if ($Subtitle) { Write-Host "  $Subtitle" -ForegroundColor DarkGray }
    Write-Host ("=" * 70) -ForegroundColor DarkCyan
    Write-Host ""
}

function Write-Explain {
    param([string]$Text)
    Write-Host "  >> $Text" -ForegroundColor Yellow
    Write-Host ""
}

function Write-Endpoint {
    param([string]$Method, [string]$Path)
    Write-Host "  $Method $Path" -ForegroundColor DarkGray
}

function Invoke-Demo {
    param(
        [string]$Method = 'GET',
        [string]$Path,
        [string]$Label,
        [string]$Explanation,
        $Body,
        [string[]]$Highlight
    )

    Write-Host "  ► $Label" -ForegroundColor Green
    if ($Explanation) { Write-Explain $Explanation }
    Write-Endpoint $Method "$BaseUrl$Path"

    try {
        $params = @{
            Uri             = "$BaseUrl$Path"
            Method          = $Method
            ContentType     = 'application/json'
            TimeoutSec      = 30
            ErrorAction     = 'Stop'
        }
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 5 -Compress)
        }
        $resp = Invoke-RestMethod @params

        $json = $resp | ConvertTo-Json -Depth 6
        # Highlight key fields
        foreach ($line in ($json -split "`n")) {
            $colored = $false
            if ($Highlight) {
                foreach ($h in $Highlight) {
                    if ($line -match $h) {
                        Write-Host $line -ForegroundColor White
                        $colored = $true
                        break
                    }
                }
            }
            if (-not $colored) {
                Write-Host $line -ForegroundColor DarkGray
            }
        }
    }
    catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
    Start-Sleep -Seconds $PauseSec
}

# ═══════════════════════════════════════════════════════════════
#                    DEMO START
# ═══════════════════════════════════════════════════════════════

Clear-Host
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "║       AgentTreasury CORE — Hackathon Demo                        ║" -ForegroundColor White
Write-Host "║       Autonomous CFO for DAOs                                    ║" -ForegroundColor DarkCyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "║       Tether Hackathon Galactica: WDK Edition 1                  ║" -ForegroundColor DarkGray
Write-Host "║       Track: Lending Bot (11/11 requirements)                    ║" -ForegroundColor DarkGray
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Two AI agents manage a DAO treasury autonomously:" -ForegroundColor White
Write-Host "    • Treasury Agent — yield optimization, risk management" -ForegroundColor DarkGreen
Write-Host "    • Credit Agent  — credit scoring, lending, repayments" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  Stack: WDK + OpenClaw + Solidity + Groq LLM + React Dashboard" -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 4

# ── STEP 1: System Health ──
Write-Title "1/10" "SYSTEM HEALTH" "Verify both agents are running"
Invoke-Demo -Method GET -Path '/health' `
    -Label 'Health Check' `
    -Explanation 'Both Treasury + Credit agents running, connected to Arbitrum One.' `
    -Highlight @('"status"', '"treasury"', '"credit"', '"operational"')

# ── STEP 2: Treasury State ──
Write-Title "2/10" "TREASURY STATE" "On-chain vault balance (USDt on Arbitrum One)"
Invoke-Demo -Method GET -Path '/api/treasury' `
    -Label 'Live Treasury Balance' `
    -Explanation 'Real USDt balance from TreasuryVault smart contract on Arbitrum One.' `
    -Highlight @('"balance"', '"dailyVolume"', '"yieldPositions"')

# ── STEP 3: Dashboard Overview ──
Write-Title "3/10" "FULL DASHBOARD" "Complete system view — agents, loans, yield"
Invoke-Demo -Method GET -Path '/api/dashboard' `
    -Label 'Dashboard Data' `
    -Explanation 'Single API call returns: treasury state, credit profiles, active loans, agent decisions.' `
    -Highlight @('"activeLoans"', '"creditProfiles"', '"agentDecisions"', '"balance"')

# ── STEP 4: Credit Evaluation (LLM-powered) ──
$borrower = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
Write-Title "4/10" "CREDIT SCORING (LLM)" "AI evaluates borrower risk — no human prompt needed"
Write-Explain "Borrower: $borrower"
Write-Explain "Formula: txCount + volume + repaymentRate + accountAge + defaultHistory + score + utilization"
Invoke-Demo -Method POST -Path "/api/credit/$borrower/evaluate" `
    -Label 'Evaluate Borrower Credit Score' `
    -Explanation 'Credit Agent uses LLM to analyze on-chain history and assign a risk tier.' `
    -Highlight @('"creditScore"', '"tier"', '"reasoning"', '"limit"', '"decision"')

# ── STEP 5: ML Default Prediction ──
Write-Title "5/10" "ML DEFAULT PREDICTION" "Logistic regression predicts loan default probability"
Invoke-Demo -Method GET -Path "/api/credit/$borrower/default-prediction" `
    -Label 'Default Risk Prediction' `
    -Explanation 'ML model with 7 features. Risk >60% auto-blocks the loan BEFORE LLM evaluation.' `
    -Highlight @('"defaultProbability"', '"riskLevel"', '"features"', '"blocked"')

# ── STEP 6: ZK Credit Proof ──
Write-Title "6/10" "ZK CREDIT PROOFS" "Prove credit tier WITHOUT revealing exact score"
Invoke-Demo -Method POST -Path "/api/credit/$borrower/zk-proof" `
    -Label 'Generate ZK Proof (score >= tier threshold)' `
    -Explanation 'SHA-256 commitment + Fiat-Shamir range proof. Verifier learns ONLY that score qualifies.' `
    -Highlight @('"verified"', '"tier"', '"commitment"', '"proof"', '"threshold"')

# ── STEP 7: Lending — Borrow ──
Write-Title "7/10" "AUTONOMOUS LENDING" "Credit Agent approves and disburses loans"
Invoke-Demo -Method POST -Path "/api/credit/$borrower/borrow" `
    -Label 'Borrow 1000 USDt' `
    -Explanation 'Agent decides autonomously: evaluates score -> assigns tier -> sets APR -> disburses.' `
    -Body @{ amount = 1000 } `
    -Highlight @('"approved"', '"loanId"', '"amount"', '"interestRate"', '"tier"')

# ── STEP 8: Inter-Agent Lending ──
Write-Title "8/10" "INTER-AGENT LENDING" "Credit Agent borrows capital from Treasury Agent"
Write-Explain "EventBus-decoupled: credit:capital_request -> treasury:capital_allocated"
Invoke-Demo -Method POST -Path '/api/inter-agent/request-capital' `
    -Label 'Credit Agent requests 500K capital from Treasury' `
    -Explanation 'Treasury Agent evaluates: caps at 20% of balance, approves/rejects via EventBus.' `
    -Body @{ amount = 500000; reason = "Lending pool expansion for new borrowers" } `
    -Highlight @('"allocated"', '"amount"', '"poolBalance"', '"activeLoans"')

# ── STEP 9: Yield Harvest + Auto Debt Service ──
Write-Title "9/10" "YIELD -> AUTO DEBT REPAYMENT" "Revenue from yield auto-repays inter-agent loans"
Invoke-Demo -Method POST -Path '/api/inter-agent/harvest' `
    -Label 'Trigger Yield Harvest + Debt Service' `
    -Explanation 'Treasury harvests accrued yield, then auto-repays outstanding inter-agent loans (oldest first).' `
    -Highlight @('"harvested"', '"repaid"', '"totalRepaid"', '"remainingRevenue"', '"servicedLoans"')

# Show inter-agent state after
Start-Sleep 1
Invoke-Demo -Method GET -Path '/api/inter-agent/lending' `
    -Label 'Inter-Agent Lending Status (post-harvest)' `
    -Explanation 'Shows pool status, active loans, and total capital flow between agents.' `
    -Highlight @('"activeLoans"', '"totalAllocated"', '"totalRepaid"')

# ── STEP 10: Yield Opportunities ──
Write-Title "10/10" "YIELD OPTIMIZATION" "Treasury Agent scans DeFi for best returns"
Invoke-Demo -Method GET -Path '/api/yield/opportunities' `
    -Label 'Available Yield Opportunities' `
    -Explanation 'Agent autonomously evaluates Aave, Lido, Compound — invests idle capital for max yield.' `
    -Highlight @('"protocol"', '"apy"', '"risk"', '"tvl"')

# Show recent decisions
Start-Sleep 1
Invoke-Demo -Method GET -Path '/api/decisions' `
    -Label 'Recent Agent Decisions' `
    -Explanation 'Full audit trail: every decision both agents made, with LLM reasoning.' `
    -Highlight @('"agent"', '"action"', '"reasoning"', '"timestamp"')

# ═══════════════════════════════════════════════════════════════
#                    DEMO COMPLETE
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "║       Demo Complete — All 11/11 Lending Bot Requirements         ║" -ForegroundColor White
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "║  MUST-HAVES:                                                     ║" -ForegroundColor Green
Write-Host "║   ✓ Autonomous lending decisions (no human prompts)              ║" -ForegroundColor White
Write-Host "║   ✓ On-chain USDt settlement (Arbitrum One mainnet)              ║" -ForegroundColor White
Write-Host "║   ✓ Auto repayment tracking + default detection                  ║" -ForegroundColor White
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "║  NICE-TO-HAVES:                                                  ║" -ForegroundColor Green
Write-Host "║   ✓ On-chain credit scoring (7-factor formula)                   ║" -ForegroundColor White
Write-Host "║   ✓ LLM negotiates loan terms (Groq LLaMA 3.3 70B)             ║" -ForegroundColor White
Write-Host "║   ✓ Capital reallocation to yield opportunities                  ║" -ForegroundColor White
Write-Host "║   ✓ Undercollateralized lending via credit score                 ║" -ForegroundColor White
Write-Host "║   ✓ Inter-agent capital lending (EventBus)                       ║" -ForegroundColor White
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "║  BONUSES:                                                        ║" -ForegroundColor Green
Write-Host "║   ✓ ML default prediction (logistic regression)                  ║" -ForegroundColor White
Write-Host "║   ✓ ZK credit proofs (range proof, Fiat-Shamir)                 ║" -ForegroundColor White
Write-Host "║   ✓ Yield revenue auto-services inter-agent debt                 ║" -ForegroundColor White
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "║  TECH: WDK + OpenClaw + Solidity + Groq + React + WebSocket     ║" -ForegroundColor DarkGray
Write-Host "║  LIVE: agent-treasury.pages.dev | treasury.proceedgate.dev       ║" -ForegroundColor DarkGray
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
