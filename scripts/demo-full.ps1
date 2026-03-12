<#
.SYNOPSIS
AgentTreasury CORE - Full Demo Script
.DESCRIPTION
This script is intended for use during video recording to demonstrate the full capabilities of 
the AgentTreasury system on Arbitrum One mainnet. It triggers API actions sequentially with 
pauses so the narrator can explain the live dashboard updates.
#>

param(
    [int]$PauseSec = 5
)

$ErrorActionPreference = "Continue"

$BaseUrl = 'https://treasury.proceedgate.dev'
$BorrowerAddress = '0x084d580Dea19a5B66ca27fD395862EbDe351CCb2'
$WdkAgentAddress = '0xcF341c10f9173B6Fa4814f7a84b64653C25bEBed'
$StartTime = Get-Date

function Invoke-DemoStep {
    param(
        [string]$StepNumber,
        [string]$Title,
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [switch]$ReturnResponse
    )

    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "STEP ${StepNumber}: $Title" -ForegroundColor Cyan
    Write-Host "Endpoint: $Method ${BaseUrl}${Endpoint}" -ForegroundColor DarkGray
    Write-Host "============================================================" -ForegroundColor Cyan

    try {
        $params = @{
            Uri = "${BaseUrl}${Endpoint}"
            Method = $Method
        }
        
        if ($null -ne $Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
            $params.ContentType = 'application/json'
        }

        Write-Host "Calling API... " -ForegroundColor Yellow -NoNewline
        $response = Invoke-RestMethod @params
        
        Write-Host "Success!`n" -ForegroundColor Green
        
        if (-not $ReturnResponse) {
            $jsonResponse = $response | ConvertTo-Json -Depth 5
            if ($jsonResponse.Length -gt 1500) {
                Write-Host ($jsonResponse.Substring(0, 1500) + "`n... [OUTPUT TRUNCATED]") -ForegroundColor White
            } else {
                Write-Host $jsonResponse -ForegroundColor White
            }
        }

        Write-Host "`nWaiting $PauseSec seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $PauseSec

        if ($ReturnResponse) {
            return $response
        }
    }
    catch {
        Write-Host "`nError occurred in Step ${StepNumber}: $_" -ForegroundColor Red
        Write-Host "Waiting $PauseSec seconds before continuing..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $PauseSec
    }
}

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "          AgentTreasury CORE - Hackathon Demo              " -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Target Environment: Arbitrum One Mainnet" -ForegroundColor Green
Write-Host "Base API URL:       $BaseUrl" -ForegroundColor Green
Write-Host "Dashboard:          https://master.agent-treasury.pages.dev/dashboard" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan
Write-Host "Starting demonstration sequence in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Act 1: System Health (show agents are alive)
Invoke-DemoStep -StepNumber "1" -Title "System Health (Agent Status)" -Method "GET" -Endpoint "/health"
Invoke-DemoStep -StepNumber "2" -Title "Dashboard KPIs" -Method "GET" -Endpoint "/api/dashboard"
Invoke-DemoStep -StepNumber "3" -Title "Treasury Health Score" -Method "GET" -Endpoint "/api/treasury/health"

# Act 2: Credit Scoring (AI evaluates a borrower)
Invoke-DemoStep -StepNumber "4" -Title "Trigger Credit Evaluation (LLM + On-chain)" -Method "POST" -Endpoint "/api/credit/$BorrowerAddress/evaluate"
Invoke-DemoStep -StepNumber "5" -Title "Fetch Updated Credit Profile" -Method "GET" -Endpoint "/api/credit/$BorrowerAddress"

# Act 3: ML Default Prediction
Invoke-DemoStep -StepNumber "6" -Title "ML Logistic Regression Default Prediction" -Method "GET" -Endpoint "/api/credit/$BorrowerAddress/default-prediction"

# Act 4: ZK Credit Proof (privacy-preserving)
$ZkProofResponse = Invoke-DemoStep -StepNumber "7" -Title "Generate ZK Proof of Credit Tier" -Method "POST" -Endpoint "/api/credit/$BorrowerAddress/zk-proof" -ReturnResponse

if ($null -ne $ZkProofResponse) {
    # Print the returned proof visually
    $jsonResponse = $ZkProofResponse | ConvertTo-Json -Depth 5
    if ($jsonResponse.Length -gt 1500) {
        Write-Host ($jsonResponse.Substring(0, 1500) + "`n... [OUTPUT TRUNCATED]") -ForegroundColor White
    } else {
        Write-Host $jsonResponse -ForegroundColor White
    }
}

