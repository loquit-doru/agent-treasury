/**
 * TreasuryAgent - Manages DAO treasury funds
 * Uses WDK for wallet operations and Aave lending
 */

import { ethers } from 'ethers';
import type WDK from '@tetherto/wdk';
import OpenAI from 'openai';
import EventBus from '../orchestrator/EventBus';
import { getAaveLending } from '../services/wdk';
import logger from '../utils/logger';
import {
  AgentStatus,
  AgentDecision,
  TreasuryState,
  YieldOpportunity,
  AgentConfig,
  RiskAssessment,
} from '../types';

// Contract ABIs (simplified)
const TREASURY_VAULT_ABI = [
  'function getBalance() view returns (uint256)',
  'function getCurrentDayVolume() view returns (uint256)',
  'function getPendingTransactions() view returns (bytes32[])',
  'function proposeWithdrawal(address to, uint256 amount) returns (bytes32)',
  'function signTransaction(bytes32 txHash)',
  'function executeWithdrawal(bytes32 txHash)',
  'function investInYield(address protocol, uint256 amount, uint256 apy)',
  'function harvestYield(address protocol, uint256 expectedAmount)',
  'function emergencyPause()',
  'function emergencyUnpause()',
  'function setProtocolAllowed(address protocol, bool allowed)',
  'event WithdrawProposed(bytes32 indexed txHash, address indexed to, uint256 amount, uint256 executeAfter)',
  'event WithdrawExecuted(bytes32 indexed txHash, address indexed to, uint256 amount)',
];

// Security constraints
const CONSTRAINTS = {
  MAX_DAILY_VOLUME: ethers.parseUnits('10000', 6), // 10k USDt
  MAX_SINGLE_TX: ethers.parseUnits('1000', 6),      // 1k USDt
  ALLOWED_PROTOCOLS: ['aave'],
  REBALANCE_THRESHOLD: 5, // 5% APY difference triggers rebalance
  MIN_YIELD_ALLOCATION: 10, // Min 10% of treasury in yield
  MAX_YIELD_ALLOCATION: 50, // Max 50% of treasury in yield
};

export class TreasuryAgent {
  private status: AgentStatus = 'idle';
  private provider: ethers.Provider;
  private wdkAccount: any; // WDK account type
  private vaultContract: ethers.Contract;
  private openai: OpenAI;
  private config: AgentConfig;
  private lastState: TreasuryState | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

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

    // Contracts still use ethers for ABI-level calls
    // WDK handles wallet/signing; ethers reads contract state
    this.vaultContract = new ethers.Contract(
      config.treasuryVaultAddress,
      TREASURY_VAULT_ABI,
      provider // read-only; writes go through WDK
    );

    this.setupEventListeners();
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    logger.info('TreasuryAgent starting...');
    this.status = 'active';

    // Initial state sync
    await this.syncState();

    // Start monitoring loop
    this.monitoringInterval = setInterval(
      () => this.monitor(),
      30000 // 30 seconds
    );

    // Emit startup event
    EventBus.emitEvent('agent:started', 'treasury', {
      address: this.wdkAccount.address ?? 'unknown',
      vault: this.config.treasuryVaultAddress,
    });

