<#
.SYNOPSIS
  OBS Screen Recording Guide — AgentTreasury CORE Demo
  
  This script prepares the environment for a manual OBS/ScreenPal/Loom recording.
  It opens all the windows you need, in the right order, so you just hit Record and narrate.

.NOTES
  Duration target: 2–3 minutes
  Narration text: see DEMO_SCRIPT.md
  
  Before running:
  1. Install OBS Studio (https://obsproject.com) or use Loom/ScreenPal
  2. Set resolution to 1920×1080 or 1280×720
  3. Make sure backend is running (npm run dev in backend/)

.USAGE
  .\scripts\obs-recording-guide.ps1
#>

$Host.UI.RawUI.WindowTitle = "AgentTreasury CORE — Demo Prep"
$base = "http://localhost:3001"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║  AgentTreasury CORE — OBS Recording Prep            ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Check backend ──
Write-Host "  [0] Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod "$base/health" -TimeoutSec 5
    Write-Host "      Backend OK: agents=$($health.agents.treasury)/$($health.agents.credit)" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Backend not running! Start it first:" -ForegroundColor Red
    Write-Host "        cd backend && npm run dev" -ForegroundColor Red
    exit 1
}

# ── Step 1: Open dashboard ──
Write-Host ""
Write-Host "  [1] Opening React Dashboard in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"
Start-Sleep -Seconds 2

# ── Step 2: Open live hosted dashboard (backup) ──
Write-Host "  [2] Opening live dashboard (agent-treasury.pages.dev)..." -ForegroundColor Yellow  
Start-Process "https://agent-treasury.pages.dev"
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "  ════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  RECORDING CHECKLIST:" -ForegroundColor White
Write-Host ""
Write-Host "  OBS Settings:" -ForegroundColor Cyan
Write-Host "    • Resolution: 1280×720 (or 1920×1080)"
Write-Host "    • FPS: 30"  
Write-Host "    • Audio: Desktop + Microphone"
Write-Host "    • Output: MKV or MP4"
Write-Host ""
Write-Host "  Windows to show:" -ForegroundColor Cyan
Write-Host "    1. React Dashboard (localhost:5173) — 30s intro"
Write-Host "    2. Terminal/Postman for API calls — main demo"
Write-Host "    3. Etherscan for tx verification — optional flex"
Write-Host ""
Write-Host "  ════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  NARRATION FLOW (from DEMO_SCRIPT.md):" -ForegroundColor White
Write-Host ""
Write-Host "  0:00  INTRO — Title + what it does (25s)" -ForegroundColor Green
Write-Host "          'AgentTreasury CORE — Autonomous CFO for DAOs'" 
Write-Host "          Show dashboard, explain 2 agents"
Write-Host ""
Write-Host "  0:25  ARCHITECTURE — Quick diagram (20s)" -ForegroundColor Green
Write-Host "          Treasury Agent + Credit Agent + EventBus"
Write-Host ""
Write-Host "  0:45  STEP 1 — System Health (10s)" -ForegroundColor Yellow
Write-Host "          curl localhost:3001/health"
Write-Host ""
Write-Host "  0:55  STEP 2 — Treasury State (15s)" -ForegroundColor Yellow
Write-Host "          curl localhost:3001/api/treasury"
Write-Host "          '50,000 USDt, Aave 4.2%, Compound 3.8%'"
Write-Host ""
Write-Host "  1:10  STEP 3 — Dashboard Tour (15s)" -ForegroundColor Yellow
Write-Host "          Switch to browser, scroll through dashboard"
Write-Host "          Agent timeline, yield chart, loan table"
Write-Host ""
Write-Host "  1:25  STEP 4 — Credit Scoring (20s)" -ForegroundColor Yellow
Write-Host "          curl -X POST localhost:3001/api/credit/.../evaluate"
Write-Host "          'Score 750, Good tier, 10% APR, fully autonomous'"
Write-Host ""
Write-Host "  1:45  STEP 5 — ML Default Prediction (15s)" -ForegroundColor Yellow
Write-Host "          curl localhost:3001/api/credit/.../default-prediction"
Write-Host "          '1.4% risk, low — auto-blocks above 60%'"
Write-Host ""
Write-Host "  2:00  STEP 6 — ZK Credit Proofs (15s)" -ForegroundColor Yellow
Write-Host "          curl -X POST localhost:3001/api/credit/.../zk-proof"
Write-Host "          'Zero-knowledge — verifier knows tier, not score'"
Write-Host ""
Write-Host "  2:15  STEP 7 — Autonomous Lending (15s)" -ForegroundColor Yellow
Write-Host "          curl -X POST localhost:3001/api/credit/.../borrow"
Write-Host "          '1000 USDt approved, on-chain, 30-day terms'"
Write-Host ""
Write-Host "  2:30  STEP 8 — Inter-Agent Lending (15s)" -ForegroundColor Yellow
Write-Host "          curl -X POST localhost:3001/api/inter-agent/request-capital"
Write-Host "          'Credit Agent borrows from Treasury via EventBus'"
Write-Host ""
Write-Host "  2:45  STEP 9 — Yield → Auto Repayment (15s)" -ForegroundColor Yellow
Write-Host "          curl -X POST localhost:3001/api/inter-agent/harvest"
Write-Host "          'Revenue auto-repays inter-agent debt'"
Write-Host ""
Write-Host "  3:00  CLOSING — 11/11 summary (20s)" -ForegroundColor Green
Write-Host "          '11 out of 11 Lending Bot requirements'"
Write-Host "          Show requirements grid"
Write-Host ""
Write-Host "  ════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# ── API commands ready to copy-paste ──
Write-Host "  COPY-PASTE API COMMANDS:" -ForegroundColor White
Write-Host ""

$addr = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
$cmds = @(
    "curl -s http://localhost:3001/health | python -m json.tool",
    "curl -s http://localhost:3001/api/treasury | python -m json.tool",
    "curl -s http://localhost:3001/api/dashboard | python -m json.tool",
    "curl -s -X POST http://localhost:3001/api/credit/$addr/evaluate | python -m json.tool",
    "curl -s http://localhost:3001/api/credit/$addr/default-prediction | python -m json.tool",
    "curl -s -X POST http://localhost:3001/api/credit/$addr/zk-proof | python -m json.tool",
    "curl -s -X POST -H 'Content-Type: application/json' -d '{`"amount`":`"1000`"}' http://localhost:3001/api/credit/$addr/borrow | python -m json.tool",
    "curl -s -X POST -H 'Content-Type: application/json' -d '{`"amount`":`"10000`"}' http://localhost:3001/api/inter-agent/request-capital | python -m json.tool",
    "curl -s -X POST http://localhost:3001/api/inter-agent/harvest | python -m json.tool",
    "curl -s http://localhost:3001/api/yield/opportunities | python -m json.tool"
)
for ($i=0; $i -lt $cmds.Count; $i++) {
    Write-Host "  Step $($i+1): " -ForegroundColor Cyan -NoNewline
    Write-Host $cmds[$i] -ForegroundColor Gray
}

Write-Host ""
Write-Host "  ════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Ready! Open OBS, hit Record, and follow the flow above." -ForegroundColor Green
Write-Host "  Narration text is in DEMO_SCRIPT.md" -ForegroundColor Green
Write-Host ""
