/**
 * Frontend Types - mirrors backend/src/types/index.ts
 */

export type AgentType = 'treasury' | 'credit';
export type AgentStatus = 'idle' | 'active' | 'error' | 'paused';

export interface AgentStatusData {
  treasury: AgentStatus;
  credit: AgentStatus;
}

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

export interface CreditProfile {
  address: string;
  score: number;
  limit: string;
  rate: number;
  borrowed: string;
  available: string;
  lastUpdated: number;
  exists: boolean;
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

export interface DashboardData {
  treasury: TreasuryState;
  creditProfiles: CreditProfile[];
  activeLoans: Loan[];
  agentDecisions: AgentDecision[];
  agentStatus: Record<AgentType, AgentStatus>;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}
