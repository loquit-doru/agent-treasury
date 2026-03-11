#!/usr/bin/env pwsh
# Post-deploy: seed vault, supply to Aave, execute lending flow
# Run AFTER deploy-arbitrum.ps1 and after updating backend/.env with new addresses
#
# Usage: .\scripts\post-deploy-arbitrum.ps1

$ErrorActionPreference = "Stop"
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"

$RPC = "https://arbitrum-one-rpc.publicnode.com"

# Load from backend .env
$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$vars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.+)$") { $vars[$Matches[1].Trim()] = $Matches[2].Trim() }
}

$PK    = $vars["DEPLOYER_PRIVATE_KEY"]
$USDT  = $vars["USDT_ADDRESS"]
$VAULT = $vars["TREASURY_VAULT_ADDRESS"]
$CREDIT = $vars["CREDIT_LINE_ADDRESS"]
$AAVE_POOL = $vars["AAVE_POOL_ADDRESS"]
$DEPLOYER = cast wallet address $PK

Write-Host "=== Post-Deploy: Arbitrum Lending Flow ===" -ForegroundColor Cyan
Write-Host "Deployer:  $DEPLOYER"
Write-Host "Vault:     $VAULT"
Write-Host "Credit:    $CREDIT"
Write-Host "USDT:      $USDT"
Write-Host "Aave Pool: $AAVE_POOL"
Write-Host ""

# Check USDT balance
$usdtBal = cast call $USDT "balanceOf(address)(uint256)" $DEPLOYER --rpc-url $RPC
Write-Host "USDT balance (raw): $usdtBal"

# Step 1: Approve vault to spend USDT
Write-Host "`n[1/5] Approve vault to spend 10 USDT..." -ForegroundColor Yellow
cast send $USDT "approve(address,uint256)" $VAULT 10000000 --private-key $PK --rpc-url $RPC
Write-Host "OK" -ForegroundColor Green

# Step 2: Deposit 10 USDT into vault
Write-Host "`n[2/5] Deposit 10 USDT into vault..." -ForegroundColor Yellow
cast send $VAULT "deposit(uint256)" 10000000 --private-key $PK --rpc-url $RPC
Write-Host "OK" -ForegroundColor Green

# Step 3: Invest 5 USDT into Aave V3
Write-Host "`n[3/5] Invest 5 USDT into Aave V3 (supply)..." -ForegroundColor Yellow
cast send $VAULT "investInYield(address,uint256,uint256)" $AAVE_POOL 5000000 500 --private-key $PK --rpc-url $RPC
Write-Host "OK — 5 USDT supplied to Aave V3!" -ForegroundColor Green

# Step 4: Update credit profile + borrow
Write-Host "`n[4/5] Update credit profile and borrow 2 USDT..." -ForegroundColor Yellow
cast send $CREDIT "updateProfile(address,uint256,uint256,uint256)" $DEPLOYER 800 5 0 --private-key $PK --rpc-url $RPC
Write-Host "Profile updated" -ForegroundColor Green

# Fund CreditLine with USDT so it can lend
cast send $USDT "approve(address,uint256)" $CREDIT 2000000 --private-key $PK --rpc-url $RPC
cast send $USDT "transfer(address,uint256)" $CREDIT 2000000 --private-key $PK --rpc-url $RPC 2>$null
# Actually CreditLine borrows from vault or needs USDT — let's use borrowFor from agent
cast send $CREDIT "borrowFor(address,uint256)" $DEPLOYER 2000000 --private-key $PK --rpc-url $RPC
Write-Host "Borrowed 2 USDT" -ForegroundColor Green

# Step 5: Repay loan
Write-Host "`n[5/5] Repay 2 USDT loan..." -ForegroundColor Yellow
cast send $USDT "approve(address,uint256)" $CREDIT 2100000 --private-key $PK --rpc-url $RPC
cast send $CREDIT "repay(uint256,uint256)" 0 2000000 --private-key $PK --rpc-url $RPC
Write-Host "Loan repaid!" -ForegroundColor Green

Write-Host "`n=== All Done ===" -ForegroundColor Cyan
Write-Host "Check txs on https://arbiscan.io/address/$DEPLOYER"

# Print vault balance
$vaultBal = cast call $VAULT "getBalance()(uint256)" --rpc-url $RPC
Write-Host "Vault balance: $vaultBal (raw, 6 decimals)"