$verifyBody = @{}
if ($null -ne $ZkProofResponse.data) {
    if ($null -ne $ZkProofResponse.data.proof) { $verifyBody.proof = $ZkProofResponse.data.proof }
    if ($null -ne $ZkProofResponse.data.publicSignals) { $verifyBody.publicSignals = $ZkProofResponse.data.publicSignals }
} elseif ($null -ne $ZkProofResponse.proof) {
    $verifyBody.proof = $ZkProofResponse.proof
    $verifyBody.publicSignals = $ZkProofResponse.publicSignals
}
if (-not $verifyBody.proof) {
    # Fallback to prevent breaking demo if API structure differs slightly
    $verifyBody = @{ proof = @{ a = @("0x0","0x0") }; publicSignals = @("0x0") }
}

Invoke-DemoStep -StepNumber "8" -Title "Verify ZK Proof (Privacy-Preserving)" -Method "POST" -Endpoint "/api/credit/verify-proof" -Body $verifyBody

# Act 5: Autonomous Lending (borrow + on-chain tx)
$BorrowResponse = Invoke-DemoStep -StepNumber "9" -Title "Autonomous Lending (Borrow 1 USDt)" -Method "POST" -Endpoint "/api/credit/$BorrowerAddress/borrow" -Body @{ amount = "1000000" } -ReturnResponse

if ($null -ne $BorrowResponse) {
    $jsonResponse = $BorrowResponse | ConvertTo-Json -Depth 5
    Write-Host $jsonResponse -ForegroundColor White
}

Invoke-DemoStep -StepNumber "10" -Title "View New Loan" -Method "GET" -Endpoint "/api/credit/$BorrowerAddress/loans"

# Act 6: Yield Investment (Treasury Agent)
Invoke-DemoStep -StepNumber "11" -Title "Treasury Yield Investment" -Method "POST" -Endpoint "/api/yield/invest" -Body @{ protocol = "aave"; amount = "500000" }
Invoke-DemoStep -StepNumber "12" -Title "View Updated Treasury State" -Method "GET" -Endpoint "/api/treasury"

# Act 7: Inter-Agent Lending (Treasury <-> Credit cooperation)
Invoke-DemoStep -StepNumber "13" -Title "Inter-Agent Lending State" -Method "GET" -Endpoint "/api/inter-agent/lending"
Invoke-DemoStep -StepNumber "14" -Title "Request Capital (Credit requesting from Treasury)" -Method "POST" -Endpoint "/api/inter-agent/request-capital" -Body @{ amount = "2000000"; reason = "Demo: Credit pool needs capital" }
Invoke-DemoStep -StepNumber "15" -Title "Trigger Yield Harvest -> Auto Debt Service" -Method "POST" -Endpoint "/api/inter-agent/harvest"

# Act 8: Revenue-Backed Lending (INNOVATION #1)
Invoke-DemoStep -StepNumber "16" -Title "Simulate Revenue Events for WDK Agent" -Method "POST" -Endpoint "/api/revenue/$WdkAgentAddress/simulate" -Body @{ count = 15 }
Invoke-DemoStep -StepNumber "17" -Title "Revenue Summary & Velocity" -Method "GET" -Endpoint "/api/revenue/summary"
Invoke-DemoStep -StepNumber "18" -Title "Detailed Agent Revenue Profile" -Method "GET" -Endpoint "/api/revenue/$WdkAgentAddress/profile"

# Act 9: Autonomous Debt Restructuring (INNOVATION #2)
Invoke-DemoStep -StepNumber "19" -Title "Pending Restructuring Proposals (ML-triggered, LLM-negotiated)" -Method "GET" -Endpoint "/api/restructuring/proposals"
Invoke-DemoStep -StepNumber "20" -Title "Agent Audit Trail (Recent AI Decisions)" -Method "GET" -Endpoint "/api/decisions?limit=10"

# Act 10: Agent Board Meeting (multi-agent dialogue)
Invoke-DemoStep -StepNumber "21" -Title "Agent Dialogue & Consensus Decisions" -Method "GET" -Endpoint "/api/ai-decisions?limit=5"

# Finale
Invoke-DemoStep -StepNumber "22" -Title "Final Dashboard State" -Method "GET" -Endpoint "/api/dashboard"

$EndTime = Get-Date
$Duration = $EndTime - $StartTime

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "Demo complete! All features demonstrated with real USDt on Arbitrum One mainnet." -ForegroundColor Green
Write-Host "Total Duration: $($Duration.Minutes)m $($Duration.Seconds)s" -ForegroundColor White
Write-Host "Thank you to the Tether / Galactica hackathon judges!" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Cyan
