/**
 * TreasuryAgent - Manages DAO treasury funds
 * Capabilities: WDK wallet, yield farming, security controls
 */

import { ethers } from 'ethers';
import OpenAI from 'openai';
import EventBus from '../orchestrator/EventBus';
import logger from '../utils/logger';
import {
  AgentType,
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

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Security constraints
const CONSTRAINTS = {
  MAX_DAILY_VOLUME: ethers.parseUnits('10000', 6), // 10k USDt
  MAX_SINGLE_TX: ethers.parseUnits('1000', 6),      // 1k USDt
  ALLOWED_PROTOCOLS: ['aave', 'compound'],
  REBALANCE_THRESHOLD: 5, // 5% APY difference triggers rebalance
  MIN_YIELD_ALLOCATION: 10, // Min 10% of treasury in yield
  MAX_YIELD_ALLOCATION: 50, // Max 50% of treasury in yield
};

export class TreasuryAgent {
  private status: AgentStatus = 'idle';
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private vaultContract: ethers.Contract;
  private usdtContract: ethers.Contract;
  private openai: OpenAI;
  private config: AgentConfig;
  private lastState: TreasuryState | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig, provider: ethers.Provider, signer: ethers.Signer) {
    this.config = config;
    this.provider = provider;
    this.signer = signer;
    
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    this.vaultContract = new ethers.Contract(
      config.treasuryVaultAddress,
      TREASURY_VAULT_ABI,
      signer
    );

    this.usdtContract = new ethers.Contract(
      config.usdtAddress,
      ERC20_ABI,
      provider
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
      address: await this.signer.getAddress(),
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
   * Fetch yield opportunities from protocols
   */
  async fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
    // In production, this would fetch real APY data from Aave/Compound
    // For hackathon, we simulate with realistic data
    
    const opportunities: YieldOpportunity[] = [
      {
        protocol: 'aave',
        apy: 8.2,
        tvl: '500000000',
        risk: 'low',
      },
      {
        protocol: 'compound',
        apy: 7.5,
        tvl: '300000000',
        risk: 'low',
      },
    ];

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
   * Propose a yield investment
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

      // Get protocol address (would be from config)
      const protocolAddress = this.getProtocolAddress(protocol);
      
      // Propose investment
      const tx = await this.vaultContract.investInYield(
        protocolAddress,
        amount,
        Math.floor(apy * 100) // Convert to basis points
      );

      const receipt = await tx.wait();
      
      const decision: AgentDecision = {
        id: `yield-${Date.now()}`,
        agentType: 'treasury',
        timestamp: Date.now(),
        action: 'invest_yield',
        reasoning: `Invest ${ethers.formatUnits(amount, 6)} USDt in ${protocol} at ${apy}% APY`,
        data: { protocol, amount: amount.toString(), apy },
        txHash: receipt.hash,
        status: 'executed',
      };

      EventBus.emitEvent('treasury:yield_invested', 'treasury', decision);
      
      logger.info('Yield investment proposed', { protocol, amount: amount.toString(), apy });
      
      return receipt.hash;
    } catch (error) {
      logger.error('Yield investment failed', { error, protocol, amount: amount.toString() });
      return null;
    }
  }

  /**
   * Check and execute pending transactions
   */
  async checkPendingTransactions(): Promise<void> {
    try {
      const pendingTxs = await this.vaultContract.getPendingTransactions();
      
      for (const txHash of pendingTxs) {
        const tx = await this.vaultContract.getTransaction(txHash);
        
        if (tx.executed) continue;
        
        const executeAfter = tx.proposedAt + 3600; // 1 hour timelock
        
        if (Date.now() / 1000 >= executeAfter) {
          // Check if we should sign/execute
          const shouldExecute = await this.evaluateTransaction(tx);
          
          if (shouldExecute) {
            if (tx.signatures < 2 && tx.amount >= ethers.parseUnits('1000', 6)) {
              // Sign transaction
              await this.vaultContract.signTransaction(txHash);
              logger.info('Transaction signed', { txHash });
            } else {
              // Execute transaction
              await this.vaultContract.executeWithdrawal(txHash);
              logger.info('Transaction executed', { txHash });
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
   * Emergency pause
   */
  async emergencyPause(): Promise<void> {
    try {
      await this.vaultContract.emergencyPause();
      this.status = 'paused';
      
      EventBus.emitEvent('treasury:emergency_pause', 'treasury', {
        triggeredBy: await this.signer.getAddress(),
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
      aave: this.config.aavePoolAddress || '0x0000000000000000000000000000000000000000',
      compound: this.config.compoundComptrollerAddress || '0x0000000000000000000000000000000000000000',
    };
    
    return addresses[protocol] || '0x0000000000000000000000000000000000000000';
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
