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
