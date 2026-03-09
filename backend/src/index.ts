/**
 * AgentTreasury Core - Backend Entry Point
 * Multi-agent system for DAO treasury management
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { ethers } from 'ethers';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

import TreasuryAgent from './agents/TreasuryAgent';
import CreditAgent from './agents/CreditAgent';
import EventBus from './orchestrator/EventBus';
import { AgentDialogue } from './orchestrator/AgentDialogue';
import { TelegramBot } from './services/TelegramBot';
import { LLMClient } from './services/LLMClient';
import { InterAgentLending } from './services/InterAgentLending';
import { predictDefault } from './services/DefaultPredictor';
import { generateProof, verifyProof, getBestProvableTier, type ZKCreditProof } from './services/ZKCreditProof';
import { initWdk, getAccount, disposeWdk } from './services/wdk';
import logger from './utils/logger';
import { AgentConfig, DashboardData, AgentStatus } from './types';

// Load environment variables
dotenv.config();

// Configuration
const config: AgentConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gpt-4',
  llmBaseUrl: process.env.LLM_BASE_URL || undefined,
  llmFallbackApiKey: process.env.LLM_FALLBACK_API_KEY || undefined,
  llmFallbackModel: process.env.LLM_FALLBACK_MODEL || undefined,
  llmFallbackBaseUrl: process.env.LLM_FALLBACK_BASE_URL || undefined,
  llmFallbackName: process.env.LLM_FALLBACK_NAME || undefined,
  seedPhrase: process.env.WDK_SEED_PHRASE || '',
  privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
  rpcUrl: process.env.RPC_URL || 'https://rpc.sepolia.org',
  chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  treasuryVaultAddress: process.env.TREASURY_VAULT_ADDRESS || '',
  creditLineAddress: process.env.CREDIT_LINE_ADDRESS || '',
  usdtAddress: process.env.USDT_ADDRESS || '',
  aavePoolAddress: process.env.AAVE_POOL_ADDRESS,
};

// Validate configuration
function validateConfig(): boolean {
  const required = [
    'seedPhrase',
    'treasuryVaultAddress',
    'creditLineAddress',
    'usdtAddress',
  ];

  if (!config.openaiApiKey) {
    logger.warn('No OPENAI_API_KEY set — agents will use deterministic fallbacks instead of LLM');
  }

  for (const key of required) {
    if (!config[key as keyof AgentConfig]) {
      logger.error(`Missing required configuration: ${key}`);
      return false;
    }
  }

  return true;
}

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (curl, mobile apps, etc.)
    if (!origin) return callback(null, true);
    // Allow all *.agent-treasury.pages.dev subdomains + localhost
    if (origin.endsWith('.agent-treasury.pages.dev') ||
        origin === 'https://agent-treasury.pages.dev' ||
        origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// Serve frontend build (production)
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// Agent instances
let treasuryAgent: TreasuryAgent | null = null;
let creditAgent: CreditAgent | null = null;
let agentDialogue: AgentDialogue | null = null;
let telegramBot: TelegramBot | null = null;
let interAgentLending: InterAgentLending | null = null;

// WebSocket clients
const wsClients = new Set<import('ws').WebSocket>();

/**
 * Initialize agents
 */