    logger.info('TreasuryAgent started successfully');
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    logger.info('TreasuryAgent stopping...');
    this.status = 'idle';

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    EventBus.emitEvent('agent:stopped', 'treasury', {});
    logger.info('TreasuryAgent stopped');
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Sync state from blockchain
   */
  async syncState(): Promise<TreasuryState> {
    try {
      const [balance, dailyVolume] = await Promise.all([
        this.vaultContract.getBalance(),
        this.vaultContract.getCurrentDayVolume(),
      ]);

      const state: TreasuryState = {
        balance: balance.toString(),
        dailyVolume: dailyVolume.toString(),
        pendingTransactions: [], // Would fetch from contract
        yieldPositions: [], // Would fetch from contract/storage
        lastUpdated: Date.now(),
      };

      this.lastState = state;
      return state;
    } catch (error) {
      logger.error('Failed to sync treasury state', { error });
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): TreasuryState | null {
    return this.lastState;
  }

  /**
   * Main monitoring loop
   */
  private async monitor(): Promise<void> {
    if (this.status !== 'active') return;

    try {
      await this.syncState();

      // Check yield opportunities
      await this.evaluateYieldOpportunities();

      // Check pending transactions
      await this.checkPendingTransactions();

      // Risk assessment
      await this.assessRisk();
    } catch (error) {
      logger.error('Monitor loop error', { error });
      this.status = 'error';
    }
  }

  /**
   * Evaluate and act on yield opportunities
   */
  async evaluateYieldOpportunities(): Promise<void> {
    try {
      const opportunities = await this.fetchYieldOpportunities();
      
      if (opportunities.length === 0) {
        logger.debug('No yield opportunities available');
        return;
      }

      // Use LLM to evaluate opportunities
      const bestOpportunity = await this.selectBestYieldStrategy(opportunities);
      
      if (!bestOpportunity) {
        logger.debug('No suitable yield opportunity found');
        return;
      }

      // Check if we should invest
      const balance = BigInt(this.lastState?.balance || '0');
      const minInvestment = ethers.parseUnits('100', 6); // Min 100 USDt

      if (balance < minInvestment) {
        logger.debug('Insufficient balance for yield farming');
        return;
      }

      // Calculate investment amount (30% of balance)
      const investmentAmount = (balance * BigInt(30)) / BigInt(100);

      if (investmentAmount < minInvestment) {
        logger.debug('Investment amount below minimum');
        return;
      }

      // Propose investment
      await this.proposeYieldInvestment(
        bestOpportunity.protocol,
        investmentAmount,
        bestOpportunity.apy
      );
    } catch (error) {
      logger.error('Yield evaluation error', { error });
    }
  }

  /**
   * Fetch yield opportunities — tries WDK Aave lending first, falls back gracefully.
   */
  async fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
    const opportunities: YieldOpportunity[] = [];

    try {
      const aave = getAaveLending(this.wdkAccount);
      if (aave) {
        // Attempt to read real reserve data via WDK lending protocol
        const reserveData = await (aave as any).getReserveData?.();
        if (reserveData?.liquidityRate) {
          const apy = Number(reserveData.liquidityRate) / 1e25; // ray → %
          opportunities.push({
            protocol: 'aave',
            apy,
            tvl: String(reserveData.totalATokenSupply ?? '0'),
            risk: 'low',
          });
          return opportunities;
        }
      }
    } catch (err) {
      logger.debug('WDK Aave data unavailable, using on-chain fallback', { err });
    }

    // Fallback: query Aave pool contract directly
    try {
      if (this.config.aavePoolAddress) {
        const poolAbi = [
          'function getReserveData(address asset) view returns (tuple(uint256 liquidityRate, uint128 totalATokenSupply) data)',
        ];
        const pool = new ethers.Contract(this.config.aavePoolAddress, poolAbi, this.provider);
        const data = await pool.getReserveData(this.config.usdtAddress);
        const apy = Number(data.liquidityRate) / 1e25;
        opportunities.push({
          protocol: 'aave',
          apy: Math.round(apy * 100) / 100,
          tvl: data.totalATokenSupply.toString(),
          risk: 'low',
        });
      }
    } catch (err) {
      logger.debug('On-chain Aave fallback also failed', { err });
    }

    return opportunities;
  }

