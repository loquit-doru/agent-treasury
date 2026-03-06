/**
 * AgentTreasury Core Types
 */

// Agent Types
export type AgentType = 'treasury' | 'credit' | 'yield';

export type AgentStatus = 'idle' | 'active' | 'error' | 'paused';

export interface AgentDecision {
  id: string;
  agentType: AgentType;
  timestamp: number;
  action: string;
  reasoning: string;
  data: Record<string, unknown>;
  txHash?: string;
  status: 'pending' | 'executed' | 'failed';
}

// Treasury Types
export interface TreasuryState {
  balance: string;
  dailyVolume: string;
  pendingTransactions: PendingTransaction[];
  yieldPositions: YieldPosition[];
  lastUpdated: number;
}

export interface PendingTransaction {
  txHash: string;
  to: string;
  amount: string;
  proposedAt: number;
  executeAfter: number;
  signatures: number;
  executed: boolean;
}

export interface YieldPosition {
  protocol: string;
  amount: string;
  apy: number;
  investedAt: number;
  harvested: string;
}

export interface YieldOpportunity {
  protocol: string;
  apy: number;
  tvl: string;
  risk: 'low' | 'medium' | 'high';
}

// Credit Types
export interface CreditProfile {
  address: string;
  score: number;
  limit: string;
  rate: number; // APR in basis points
  borrowed: string;
  available: string;
  lastUpdated: number;
  exists: boolean;
}

export interface CreditHistory {
  transactionCount: number;
  volumeUSD: number;
  accountAge: number;
  repaidLoans: number;
  defaults: number;
}

export interface Loan {
  id: number;
  borrower: string;
  principal: string;
  interestRate: number;
  borrowedAt: number;
  dueDate: number;
  repaid: string;
  interest: string;
  totalDue: string;
  active: boolean;
}

export interface CreditTier {
  minScore: number;
  limit: string;
  rate: number;
  name: string;
}

// WDK Types
export interface WDKWallet {
  address: string;
  balance: string;
  chainId: number;
}

export interface WDKTransaction {
  to: string;
  value: string;
  data?: string;
  gasLimit?: string;
}

// Event Bus Types
export interface AgentEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  source: AgentType;
}

export type EventHandler = (event: AgentEvent) => void | Promise<void>;

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardData {
  treasury: TreasuryState;
  creditProfiles: CreditProfile[];
  activeLoans: Loan[];
  agentDecisions: AgentDecision[];
  agentStatus: Record<AgentType, AgentStatus>;
}

// Configuration Types
export interface AgentConfig {
  openaiApiKey: string;
  seedPhrase: string;
  rpcUrl: string;
  chainId: number;
  treasuryVaultAddress: string;
  creditLineAddress: string;
  usdtAddress: string;
  aavePoolAddress?: string;
}

// Risk Assessment
export interface RiskAssessment {
  score: number; // 0-100
  factors: RiskFactor[];
  recommendation: 'proceed' | 'caution' | 'reject';
}

export interface RiskFactor {
  name: string;
  impact: number; // -10 to +10
  description: string;
}

// Yield Strategy
export interface YieldStrategy {
  name: string;
  targetApy: number;
  maxExposure: number; // percentage of treasury
  protocols: string[];
  rebalanceThreshold: number; // percentage difference to trigger rebalance
}
