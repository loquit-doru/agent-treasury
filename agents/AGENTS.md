# AGENTS — AgentTreasury Agent Roster

## Active Agents

### Treasury Agent
- **Role**: Manages DAO treasury funds — deposits, withdrawals, yield optimization
- **Wallet**: WDK-managed EVM wallet (Sepolia testnet)
- **Contracts**: TreasuryVault.sol
- **Skill file**: `treasury/SKILL.md`

### Credit Agent
- **Role**: On-chain credit scoring and micro-lending
- **Data source**: Real on-chain transaction history
- **Contracts**: CreditLine.sol
- **Skill file**: `credit/SKILL.md`

## Communication Pattern
- Agents communicate via EventBus (pub/sub)
- Treasury Agent listens for `credit:loan_requested` → verifies funds → disburses
- Credit Agent listens for `credit:evaluate_requested` → scores → updates on-chain
- Both emit decisions that feed the real-time dashboard

## Constraints
- All write operations go through WDK `sendTransaction()`
- Maximum daily volume: 10,000 USDt
- Maximum single transaction: 1,000 USDt
- Emergency pause available to Guardian role
