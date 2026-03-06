/**
 * AgentTreasury Core - Backend Entry Point
 * Multi-agent system for DAO treasury management
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ethers } from 'ethers';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

import TreasuryAgent from './agents/TreasuryAgent';
import CreditAgent from './agents/CreditAgent';
import EventBus from './orchestrator/EventBus';
import { initWdk, getAccount, disposeWdk } from './services/wdk';
import logger from './utils/logger';
import { AgentConfig, DashboardData, AgentStatus } from './types';

// Load environment variables
dotenv.config();

// Configuration
const config: AgentConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  seedPhrase: process.env.WDK_SEED_PHRASE || '',
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
    'openaiApiKey',
    'seedPhrase',
    'treasuryVaultAddress',
    'creditLineAddress',
    'usdtAddress',
  ];

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
app.use(helmet());
app.use(cors());
app.use(express.json());

// Agent instances
let treasuryAgent: TreasuryAgent | null = null;
let creditAgent: CreditAgent | null = null;

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

    // Initialize agents with WDK account + ethers provider for contracts
    treasuryAgent = new TreasuryAgent(config, provider, wdk, wdkAccount);
    creditAgent = new CreditAgent(config, provider, wdk, wdkAccount);

    // Start agents
    await treasuryAgent.start();
    await creditAgent.start();

    // Setup event broadcasting
    EventBus.subscribeAll((event) => {
      broadcastEvent(event);
    });

    logger.info('All agents initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize agents', { error });
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
 * Get dashboard data
 */
async function getDashboardData(): Promise<DashboardData> {
  const treasury = treasuryAgent?.getState() || {
    balance: '0',
    dailyVolume: '0',
    pendingTransactions: [],
    yieldPositions: [],
    lastUpdated: Date.now(),
  };

  const creditProfiles = Array.from(creditAgent?.['profiles'].values() || []);
  const activeLoans = creditAgent?.getAllActiveLoans() || [];
  
  const agentDecisions = [
    ...(treasuryAgent?.getRecentDecisions(5) || []),
    ...(creditAgent?.getRecentDecisions(5) || []),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);

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
    const profile = await creditAgent?.evaluateCredit(address);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to evaluate credit' });
  }
});

// Get user loans
app.get('/api/credit/:address/loans', async (req, res) => {
  try {
    const { address } = req.params;
    const loans = await creditAgent?.getUserLoans(address);
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch loans' });
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
