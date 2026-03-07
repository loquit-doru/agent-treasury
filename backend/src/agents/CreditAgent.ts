/**
 * CreditAgent - On-chain credit scoring and lending
 * Uses WDK for wallet operations, ethers for contract reads
 */

import { ethers } from 'ethers';
import type WDK from '@tetherto/wdk';
import OpenAI from 'openai';
import EventBus from '../orchestrator/EventBus';
import logger from '../utils/logger';
import {
  AgentStatus,
  AgentDecision,
  CreditProfile,
  CreditHistory,
  Loan,
  AgentConfig,
  CreditTier,
} from '../types';

// LLM Configuration
const CREDIT_SYSTEM_PROMPT = `You are the Credit Agent for AgentTreasury, an autonomous DAO CFO system.

Your role:
- Evaluate on-chain credit profiles for DeFi borrowers
- Score wallets 0-1000 based on tx history, volume, age, and repayment
- Make binary APPROVE/DECLINE decisions on borrow requests
- Protect the treasury from over-extension and defaults

Your personality:
- Fair but cautious: give credit where earned, deny when risk is high
- Data-driven: cite specific numbers from the profile
- Protective: treasury capital preservation is your #1 concern
- Concise: keep reasoning to 1-3 sentences

Always respond in valid JSON matching the requested schema.`;

// Contract ABIs (simplified)
const CREDIT_LINE_ABI = [
  'function updateProfile(address user, uint256 transactionCount, uint256 volumeUSD, uint256 accountAge, uint256 repaidLoans, uint256 defaults)',
  'function borrow(uint256 amount)',
  'function repay(uint256 loanId, uint256 amount)',
  'function markDefaulted(uint256 loanId)',
  'function calculateInterest(uint256 loanId) view returns (uint256)',
  'function getAmountDue(uint256 loanId) view returns (uint256)',
  'function getActiveLoans(address user) view returns (uint256[])',
  'function profiles(address) view returns (uint256 score, uint256 limit, uint256 rate, uint256 borrowed, uint256 repaid, uint256 defaults, uint256 lastUpdated, uint256 transactionCount, uint256 volumeUSD, uint256 accountAge, uint256 repaidLoans, bool exists)',
  'function loans(uint256) view returns (address borrower, uint256 principal, uint256 interestRate, uint256 borrowedAt, uint256 dueDate, uint256 repaid, bool active)',
  'function loanCount() view returns (uint256)',
  'event ProfileUpdated(address indexed user, uint256 score, uint256 limit, uint256 rate)',
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interestRate, uint256 dueDate)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interest)',
  'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 amount)',
];

// Credit tiers
const CREDIT_TIERS: CreditTier[] = [
  { minScore: 800, limit: ethers.parseUnits('5000', 6).toString(), rate: 500, name: 'Excellent' },
  { minScore: 600, limit: ethers.parseUnits('2000', 6).toString(), rate: 1000, name: 'Good' },
  { minScore: 0, limit: ethers.parseUnits('500', 6).toString(), rate: 1500, name: 'Poor' },
];

export class CreditAgent {
  private status: AgentStatus = 'idle';
  private provider: ethers.Provider;
  private wdkAccount: any;
  private creditContract: ethers.Contract;
  private openai: OpenAI;
  private config: AgentConfig;
  private profiles: Map<string, CreditProfile> = new Map();
  private loans: Map<number, Loan> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private decisionMemory: Array<{ role: string; action: string; reasoning: string; timestamp: number }> = [];