  /**
   * Use LLM to select best yield strategy
   */
  async selectBestYieldStrategy(
    opportunities: YieldOpportunity[]
  ): Promise<YieldOpportunity | null> {
    try {
      const state = this.lastState;
      
      const prompt = `
You are a DeFi yield optimization expert. Analyze these yield opportunities and select the best one.

Current Treasury State:
- Balance: ${ethers.formatUnits(state?.balance || '0', 6)} USDt
- Daily Volume: ${ethers.formatUnits(state?.dailyVolume || '0', 6)} USDt

Yield Opportunities:
${opportunities.map(o => `
- ${o.protocol}: ${o.apy}% APY, TVL: $${o.tvl}, Risk: ${o.risk}
`).join('')}

Selection Criteria:
1. Higher APY is better
2. Lower risk is better
3. Higher TVL indicates stability
4. Diversification across protocols

Respond with ONLY the protocol name (aave or compound) or "none" if no opportunity is suitable.
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      });

      const selection = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (selection === 'none') {
        return null;
      }

      const selected = opportunities.find(o => o.protocol === selection);
      return selected || null;
    } catch (error) {
      logger.error('LLM yield selection error', { error });
      // Fallback to highest APY
      return opportunities.sort((a, b) => b.apy - a.apy)[0] || null;
    }
  }

  /**
   * Propose a yield investment — send tx through WDK
   */
  async proposeYieldInvestment(
    protocol: string,
    amount: bigint,
    apy: number
  ): Promise<string | null> {
    try {
      // Validate constraints
      if (amount > CONSTRAINTS.MAX_SINGLE_TX) {
        logger.warn('Investment exceeds max single tx', { amount: amount.toString() });
        return null;
      }

      const protocolAddress = this.getProtocolAddress(protocol);
      
      // Encode the contract call
      const iface = new ethers.Interface(TREASURY_VAULT_ABI);
      const data = iface.encodeFunctionData('investInYield', [
        protocolAddress,
        amount,
        Math.floor(apy * 100),
      ]);

      // Send through WDK
      const { hash } = await this.wdkAccount.sendTransaction({
        to: this.config.treasuryVaultAddress,
        value: '0',
        data,
      });
      
      const decision: AgentDecision = {
        id: `yield-${Date.now()}`,
        agentType: 'treasury',
        timestamp: Date.now(),
        action: 'invest_yield',
        reasoning: `Invest ${ethers.formatUnits(amount, 6)} USDt in ${protocol} at ${apy}% APY`,
        data: { protocol, amount: amount.toString(), apy },
        txHash: hash,
        status: 'executed',
      };

      EventBus.emitEvent('treasury:yield_invested', 'treasury', decision);
      
      logger.info('Yield investment sent via WDK', { protocol, amount: amount.toString(), apy, hash });
      
      return hash;
    } catch (error) {
      logger.error('Yield investment failed', { error, protocol, amount: amount.toString() });
      return null;
    }
  }

  /**
   * Check and execute pending transactions via WDK
   */
  async checkPendingTransactions(): Promise<void> {
    try {
      const pendingTxs = await this.vaultContract.getPendingTransactions();
      const iface = new ethers.Interface(TREASURY_VAULT_ABI);
      
      for (const txHash of pendingTxs) {
        const tx = await this.vaultContract.getTransaction(txHash);
        
        if (tx.executed) continue;
        
        const executeAfter = tx.proposedAt + 3600; // 1 hour timelock
        
        if (Date.now() / 1000 >= executeAfter) {
          const shouldExecute = await this.evaluateTransaction(tx);
          
          if (shouldExecute) {
            if (tx.signatures < 2 && tx.amount >= ethers.parseUnits('1000', 6)) {
              const data = iface.encodeFunctionData('signTransaction', [txHash]);
              await this.wdkAccount.sendTransaction({
                to: this.config.treasuryVaultAddress,
                value: '0',
                data,
              });
              logger.info('Transaction signed via WDK', { txHash });
            } else {
              const data = iface.encodeFunctionData('executeWithdrawal', [txHash]);
              await this.wdkAccount.sendTransaction({
                to: this.config.treasuryVaultAddress,
                value: '0',
                data,
              });
              logger.info('Transaction executed via WDK', { txHash });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Pending transaction check failed', { error });
    }
  }

  /**
   * Evaluate if a transaction should be executed
   */
  async evaluateTransaction(tx: any): Promise<boolean> {
    // Simple validation - in production, use LLM for complex decisions
    
    // Check daily volume limit
    const dailyVolume = BigInt(this.lastState?.dailyVolume || '0');
    if (dailyVolume + tx.amount > CONSTRAINTS.MAX_DAILY_VOLUME) {
      logger.warn('Transaction would exceed daily volume limit');
      return false;
    }

    // Check balance
    const balance = BigInt(this.lastState?.balance || '0');
    if (tx.amount > balance) {
      logger.warn('Insufficient balance for transaction');
      return false;
    }

    return true;
  }

  /**
   * Assess treasury risk
   */
  async assessRisk(): Promise<RiskAssessment> {
    const factors: any[] = [];
    let score = 100;

    // Check balance
    const balance = BigInt(this.lastState?.balance || '0');
    if (balance < ethers.parseUnits('1000', 6)) {
      factors.push({
        name: 'low_balance',
        impact: -20,
        description: 'Treasury balance below 1000 USDt',
      });
      score -= 20;
    }

    // Check daily volume
    const dailyVolume = BigInt(this.lastState?.dailyVolume || '0');
    const volumeRatio = Number((dailyVolume * BigInt(100)) / CONSTRAINTS.MAX_DAILY_VOLUME);
    if (volumeRatio > 80) {
      factors.push({
        name: 'high_daily_volume',
        impact: -15,
        description: `Daily volume at ${volumeRatio}% of limit`,
      });
      score -= 15;
    }

    // Determine recommendation
    let recommendation: 'proceed' | 'caution' | 'reject';
    if (score >= 80) {
      recommendation = 'proceed';
    } else if (score >= 50) {
      recommendation = 'caution';
    } else {
      recommendation = 'reject';
    }

    const assessment: RiskAssessment = {
      score,
      factors,
      recommendation,
    };

    EventBus.emitEvent('treasury:risk_assessed', 'treasury', {
      score,
      recommendation,
    });

    return assessment;
  }

  /**
   * Emergency pause — send via WDK
   */
  async emergencyPause(): Promise<void> {
    try {
      const iface = new ethers.Interface(TREASURY_VAULT_ABI);
      const data = iface.encodeFunctionData('emergencyPause', []);
      await this.wdkAccount.sendTransaction({
        to: this.config.treasuryVaultAddress,
        value: '0',
        data,
      });
      this.status = 'paused';
      
      EventBus.emitEvent('treasury:emergency_pause', 'treasury', {
        triggeredBy: this.wdkAccount.address ?? 'unknown',
      });
      
      logger.warn('EMERGENCY PAUSE ACTIVATED');
    } catch (error) {
      logger.error('Emergency pause failed', { error });
      throw error;
    }
  }

  /**
   * Get protocol address
   */
  private getProtocolAddress(protocol: string): string {
    const addresses: Record<string, string> = {
      aave: this.config.aavePoolAddress || ethers.ZeroAddress,
    };
    
    return addresses[protocol] || ethers.ZeroAddress;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for credit agent events
    EventBus.subscribe('credit:loan_requested', async (event) => {
      logger.info('Received loan request', event.payload);
      // Treasury would verify funds and approve
    });

    // Listen for yield harvest requests
    EventBus.subscribe('yield:harvest_requested', async (event) => {
      logger.info('Received harvest request', event.payload);
      // Execute harvest
    });
  }

  /**
   * Get recent decisions
   */
  getRecentDecisions(limit: number = 10): AgentDecision[] {
    return EventBus.getRecentEvents(limit, 'treasury') as unknown as AgentDecision[];
  }
}

export default TreasuryAgent;
