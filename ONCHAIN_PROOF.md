# On-Chain Proof — WDK Integration (Arbitrum One Mainnet)

> All transactions below are **real mainnet transactions** on Arbitrum One, executed through the **Tether WDK SDK** (`@tetherto/wdk` + `wdk-wallet-evm` + `wdk-protocol-lending-aave-evm`).

## WDK Wallet

| Field | Value |
|-------|-------|
| **Address** | [`0xcF341c10f9173B6Fa4814f7a84b64653C25bEBed`](https://arbiscan.io/address/0xcF341c10f9173B6Fa4814f7a84b64653C25bEBed) |
| **Created via** | `@tetherto/wdk` + `wdk-wallet-evm` (BIP-39 seed → WDK Account) |
| **Roles** | `AGENT_ROLE` + `EXECUTOR_ROLE` on both TreasuryVault and CreditLine |

## 1. Role Grants (RBAC Setup)

The deployer (`0xE9a30BCbdE263eBfebB24768a3f9642044a9804c`) granted on-chain roles to the WDK wallet:

| Role | Contract | Transaction |
|------|----------|-------------|
| `AGENT_ROLE` | TreasuryVault | [`0x26bb7311...`](https://arbiscan.io/tx/0x26bb7311729c8e50a7ffad327932c76781d4d8dd631d25c631a51d4432a6eb02) |
| `EXECUTOR_ROLE` | TreasuryVault | [`0x8ecf85df...`](https://arbiscan.io/tx/0x8ecf85df9f9a15f73a67b193052e044016d7da93305e27cb3d0fc4f2ed603ee3) |
| `AGENT_ROLE` | CreditLine | [`0x03ea9eb1...`](https://arbiscan.io/tx/0x03ea9eb141788f3cf12d96073186c63db5efa966273a7aa8d0d7468f8da02824) |
| `EXECUTOR_ROLE` | CreditLine | [`0x80902fa2...`](https://arbiscan.io/tx/0x80902fa26e34434b594f54ef8fa1bdf48c957cbbb086fe61743c36eec64a0d2e) |

## 2. WDK → Aave V3 Supply (End-to-End Proof)

The WDK wallet autonomously approved and supplied 0.5 USDt into Aave V3 on Arbitrum One — **zero ethers.js fallback**, 100% WDK SDK:

| Step | Action | Transaction |
|------|--------|-------------|
| **Approve** | USDt `approve(AavePool, 500000)` | [`0x46f7966b...`](https://arbiscan.io/tx/0x46f7966bd2055e22273e6d3870232a2e630612d57b8e629ea8225585fd9d4bdc) |
| **Supply** | Aave V3 `supply(USDt, 500000, onBehalfOf, 0)` | [`0x2cccf89d...`](https://arbiscan.io/tx/0x2cccf89dfe2c17599dd1644e8e92c265d8218c9e3f5d730fe61a871b4c6d7152) |

### Result

```
Before: USDt balance = 1.0, Aave collateral = $0.00
After:  USDt balance = 0.5, Aave collateral = $0.50

Health factor: uint256.max (no debt)
```

## 3. Smart Contracts

| Contract | Address | Verified |
|----------|---------|----------|
| **TreasuryVault** | [`0x5503e9d53592B7D896E135804637C1710bDD5A64`](https://arbiscan.io/address/0x5503e9d53592B7D896E135804637C1710bDD5A64) | ✅ |
| **CreditLine** | [`0x236AB6D30F70D7aB6c272aCB3b186D925Bcae1a0`](https://arbiscan.io/address/0x236AB6D30F70D7aB6c272aCB3b186D925Bcae1a0) | ✅ |

## How to Verify

1. **Click any TX link** above → opens Arbiscan with full transaction details
2. **Check the `from` address** → all WDK transactions originate from `0xcF341c10f9173B6Fa4814f7a84b64653C25bEBed`
3. **Check roles on-chain** → call `hasRole(AGENT_ROLE, 0xcF34...)` on TreasuryVault or CreditLine
4. **Check Aave position** → the WDK wallet has active supply position on Aave V3 Arbitrum

## WDK Packages Used

```json
{
  "@tetherto/wdk": "1.0.0-beta.6",
  "wdk-wallet-evm": "1.0.0-beta.8",
  "wdk-protocol-lending-aave-evm": "1.0.0-beta.3"
}
```

## Code Path

All write transactions flow through WDK as primary signer:

```
Agent Decision (LLM) → TransactionService.executeWrite()
  → WDK Account.sendTransaction() [primary]
  → ethers.js Wallet.sendTransaction() [fallback only if WDK unavailable]
```

Source files:
- `backend/src/services/wdk.ts` — WDK initialization + account export
- `backend/src/services/TransactionService.ts` — WDK-first write execution
- `backend/src/agents/TreasuryAgent.ts` — Aave supply via WDK + AaveProtocolEvm