  constructor(
    config: AgentConfig,
    provider: ethers.Provider,
    _wdk: WDK,
    wdkAccount: any,
  ) {
    this.config = config;
    this.provider = provider;
    this.wdkAccount = wdkAccount;
    
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Read-only contract handle; writes go through WDK
    this.creditContract = new ethers.Contract(
      config.creditLineAddress,
      CREDIT_LINE_ABI,
      provider
    );

    this.setupEventListeners();
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    logger.info('CreditAgent starting...');
    this.status = 'active';

    // Sync existing data
    await this.syncLoans();

    // Start monitoring loop
    this.monitoringInterval = setInterval(
      () => this.monitor(),
      60000 // 60 seconds
    );

    EventBus.emitEvent('agent:started', 'credit', {
      creditLine: this.config.creditLineAddress,
    });

    logger.info('CreditAgent started successfully');
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    logger.info('CreditAgent stopping...');
    this.status = 'idle';

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    EventBus.emitEvent('agent:stopped', 'credit', {});
    logger.info('CreditAgent stopped');
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Main monitoring loop
   */
  private async monitor(): Promise<void> {
    if (this.status !== 'active') return;

    try {
      // Check for due loans
      await this.checkDueLoans();

      // Sync loan data
      await this.syncLoans();
    } catch (error) {
      logger.error('Monitor loop error', { error });
      this.status = 'error';
    }
  }

  /**
   * Evaluate credit for a user
   */
  async evaluateCredit(address: string): Promise<CreditProfile> {
    try {
      logger.info(`Evaluating credit for ${address}`);

      // Fetch on-chain history
      const history = await this.fetchCreditHistory(address);

      // Calculate base score
      const baseScore = this.calculateBaseScore(history);

      // Use LLM for enhanced analysis
      const llmAnalysis = await this.analyzeWithLLM(address, history, baseScore);

      // Final score
      const finalScore = Math.min(Math.max(baseScore + llmAnalysis.adjustment, 0), 1000);

      // Determine tier
      const tier = this.getTier(finalScore);

      const profile: CreditProfile = {
        address,
        score: finalScore,
        limit: tier.limit,
        rate: tier.rate,
        borrowed: '0',
        available: tier.limit,
        lastUpdated: Date.now(),
        exists: true,
      };

      // Update on-chain profile
      await this.updateOnChainProfile(address, history, profile);

      // Store locally
      this.profiles.set(address.toLowerCase(), profile);

      // Emit decision
      const decision: AgentDecision = {
        id: `credit-${Date.now()}`,
        agentType: 'credit',
        timestamp: Date.now(),
        action: 'evaluate_credit',
        reasoning: llmAnalysis.reasoning,
        data: { address, score: finalScore, tier: tier.name },
        status: 'executed',
      };

      EventBus.emitEvent('credit:profile_updated', 'credit', decision);

      logger.info(`Credit evaluation complete for ${address}`, {
        score: finalScore,
        tier: tier.name,
      });

      return profile;
    } catch (error) {
      logger.error(`Credit evaluation failed for ${address}`, { error });
      throw error;
    }
  }

  /**
   * Fetch credit history from blockchain (real on-chain data)
   */
  async fetchCreditHistory(address: string): Promise<CreditHistory> {
    try {
      // Real on-chain data
      const [txCount, balance] = await Promise.all([
        this.provider.getTransactionCount(address),
        this.provider.getBalance(address),
      ]);

      // Check existing profile on contract
      let repaidLoans = 0;
      let defaults = 0;
      try {
        const profile = await this.creditContract.profiles(address);
        if (profile.exists) {
          repaidLoans = Number(profile.repaidLoans);
          defaults = Number(profile.defaults);
        }
      } catch {
        // No existing profile
      }

      // Estimate account age from first block interaction
      // (simplified: use tx count as proxy for Sepolia testnet)
      const accountAge = Math.min(txCount * 2, 730); // rough estimate in days

      // Volume estimate from balance (ETH → USD rough conversion for scoring)
      const ethBalance = Number(ethers.formatEther(balance));
      const volumeUSD = Math.floor(ethBalance * 2500); // rough ETH/USD

      return {
        transactionCount: txCount,
        volumeUSD,
        accountAge,
        repaidLoans,
        defaults,
      };
    } catch (error) {
      logger.error(`Failed to fetch credit history for ${address}`, { error });
      return {
        transactionCount: 0,
        volumeUSD: 0,
        accountAge: 0,
        repaidLoans: 0,
        defaults: 0,
      };
    }
  }

  /**
   * Calculate base credit score
   * Formula:
   * - Base: 500
   * - + min(txCount * 2, 200)
   * - + min(volumeUSD / 100, 150)
   * - + repaidLoans * 100
   * - + min(accountAge / 10, 50)
   * - - defaults * 200
   */
  calculateBaseScore(history: CreditHistory): number {
    let score = 500;

    // Positive factors
    score += Math.min(history.transactionCount * 2, 200);
    score += Math.min(Math.floor(history.volumeUSD / 100), 150);
    score += history.repaidLoans * 100;
    score += Math.min(Math.floor(history.accountAge / 10), 50);

    // Negative factors
    score -= history.defaults * 200;

    return Math.min(Math.max(score, 0), 1000);
  }

  /**
   * Analyze with LLM for enhanced scoring
   */
  async analyzeWithLLM(
    address: string,
    history: CreditHistory,
    baseScore: number
  ): Promise<{ adjustment: number; reasoning: string }> {
    try {
      const memoryContext = this.decisionMemory.slice(-5)
        .map(m => `[${new Date(m.timestamp).toISOString()}] ${m.action}: ${m.reasoning}`)
        .join('\n');

      const prompt = `Analyze this wallet's creditworthiness.

Wallet: ${address}
On-Chain History:
- Transaction Count: ${history.transactionCount}
- Total Volume: $${history.volumeUSD.toLocaleString()}
- Account Age: ${history.accountAge} days
- Repaid Loans: ${history.repaidLoans}
- Defaults: ${history.defaults}

Base Score: ${baseScore}/1000

Credit Tiers:
- 800+: Excellent (5k USDt, 5% APR)
- 600-799: Good (2k USDt, 10% APR)
- <600: Poor (500 USDt, 15% APR)

${memoryContext ? `Recent Decisions:\n${memoryContext}\n` : ''}
Respond in JSON: {"adjustment": <-50 to +50>, "reasoning": "<1-3 sentences>"}`;

      const response = await this.openai.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: CREDIT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      const json = JSON.parse(content.replace(/```json?\n?|```/g, ''));

      const adjustment = Math.min(Math.max(json.adjustment || 0, -50), 50);
      const reasoning = json.reasoning || 'Score based on on-chain activity analysis.';

      this.remember('credit_analysis', reasoning);

      return { adjustment, reasoning };
    } catch (error) {
      logger.error('LLM analysis error', { error });
      // Deterministic fallback with descriptive reasoning
      let reasoning = `Base score ${baseScore} used (LLM unavailable). `;
      if (history.defaults > 0) reasoning += `Warning: ${history.defaults} default(s) on record. `;
      if (history.repaidLoans > 0) reasoning += `Positive: ${history.repaidLoans} repaid loan(s). `;
      if (history.transactionCount > 50) reasoning += `Active wallet (${history.transactionCount} txs). `;
      return { adjustment: 0, reasoning: reasoning.trim() };
    }
  }

  /**
   * Get credit tier for score
   */
  getTier(score: number): CreditTier {
    for (const tier of CREDIT_TIERS) {
      if (score >= tier.minScore) {
        return tier;
      }
    }
    return CREDIT_TIERS[CREDIT_TIERS.length - 1];
  }

  /**
   * Update on-chain credit profile via WDK
   */
  async updateOnChainProfile(
    address: string,
    history: CreditHistory,
    _profile: CreditProfile
  ): Promise<void> {
    try {
      const iface = new ethers.Interface(CREDIT_LINE_ABI);
      const data = iface.encodeFunctionData('updateProfile', [
        address,
        history.transactionCount,
        history.volumeUSD,
        history.accountAge,
        history.repaidLoans,
        history.defaults,
      ]);

      const { hash } = await this.wdkAccount.sendTransaction({
        to: this.config.creditLineAddress,
        value: '0',
        data,
      });

      logger.info(`On-chain profile updated for ${address}`, { hash });
    } catch (error) {
      logger.error(`Failed to update on-chain profile for ${address}`, { error });
      // Don't throw — profile evaluation can still succeed without on-chain write
    }
  }

  /**
   * Process borrow request
   */
  async processBorrow(address: string, amount: bigint): Promise<Loan | null> {
    try {
      logger.info(`Processing borrow request from ${address}`, {
        amount: amount.toString(),
      });

      // Get or evaluate credit profile
      let profile = this.profiles.get(address.toLowerCase());
      
      if (!profile) {
        profile = await this.evaluateCredit(address);
      }

      // Check available credit
      const available = BigInt(profile.available);
      
      if (amount > available) {
        logger.warn(`Borrow request exceeds credit limit`, {
          address,
          requested: amount.toString(),
          available: available.toString(),
        });
        return null;
      }

      // Use LLM to evaluate borrow request
      const shouldApprove = await this.evaluateBorrowRequest(address, amount, profile);

      if (!shouldApprove) {
        logger.info(`Borrow request declined by agent`, { address });
        return null;
      }

      // Execute on-chain borrow via WDK
      const iface = new ethers.Interface(CREDIT_LINE_ABI);
      const callData = iface.encodeFunctionData('borrow', [amount]);

      let txHash: string | undefined;
      try {
        const result = await this.wdkAccount.sendTransaction({
          to: this.config.creditLineAddress,
          value: '0',
          data: callData,
        });
        txHash = result.hash;
      } catch (err) {
        logger.error('On-chain borrow tx failed', { err });
        // Don't block — loan can still be tracked off-chain for demo
      }

      // Build Loan object
      const now = Math.floor(Date.now() / 1000);
      const dueDate = now + 30 * 86400; // 30 days
      const loanId = this.loans.size;
      const loan: Loan = {
        id: loanId,
        borrower: address,
        principal: amount.toString(),
        interestRate: profile.rate,
        borrowedAt: now,
        dueDate,
        repaid: '0',
        interest: '0',
        totalDue: amount.toString(),
        active: true,
      };
      this.loans.set(loanId, loan);

      // Update profile available credit
      profile.borrowed = (BigInt(profile.borrowed) + amount).toString();
      profile.available = (BigInt(profile.limit) - BigInt(profile.borrowed)).toString();
      this.profiles.set(address.toLowerCase(), profile);

      const decision: AgentDecision = {
        id: `borrow-${Date.now()}`,
        agentType: 'credit',
        timestamp: Date.now(),
        action: 'approve_borrow',
        reasoning: `Approved borrow of ${ethers.formatUnits(amount, 6)} USDt based on credit score ${profile.score}`,
        data: { address, amount: amount.toString(), score: profile.score, loanId },
        txHash,
        status: 'executed',
      };

      EventBus.emitEvent('credit:borrow_approved', 'credit', decision);

      // Request treasury to disburse
      EventBus.emitEvent('treasury:disburse_requested', 'credit', {
        to: address,
        amount: amount.toString(),
        reason: 'loan_disbursement',
      });

      logger.info(`Borrow approved for ${address}`, { amount: amount.toString(), loanId });

      return loan;
    } catch (error) {
      logger.error(`Borrow processing failed for ${address}`, { error });
      return null;
    }
  }

  /**
   * Evaluate borrow request with LLM
   */
  async evaluateBorrowRequest(
    address: string,
    amount: bigint,
    profile: CreditProfile
  ): Promise<boolean> {
    try {
      const utilizationPct = BigInt(profile.limit) > 0n
        ? Number((BigInt(profile.borrowed) * 100n) / BigInt(profile.limit))
        : 0;

      const memoryContext = this.decisionMemory.slice(-3)
        .map(m => `[${new Date(m.timestamp).toISOString()}] ${m.action}: ${m.reasoning}`)
        .join('\n');

      const prompt = `Evaluate this borrow request.

Borrower: ${address}
Requested: ${ethers.formatUnits(amount, 6)} USDt
Credit Score: ${profile.score}/1000
Limit: ${ethers.formatUnits(profile.limit, 6)} USDt
Already Borrowed: ${ethers.formatUnits(profile.borrowed, 6)} USDt (${utilizationPct}% utilization)
Available: ${ethers.formatUnits(profile.available, 6)} USDt
Interest Rate: ${profile.rate / 100}%

${memoryContext ? `Recent Decisions:\n${memoryContext}\n` : ''}
Respond in JSON: {"decision": "APPROVE" or "DECLINE", "reasoning": "<1 sentence>"}`;

      const response = await this.openai.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: CREDIT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      const json = JSON.parse(content.replace(/```json?\n?|```/g, ''));

      const approved = json.decision?.toUpperCase() === 'APPROVE';
      this.remember(
        approved ? 'borrow_approved' : 'borrow_declined',
        json.reasoning || `${approved ? 'Approved' : 'Declined'} ${ethers.formatUnits(amount, 6)} USDt for ${address}`,
      );
      return approved;
    } catch (error) {
      logger.error('LLM borrow evaluation error', { error });
      // Deterministic fallback: approve if within available credit
      const approved = amount <= BigInt(profile.available);
      this.remember(
        approved ? 'borrow_approved' : 'borrow_declined',
        `[deterministic] ${approved ? 'Approved' : 'Declined'}: amount ${approved ? 'within' : 'exceeds'} available credit`,
      );
      return approved;
    }
  }

  /**
   * Process loan repayment via WDK
   */
  async processRepayment(loanId: number, amount: bigint): Promise<boolean> {
    try {
      logger.info(`Processing repayment for loan ${loanId}`, {
        amount: amount.toString(),
      });

      const iface = new ethers.Interface(CREDIT_LINE_ABI);
      const data = iface.encodeFunctionData('repay', [loanId, amount]);

      const { hash } = await this.wdkAccount.sendTransaction({
        to: this.config.creditLineAddress,
        value: '0',
        data,
      });

      // Recalculate borrower's credit
      const loan = await this.creditContract.loans(loanId);
      await this.evaluateCredit(loan.borrower);

      // Update local loan state
      const localLoan = this.loans.get(loanId);
      if (localLoan) {
        localLoan.repaid = (BigInt(localLoan.repaid) + amount).toString();
        const due = BigInt(localLoan.totalDue) - amount;
        localLoan.totalDue = (due > 0n ? due : 0n).toString();
        if (due <= 0n) localLoan.active = false;
      }

      const decision: AgentDecision = {
        id: `repay-${Date.now()}`,
        agentType: 'credit',
        timestamp: Date.now(),
        action: 'repay_loan',
        reasoning: `Repaid ${ethers.formatUnits(amount, 6)} USDt on loan #${loanId}`,
        data: { loanId, amount: amount.toString(), borrower: loan.borrower },
        txHash: hash,
        status: 'executed',
      };
      EventBus.emitEvent('credit:loan_repaid', 'credit', decision);

      logger.info(`Repayment processed for loan ${loanId}`, { hash });
      return true;
    } catch (error) {
      logger.error(`Repayment failed for loan ${loanId}`, { error });
      return false;
    }
  }

  /**
   * Check for due loans and mark defaults
   */
  async checkDueLoans(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);

      for (const [loanId, loan] of this.loans) {
        if (!loan.active) continue;

        if (now > loan.dueDate) {
          logger.warn(`Loan ${loanId} is past due, marking as defaulted`);
          
          const iface = new ethers.Interface(CREDIT_LINE_ABI);
          const data = iface.encodeFunctionData('markDefaulted', [loanId]);
          await this.wdkAccount.sendTransaction({
            to: this.config.creditLineAddress,
            value: '0',
            data,
          });
          
          EventBus.emitEvent('credit:loan_defaulted', 'credit', {
            loanId,
            borrower: loan.borrower,
            amount: loan.principal,
          });
        }
      }
    } catch (error) {
      logger.error('Due loan check failed', { error });
    }
  }

  /**
   * Sync loans from blockchain
   */
  async syncLoans(): Promise<void> {
    try {
      let loanCount: number;
      try {
        loanCount = Number(await this.creditContract.loanCount());
      } catch {
        loanCount = 0;
      }

      if (loanCount === 0) return;

      for (let i = 0; i < Math.min(loanCount, 100); i++) {
        try {
          const loan = await this.creditContract.loans(i);
          
          if (loan.borrower !== ethers.ZeroAddress) {
            const [interest, totalDue] = await Promise.all([
              this.creditContract.calculateInterest(i),
              this.creditContract.getAmountDue(i),
            ]);

            this.loans.set(i, {
              id: i,
              borrower: loan.borrower,
              principal: loan.principal.toString(),
              interestRate: Number(loan.interestRate),
              borrowedAt: Number(loan.borrowedAt),
              dueDate: Number(loan.dueDate),
              repaid: loan.repaid.toString(),
              interest: interest.toString(),
              totalDue: totalDue.toString(),
              active: loan.active,
            });
          }
        } catch {
          // Loan might not exist
        }
      }
    } catch (error) {
      logger.error('Loan sync failed', { error });
    }
  }

  /**
   * Get all cached credit profiles
   */
  getProfiles(): CreditProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get user's credit profile (reads from contract's public mapping)
   */
  async getProfile(address: string): Promise<CreditProfile | null> {
    const cached = this.profiles.get(address.toLowerCase());
    if (cached) return cached;

    try {
      const p = await this.creditContract.profiles(address);
      
      if (!p.exists) return null;

      const borrowed = BigInt(p.borrowed);
      const limit = BigInt(p.limit);

      const profile: CreditProfile = {
        address,
        score: Number(p.score),
        limit: p.limit.toString(),
        rate: Number(p.rate),
        borrowed: p.borrowed.toString(),
        available: (limit - borrowed).toString(),
        lastUpdated: Number(p.lastUpdated),
        exists: true,
      };

      this.profiles.set(address.toLowerCase(), profile);
      return profile;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user's active loans
   */
  async getUserLoans(address: string): Promise<Loan[]> {
    try {
      const loanIds = await this.creditContract.getActiveLoans(address);
      const loans: Loan[] = [];

      for (const id of loanIds) {
        const loan = this.loans.get(Number(id));
        if (loan) {
          loans.push(loan);
        }
      }

      return loans;
    } catch (error) {
      logger.error(`Failed to get loans for ${address}`, { error });
      return [];
    }
  }

  /**
   * Get all active loans
   */
  getAllActiveLoans(): Loan[] {
    return Array.from(this.loans.values()).filter(l => l.active);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    EventBus.subscribe('credit:evaluate_requested', async (event) => {
      const address = event.payload.address as string;
      if (address) {
        await this.evaluateCredit(address);
      }
    });

    EventBus.subscribe('credit:borrow_requested', async (event) => {
      const { address, amount } = event.payload as { address: string; amount: string };
      if (address && amount) {
        await this.processBorrow(address, BigInt(amount));
      }
    });
  }

  /**
   * Store a decision in short-term memory (last 10 entries)
   */
  private remember(action: string, reasoning: string): void {
    this.decisionMemory.push({ role: 'credit', action, reasoning, timestamp: Date.now() });
    if (this.decisionMemory.length > 10) {
      this.decisionMemory.shift();
    }
  }

  /**
   * Get recent decisions
   */
  getRecentDecisions(limit: number = 10): AgentDecision[] {
    return EventBus.getRecentEvents(limit, 'credit') as unknown as AgentDecision[];
  }
}

export default CreditAgent;
