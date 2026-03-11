#!/usr/bin/env pwsh
# Deploy TreasuryVault + CreditLine on Arbitrum One (mainnet)
# Prerequisites: DEPLOYER wallet needs ETH on Arbitrum for gas

$ErrorActionPreference = "Stop"

# Ensure foundry in PATH
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"

# Load private key from backend .env
$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$lines = Get-Content $envFile
foreach ($line in $lines) {
    if ($line -match "^DEPLOYER_PRIVATE_KEY=(.+)$") { $env:DEPLOYER_PRIVATE_KEY = $Matches[1].Trim() }
}

# Arbitrum One addresses
$env:USDT_ADDRESS      = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"   # USDT on Arbitrum
$env:AAVE_POOL_ADDRESS = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"   # Aave V3 Pool
$env:ARBITRUM_RPC_URL   = "https://arbitrum-one-rpc.publicnode.com"

# Derive agent address from deployer key
$deployerAddr = cast wallet address $env:DEPLOYER_PRIVATE_KEY
$env:AGENT_ADDRESS = $deployerAddr

Write-Host "=== Arbitrum One Deployment ===" -ForegroundColor Cyan
Write-Host "Deployer/Agent: $deployerAddr"
Write-Host "USDT:           $($env:USDT_ADDRESS)"
Write-Host "Aave Pool:      $($env:AAVE_POOL_ADDRESS)"
Write-Host ""

# Check balance
$bal = cast balance $deployerAddr --rpc-url $env:ARBITRUM_RPC_URL --ether 2>&1
Write-Host "ETH Balance: $bal"
if ([decimal]$bal -lt 0.0005) {
    Write-Host "ERROR: Insufficient ETH for gas. Send at least 0.001 ETH to $deployerAddr on Arbitrum." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deploying contracts..." -ForegroundColor Yellow

forge script contracts/script/Deploy.s.sol:Deploy `
    --rpc-url $env:ARBITRUM_RPC_URL `
    --broadcast `
    --slow `
    --verify `
    --verifier-url "https://api.arbiscan.io/api" `
    -vvv

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Update backend/.env with the deployed addresses above."
Write-Host "Set RPC_URL=https://arbitrum-one-rpc.publicnode.com"
Write-Host "Set CHAIN_ID=42161"
Write-Host "Set AAVE_POOL_ADDRESS=0x794a61358D6845594F94dc1DB02A252b5b4814aD"