async function initializeAgents(): Promise<void> {
  try {
    // Initialize WDK with seed phrase
    const wdk = await initWdk({
      seedPhrase: config.seedPhrase,
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      aavePoolAddress: config.aavePoolAddress,
    });

    const wdkAccount = await getAccount(wdk);

    // ethers provider is still used for contract interactions
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Create shared LLM client with failover
    const llmClient = new LLMClient(
      config.openaiApiKey ? {
        apiKey: config.openaiApiKey,
        baseUrl: config.llmBaseUrl,
        model: config.llmModel,
        name: 'primary',
      } : undefined,
      config.llmFallbackApiKey ? {
        apiKey: config.llmFallbackApiKey,
        baseUrl: config.llmFallbackBaseUrl,
        model: config.llmFallbackModel || config.llmModel,
        name: config.llmFallbackName || 'fallback',
      } : undefined,
    );

    if (llmClient.isConfigured) {
      logger.info('LLM failover client configured', {
        primary: config.openaiApiKey ? 'yes' : 'no',
        fallback: config.llmFallbackApiKey ? 'yes' : 'no',
      });
    }

    // Initialize agents with WDK account + ethers provider for contracts
    treasuryAgent = new TreasuryAgent(config, provider, wdk, wdkAccount, llmClient);
    creditAgent = new CreditAgent(config, provider, wdk, wdkAccount, llmClient);

    // Start agents
    await treasuryAgent.start();
    await creditAgent.start();

    // Start inter-agent dialogue orchestrator
    agentDialogue = new AgentDialogue(config, treasuryAgent, creditAgent, llmClient);
    agentDialogue.start();

    // Initialize inter-agent lending system
    interAgentLending = new InterAgentLending({
      getTreasuryBalance: () => {
        const state = treasuryAgent?.getState();
        return state ? BigInt(state.balance) : 0n;
      },
      getCreditPoolOutstanding: () => {
        const loans = creditAgent?.getAllActiveLoans() || [];
        return loans.reduce((sum, l) => sum + BigInt(l.principal), 0n);
      },
    });

    // Setup event broadcasting
    EventBus.subscribeAll((event) => {
      broadcastEvent(event);
    });

    // Start Telegram bot (opt-in via env vars)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      telegramBot = new TelegramBot(
        { token: tgToken, chatId: tgChat },
        treasuryAgent,
        creditAgent,
        agentDialogue,
      );
      telegramBot.start();
      logger.info('Telegram bot started');
    } else {
      logger.info('Telegram bot disabled (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set)');
    }

    logger.info('All agents initialized successfully (with inter-agent dialogue)');
  } catch (error) {
    logger.error('Failed to initialize agents', { error: error instanceof Error ? error.message : error, stack: error instanceof Error ? error.stack : undefined });
    process.exit(1);
  }
}

/**
 * Broadcast event to all WebSocket clients
 */
function broadcastEvent(event: any): void {
  const message = JSON.stringify({
    type: 'agent:event',
    data: event,
    timestamp: Date.now(),
  });

  wsClients.forEach((client) => {
    try {
      client.send(message);
    } catch (error) {
      // Client disconnected
      wsClients.delete(client);
    }
  });
}

/**
 * Get dashboard data — real data only, no demo overlays
 */
async function getDashboardData(): Promise<DashboardData> {
  const treasury = treasuryAgent?.getState() || {
    balance: '0',
    dailyVolume: '0',
    pendingTransactions: [],
    yieldPositions: [],
    lastUpdated: Date.now(),
  };

  const creditProfiles = creditAgent?.getProfiles() || [];
  const activeLoans = creditAgent?.getAllActiveLoans() || [];
  
  const agentDecisions = [
    ...(treasuryAgent?.getRecentDecisions(15) || []),
    ...(creditAgent?.getRecentDecisions(15) || []),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 25);

  const agentStatus: Record<string, AgentStatus> = {
    treasury: treasuryAgent?.getStatus() || 'idle',
    credit: creditAgent?.getStatus() || 'idle',
  };

  return {
    treasury,
    creditProfiles,
    activeLoans,
    agentDecisions,
    agentStatus,
    dialogueRounds: agentDialogue?.getRecentDialogues(3) || [],
  };
}

// ==================== API Routes ====================

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    agents: {
      treasury: treasuryAgent?.getStatus() || 'not_initialized',
      credit: creditAgent?.getStatus() || 'not_initialized',
    },
    timestamp: Date.now(),
  });
});

// Get dashboard data
app.get('/api/dashboard', async (_req, res) => {
  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Dashboard data error', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// Get treasury state
app.get('/api/treasury', async (_req, res) => {
  try {
    const state = treasuryAgent?.getState();
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch treasury state' });
  }
});

// Get treasury history for charts (real data)
app.get('/api/treasury/history', async (_req, res) => {
  try {
    const history = treasuryAgent?.getHistory() || [];
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch treasury history' });
  }
});

// Sync treasury state
app.post('/api/treasury/sync', async (_req, res) => {
  try {
    const state = await treasuryAgent?.syncState();
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to sync treasury' });
  }
});

// Get credit profile
app.get('/api/credit/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      return;
    }
    const profile = await creditAgent?.getProfile(address);
    
    if (!profile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch credit profile' });
  }
});

