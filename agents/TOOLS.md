# TOOLS — Available MCP Tools

## WDK Tools (via wdk-mcp or direct SDK)

### Wallet Management
| Tool | Description |
|------|-------------|
| `create_seed` | Generate a new seed phrase |
| `get_seed` | Retrieve a stored seed |
| `create_wallet` | Create wallet from seed |
| `get_wallet` | Get wallet details |
| `get_balance` | Check token balance for an address |
| `send_transaction` | Send a signed transaction via WDK |

### DeFi Protocols (via WDK SDK)
| Tool | Description |
|------|-------------|
| `aave_supply` | Supply USDt to Aave lending pool |
| `aave_withdraw` | Withdraw USDt from Aave |
| `aave_get_reserve_data` | Get current APY and pool stats |

## Smart Contract Tools (via ethers.js ABI calls)

### TreasuryVault
| Tool | Description |
|------|-------------|
| `vault_get_balance` | Read treasury USDt balance |
| `vault_get_daily_volume` | Read current day's transaction volume |
| `vault_propose_withdrawal` | Propose a withdrawal (starts timelock) |
| `vault_sign_transaction` | Add signature to multi-sig withdrawal |
| `vault_execute_withdrawal` | Execute after timelock expires |
| `vault_invest_in_yield` | Send funds to approved yield protocol |
| `vault_emergency_pause` | Guardian: pause all operations |

### CreditLine
| Tool | Description |
|------|-------------|
| `credit_update_profile` | Update user's on-chain credit profile |
| `credit_get_profile` | Read user's credit score and limits |
| `credit_borrow` | User: initiate a borrow |
| `credit_repay` | User: repay an active loan |
| `credit_mark_defaulted` | Agent: mark overdue loan as defaulted |
| `credit_calculate_interest` | Read accrued interest for a loan |
| `credit_get_active_loans` | List a user's active loans |

## Blockchain Read Tools
| Tool | Description |
|------|-------------|
| `eth_get_transaction_count` | Get nonce / tx count for address |
| `eth_get_balance` | Get ETH balance |
| `eth_get_block` | Get latest block info |