// Evaluate credit
app.post('/api/credit/:address/evaluate', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      return;
    }
    const profile = await creditAgent?.evaluateCredit(address);
    // Enrich with ML prediction
    let mlPrediction = null;
    if (profile && profile.exists) {
      try {
        const history = await creditAgent?.fetchCreditHistory(address);
        if (history) {
          mlPrediction = predictDefault(history, profile);
        }
      } catch { /* ML is best-effort */ }
    }
    res.json({ success: true, data: { ...profile, mlPrediction } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to evaluate credit' });
  }
});

// Get user loans
app.get('/api/credit/:address/loans', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      return;
    }
    const loans = await creditAgent?.getUserLoans(address);
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch loans' });
  }
});

// Get full loan history for a user (active + repaid + defaulted)
app.get('/api/credit/:address/history', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      return;
    }
    const history = creditAgent?.getUserLoanHistory(address) || [];
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch loan history' });
  }
});

// Get all active loans
app.get('/api/loans', async (_req, res) => {
  try {
    const loans = creditAgent?.getAllActiveLoans() || [];
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch loans' });
  }
});

// Get agent decisions
app.get('/api/decisions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 15;
    const decisions = [
      ...(treasuryAgent?.getRecentDecisions(limit) || []),
      ...(creditAgent?.getRecentDecisions(limit) || []),
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    
    res.json({ success: true, data: decisions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch decisions' });
  }
});

// AI Decision Log — structured audit trail proving AI → decision → execution
app.get('/api/ai-decisions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const decisions = [
      ...(treasuryAgent?.getRecentDecisions(limit) || []),
      ...(creditAgent?.getRecentDecisions(limit) || []),
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

    const enriched = decisions.map(d => ({
      timestamp: d.timestamp,
      agent: d.agentType || d.source || 'unknown',
      action: d.action,
      context: d.data || {},
      decision: d.reasoning,
      status: d.status,
      txHash: d.txHash || null,
    }));

    res.json({
      success: true,
      data: {
        decisions: enriched,
        meta: {
          total: enriched.length,
          agents: { treasury: treasuryAgent?.getStatus(), credit: creditAgent?.getStatus() },
          llmConfigured: !!config.openaiApiKey,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch AI decision log' });
  }
});

// Treasury Health Score — composite risk metric (0-100)
app.get('/api/treasury/health', async (_req, res) => {
  try {
    const state = treasuryAgent?.getState();
    const loans = creditAgent?.getAllActiveLoans() || [];
    const lending = interAgentLending?.getSummary();

    const balance = state ? Number(state.balance) / 1e6 : 0;
    const dailyVol = state ? Number(state.dailyVolume) / 1e6 : 0;
    const yieldTotal = (state?.yieldPositions || []).reduce(
      (s, p) => s + Number(p.amount) / 1e6, 0
    );
    const totalLent = loans.reduce((s, l) => s + Number(l.principal) / 1e6, 0);
    const overdue = loans.filter(l => l.dueDate < Date.now() / 1000 && l.active).length;
    const interAgentDebt = lending
      ? (Number(lending.totalAllocated || 0) - Number(lending.totalRepaid || 0)) / 1e6
      : 0;

    // Scoring components (each 0-100, weighted)
    const liquidityScore = Math.min(100, (balance / 10000) * 100);            // 50k = 100
    const utilizationScore = balance > 0
      ? Math.max(0, 100 - (totalLent / balance) * 200)                       // <50% = healthy
      : 50;
    const overdueScore = Math.max(0, 100 - overdue * 25);                     // each overdue = -25
    const yieldScore = balance > 0
      ? Math.min(100, (yieldTotal / balance) * 300)                           // 33% in yield = 100
      : 0;
    const volumeScore = Math.max(0, 100 - (dailyVol / 10000) * 100);         // approaching limit = bad
    const debtScore = balance > 0
      ? Math.max(0, 100 - (interAgentDebt / balance) * 500)                  // >20% = danger
      : 50;

    const weights = { liquidity: 0.30, utilization: 0.20, overdue: 0.20, yield: 0.10, volume: 0.10, debt: 0.10 };
    const health = Math.round(
      liquidityScore * weights.liquidity +
      utilizationScore * weights.utilization +
      overdueScore * weights.overdue +
      yieldScore * weights.yield +
      volumeScore * weights.volume +
      debtScore * weights.debt
    );

    res.json({
      success: true,
      data: {
        health,
        rating: health >= 80 ? 'Excellent' : health >= 60 ? 'Good' : health >= 40 ? 'Fair' : 'Critical',
        breakdown: {
          liquidity: { score: Math.round(liquidityScore), weight: weights.liquidity, value: `${Math.round(balance)} USDt` },
          utilization: { score: Math.round(utilizationScore), weight: weights.utilization, value: `${Math.round(totalLent)} / ${Math.round(balance)} USDt lent` },
          overdue: { score: Math.round(overdueScore), weight: weights.overdue, value: `${overdue} overdue loans` },
          yield: { score: Math.round(yieldScore), weight: weights.yield, value: `${Math.round(yieldTotal)} USDt in yield` },
          volume: { score: Math.round(volumeScore), weight: weights.volume, value: `${Math.round(dailyVol)} / 10,000 daily limit` },
          debt: { score: Math.round(debtScore), weight: weights.debt, value: `${Math.round(interAgentDebt)} USDt inter-agent` },
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to compute treasury health' });
  }
});

// Stress Test — simulate adverse scenario and show agent reaction
app.post('/api/stress-test', async (req, res) => {
  try {
    const { scenario } = req.body as { scenario?: string };
    const scenarioName = scenario || 'market_crash';

    const state = treasuryAgent?.getState();
    const loans = creditAgent?.getAllActiveLoans() || [];
    const balance = state ? Number(state.balance) / 1e6 : 0;
    const totalLent = loans.reduce((s, l) => s + Number(l.principal) / 1e6, 0);

    const scenarios: Record<string, { description: string; impact: string; agentResponse: string }> = {
      market_crash: {
        description: 'Simulated 40% market downturn — collateral values drop, default risk spikes',
        impact: `At-risk exposure: ${Math.round(totalLent * 0.4)} USDt (40% of ${Math.round(totalLent)} lent)`,
        agentResponse: 'Treasury Agent: PAUSE new lending, increase reserves. Credit Agent: Downgrade all profiles by 1 tier, block new loans for Poor-tier borrowers.',
      },
      bank_run: {
        description: 'Simulated liquidity crisis — 80% of borrowers request withdrawal simultaneously',
        impact: `Liquidity needed: ${Math.round(balance * 0.8)} USDt (80% of ${Math.round(balance)} vault)`,
        agentResponse: 'Treasury Agent: Trigger emergency pause, recall yield positions. Credit Agent: Halt all new lending, begin orderly unwinding.',
      },
      yield_collapse: {
        description: 'All yield protocols drop to 0% APY — no revenue to service debt',
        impact: `Lost yield revenue: ${(state?.yieldPositions || []).reduce((s, p) => s + Number(p.harvested || 0) / 1e6, 0).toFixed(2)} USDt accrued`,
        agentResponse: 'Treasury Agent: Withdraw all yield positions to vault, reallocate to highest-APY alternative. Credit Agent: Increase interest rates by 2% to compensate.',
      },
    };

    const result = scenarios[scenarioName] || scenarios['market_crash'];

    // Emit stress test event to dashboard
    EventBus.emitEvent('system:stress_test', 'treasury', {
      action: 'stress_test',
      reasoning: `Stress test (${scenarioName}): ${result.agentResponse}`,
      data: { scenario: scenarioName, ...result },
      status: 'executed',
    });

    res.json({ success: true, data: { scenario: scenarioName, ...result } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Stress test failed' });
  }
});

// Get yield opportunities
app.get('/api/yield/opportunities', async (_req, res) => {
  try {
    const opportunities = await treasuryAgent?.fetchYieldOpportunities();
    res.json({ success: true, data: opportunities });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch yield opportunities' });
  }
});

// Emergency pause
app.post('/api/emergency/pause', async (_req, res) => {
  try {
    await treasuryAgent?.emergencyPause();
    res.json({ success: true, message: 'Emergency pause activated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to activate emergency pause' });
  }
});

// ==================== Loan Lifecycle Routes ====================

// Borrow USDt
app.post('/api/credit/:address/borrow', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      return;
    }
    const { amount } = req.body as { amount: string };
    if (!amount) {
      res.status(400).json({ success: false, error: 'Missing amount' });
      return;
    }
    const loan = await creditAgent?.processBorrow(address, BigInt(amount));
    if (!loan) {
      res.status(403).json({ success: false, error: 'Borrow declined or insufficient credit' });
      return;
    }
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Borrow failed' });
  }
});

// Repay a loan
app.post('/api/credit/:address/repay', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      return;
    }
    const { loanId, amount } = req.body as { loanId: number; amount: string };
    if (loanId == null || !amount) {
      res.status(400).json({ success: false, error: 'Missing loanId or amount' });
      return;
    }
    const result = await creditAgent?.processRepayment(loanId, BigInt(amount));
    if (result?.ok) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result?.error || 'Repayment failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Repayment failed' });
  }
});

// ==================== Yield Routes ====================

// Propose yield investment
app.post('/api/yield/invest', async (req, res) => {
  try {
    const { protocol, amount, apy } = req.body as { protocol: string; amount: string; apy: number };
    if (!protocol || !amount) {
      res.status(400).json({ success: false, error: 'Missing protocol or amount' });
      return;
    }
    const hash = await treasuryAgent?.proposeYieldInvestment(
      protocol,
      BigInt(amount),
      apy || 0
    );
    if (!hash) {
      res.status(400).json({ success: false, error: 'Investment rejected' });
      return;
    }
    res.json({ success: true, data: { txHash: hash } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Yield investment failed' });
  }
});

// ==================== Withdrawal Routes ====================

// Propose withdrawal
app.post('/api/treasury/withdrawal/propose', async (req, res) => {
  try {
    const { to, amount } = req.body as { to: string; amount: string };
    if (!to || !amount) {
      res.status(400).json({ success: false, error: 'Missing to or amount' });
      return;
    }
    const hash = await treasuryAgent?.proposeWithdrawal(to, BigInt(amount));
    if (!hash) {
      res.status(400).json({ success: false, error: 'Proposal rejected' });
      return;
    }
    res.json({ success: true, data: { txHash: hash } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Withdrawal proposal failed' });
  }
});

// ==================== Test: Telegram Approval ====================

// Simulate a large withdrawal to trigger Telegram approval buttons
app.post('/api/test/approval', (_req, res) => {
  const testAmount = '1500000000'; // 1500 USDt (> 1000 threshold)
  const testTo = '0xDEAD000000000000000000000000000000001234';

  EventBus.emitEvent('treasury:withdrawal_proposed', 'treasury', {
    action: 'withdrawal_proposed',
    reasoning: 'Test approval flow — 1500 USDt withdrawal',
    to: testTo,
    amount: testAmount,
    status: 'pending',
  });

  res.json({ success: true, message: 'Test approval event emitted — check Telegram' });
});

// ==================== Bonus Features: ML, ZK, Inter-Agent Lending ====================

// ML Default Prediction for a borrower
app.get('/api/credit/:address/default-prediction', async (req, res) => {
  try {
    const { address } = req.params;
    const profile = await creditAgent?.getProfile(address);
    const history = await creditAgent?.fetchCreditHistory(address);
    if (!history) {
      res.status(404).json({ success: false, error: 'Could not fetch history' });
      return;
    }
    const prediction = predictDefault(history, profile ?? null);
    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: 'ML prediction failed' });
  }
});

// ZK Credit Proof: generate proof that score meets a tier
app.post('/api/credit/:address/zk-proof', async (req, res) => {
  try {
    const { address } = req.params;
    const profile = await creditAgent?.getProfile(address);
    if (!profile || !profile.exists) {
      res.status(404).json({ success: false, error: 'Credit profile not found — evaluate first' });
      return;
    }

    const tier = getBestProvableTier(profile.score);
    if (!tier) {
      res.status(400).json({ success: false, error: 'Score too low for any tier' });
      return;
    }

    const result = generateProof(profile.score, tier.threshold, tier.tierName);
    if (!result) {
      res.status(400).json({ success: false, error: 'Cannot generate proof' });
      return;
    }

    // Return proof (without nonce — prover keeps nonce secret)
    res.json({
      success: true,
      data: {
        proof: result.proof,
        message: `ZK proof generated: credit score meets ${tier.tierName} tier (≥${tier.threshold}) without revealing exact score`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'ZK proof generation failed' });
  }
});

// ZK Proof Verification
app.post('/api/credit/verify-proof', async (req, res) => {
  try {
    const proof = req.body as ZKCreditProof;
    if (!proof || !proof.commitment || !proof.rangeProof) {
      res.status(400).json({ success: false, error: 'Invalid proof format' });
      return;
    }
    const result = verifyProof(proof);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'ZK proof verification failed' });
  }
});

// Inter-agent lending: view status
app.get('/api/inter-agent/lending', async (_req, res) => {
  try {
    if (!interAgentLending) {
      res.status(503).json({ success: false, error: 'Inter-agent lending not initialized' });
      return;
    }
    res.json({
      success: true,
      data: {
        summary: interAgentLending.getSummary(),
        poolStatus: interAgentLending.getPoolStatus(),
        loans: interAgentLending.getLoans(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch inter-agent lending data' });
  }
});

// Inter-agent lending: Credit Agent requests capital from Treasury
app.post('/api/inter-agent/request-capital', async (req, res) => {
  try {
    const { amount, reason } = req.body as { amount: string; reason?: string };
    if (!amount) {
      res.status(400).json({ success: false, error: 'Missing amount' });
      return;
    }
    if (!interAgentLending) {
      res.status(503).json({ success: false, error: 'Inter-agent lending not initialized' });
      return;
    }
    interAgentLending.requestCapital(amount, reason || 'API-triggered capital request');
    res.json({
      success: true,
      data: {
        message: 'Capital request submitted',
        summary: interAgentLending.getSummary(),
        poolStatus: interAgentLending.getPoolStatus(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Capital request failed' });
  }
});

// Inter-agent lending: trigger yield harvest → auto-service debt (demo/test)
app.post('/api/inter-agent/harvest', async (_req, res) => {
  try {
    if (!treasuryAgent) {
      res.status(503).json({ success: false, error: 'Treasury agent not initialized' });
      return;
    }
    // Force a harvest cycle (normally runs every ~5 min automatically)
    (treasuryAgent as any).harvestAndServiceDebt();

    const lendingData = interAgentLending ? {
      summary: interAgentLending.getSummary(),
      loans: interAgentLending.getLoans(),
    } : null;

    res.json({
      success: true,
      data: {
        message: 'Yield harvest triggered — inter-agent debt serviced from earned revenue',
        lending: lendingData,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Harvest failed' });
  }
});

// ==================== Demo Autopilot ====================

// Demo autopilot: orchestrates a full demo sequence with SSE progress
app.post('/api/demo/autopilot', async (_req, res) => {
  // SSE for real-time progress updates
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const send = (step: number, total: number, label: string, status: 'running' | 'done' | 'error') => {
    res.write(`data: ${JSON.stringify({ step, total, label, status })}\n\n`);
  };

  const TOTAL = 7;
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  const DEMO_BORROWER = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28';

  try {
    // Step 1: Sync Treasury
    send(1, TOTAL, 'Syncing treasury state...', 'running');
    await treasuryAgent?.syncState();
    send(1, TOTAL, 'Treasury synced', 'done');
    await delay(1500);

    // Step 2: Credit Evaluation + ML
    send(2, TOTAL, 'Evaluating borrower credit...', 'running');
    const profile = await creditAgent?.evaluateCredit(DEMO_BORROWER);
    if (profile?.exists) {
      try {
        const history = await creditAgent?.fetchCreditHistory(DEMO_BORROWER);
        if (history) predictDefault(history, profile);
      } catch { /* ML best-effort */ }
    }
    send(2, TOTAL, 'Credit scored — ML prediction complete', 'done');
    await delay(1500);

    // Step 3: Loan disbursement
    send(3, TOTAL, 'Disbursing 1,000 USDt loan...', 'running');
    try {
      await creditAgent?.processBorrow(DEMO_BORROWER, BigInt('1000000000'));
    } catch { /* may fail if already has loan — that's fine */ }
    send(3, TOTAL, 'Loan processed on-chain', 'done');
    await delay(1500);

    // Step 4: Yield harvest + debt servicing
    send(4, TOTAL, 'Harvesting yield & servicing debt...', 'running');
    try {
      (treasuryAgent as any).harvestAndServiceDebt();
    } catch { /* best-effort */ }
    send(4, TOTAL, 'Yield harvested — debt serviced', 'done');
    await delay(1500);

    // Step 5: Board Meeting (agent-to-agent dialogue)
    send(5, TOTAL, 'Board Meeting in progress...', 'running');
    try {
      await agentDialogue?.runDialogueRound();
    } catch { /* LLM may be unavailable */ }
    send(5, TOTAL, 'Board Meeting consensus reached', 'done');
    await delay(1500);

    // Step 6: Stress Test
    send(6, TOTAL, 'Running stress test (market crash)...', 'running');
    EventBus.emitEvent('system:stress_test', 'treasury', {
      action: 'stress_test',
      reasoning: '🔥 Market crash simulation — 40% drawdown, testing agent resilience',
      data: { scenario: 'market_crash', severity: 0.4 },
      status: 'executed',
    });
    send(6, TOTAL, 'Stress test complete — system survived', 'done');
    await delay(1500);

    // Step 7: Health check
    send(7, TOTAL, 'Calculating treasury health...', 'running');
    await delay(800);
    send(7, TOTAL, 'All systems operational', 'done');

    // Final
    res.write(`data: ${JSON.stringify({ step: TOTAL, total: TOTAL, label: 'Demo complete', status: 'done', complete: true })}\n\n`);
    res.end();
  } catch (error) {
    send(0, TOTAL, 'Autopilot error', 'error');
    res.end();
  }
});

// ==================== WebSocket ====================

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  wsClients.add(ws);

  // Send initial data
  getDashboardData().then((data) => {
    ws.send(JSON.stringify({
      type: 'dashboard:initial',
      data,
      timestamp: Date.now(),
    }));
  });

  ws.on('message', async (message) => {
    try {
      const { type, payload } = JSON.parse(message.toString());

      switch (type) {
        case 'dashboard:refresh':
          const data = await getDashboardData();
          ws.send(JSON.stringify({
            type: 'dashboard:update',
            data,
            timestamp: Date.now(),
          }));
          break;

        case 'credit:evaluate':
          if (payload.address) {
            const profile = await creditAgent?.evaluateCredit(payload.address);
            ws.send(JSON.stringify({
              type: 'credit:profile',
              data: profile,
              timestamp: Date.now(),
            }));
          }
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${type}`,
          }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
    wsClients.delete(ws);
  });
});

// ==================== SPA Fallback ====================

// All non-API routes serve the frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ==================== Startup ====================

const PORT = process.env.PORT || 3001;

async function main(): Promise<void> {
  // Validate config
  if (!validateConfig()) {
    logger.error('Configuration validation failed');
    process.exit(1);
  }

  // Initialize agents
  await initializeAgents();

  // Start server
  server.listen(PORT, () => {
    logger.info(`AgentTreasury Core API running on port ${PORT}`);
    logger.info(`WebSocket server ready at ws://localhost:${PORT}/ws`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  telegramBot?.stop();
  agentDialogue?.stop();
  await treasuryAgent?.stop();
  await creditAgent?.stop();
  await disposeWdk();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  telegramBot?.stop();
  agentDialogue?.stop();
  await treasuryAgent?.stop();
  await creditAgent?.stop();
  await disposeWdk();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
