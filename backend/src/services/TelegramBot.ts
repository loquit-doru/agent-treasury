/**
 * TelegramBot — Human-in-the-loop control channel for AgentTreasury
 *
 * Commands:
 *   /status      — Treasury balance, active loans, agent status
 *   /decisions   — Last 5 agent decisions
 *   /dialogue    — Last board meeting summary
 *   /loans       — Active loans overview
 *   /pause       — Emergency pause treasury
 *   /unpause     — Resume treasury operations
 *   /invest <protocol> <amount> — Propose yield investment
 *   /budget      — Budget breakdown (balance, yield, lending)
 *   /help        — Show command list
 *
 * Notifications (EventBus-driven):
 *   - Board meeting consensus
 *   - New borrow request
 *   - Large transactions (> 1000 USDt)
 *   - Emergency events
 */

import TelegramBotApi from 'node-telegram-bot-api';
import EventBus from '../orchestrator/EventBus';
import logger from '../utils/logger';
import type { TreasuryAgent } from '../agents/TreasuryAgent';
import type { CreditAgent } from '../agents/CreditAgent';
import type { AgentDialogue } from '../orchestrator/AgentDialogue';
import type { AgentEvent } from '../types';

export interface TelegramBotConfig {
  token: string;
  chatId: string;         // Whitelist: only respond to this chat
}

export class TelegramBot {
  private bot: TelegramBotApi;
  private chatId: string;
  private treasuryAgent: TreasuryAgent;
  private creditAgent: CreditAgent;
  private agentDialogue: AgentDialogue | null;
  private unsubscribe: (() => void) | null = null;
  /** Pending approval requests keyed by unique ID */
  private pendingApprovals = new Map<string, {
    type: 'withdrawal' | 'yield_invest';
    data: Record<string, unknown>;
    createdAt: number;
  }>();
  /** Auto-expire approvals after 10 minutes */
  private static readonly APPROVAL_TTL_MS = 10 * 60 * 1000;

  constructor(
    cfg: TelegramBotConfig,
    treasuryAgent: TreasuryAgent,
    creditAgent: CreditAgent,
    agentDialogue: AgentDialogue | null,
  ) {
    this.bot = new TelegramBotApi(cfg.token, { polling: true });
    this.chatId = cfg.chatId;
    this.treasuryAgent = treasuryAgent;
    this.creditAgent = creditAgent;
    this.agentDialogue = agentDialogue;
  }

  /** Start listening for commands + EventBus notifications */
  start(): void {
    this.registerCommands();
    this.registerCallbackHandler();
    this.subscribeEvents();

    // Announce startup
    this.send('🤖 *AgentTreasury Bot Online*\nType /help for commands.')
      .catch(() => {});

    logger.info('TelegramBot started (polling)');
  }

  /** Stop polling and unsubscribe */
  stop(): void {
    this.unsubscribe?.();
    this.bot.stopPolling();
    logger.info('TelegramBot stopped');
  }

  // ─── Commands ──────────────────────────────────────────────

  private registerCommands(): void {
    this.bot.onText(/\/start/, (msg) => this.guard(msg, () =>
      this.send('👋 AgentTreasury Telegram controller.\nUse /help to see commands.'),
    ));

    this.bot.onText(/\/help/, (msg) => this.guard(msg, () =>
      this.send([
        '📋 *Commands*',
        '/status — Treasury & agent overview',
        '/decisions — Recent AI decisions',
        '/dialogue — Last board meeting',
        '/loans — Active loans',
        '/pause — Emergency pause',
        '/unpause — Resume operations',
        '/invest <protocol> <amount> — Propose yield',
        '/budget — Balance breakdown',
        '',
        '🔐 *Approval Flow*',
        'Large txs (≥1000 USDt) or yield (≥500 USDt)',
        'require your ✅ Approve / ❌ Reject inline button.',
      ].join('\n')),
    ));

    this.bot.onText(/\/status/, (msg) => this.guard(msg, () => this.cmdStatus()));
    this.bot.onText(/\/decisions/, (msg) => this.guard(msg, () => this.cmdDecisions()));
    this.bot.onText(/\/dialogue/, (msg) => this.guard(msg, () => this.cmdDialogue()));
    this.bot.onText(/\/loans/, (msg) => this.guard(msg, () => this.cmdLoans()));
    this.bot.onText(/\/pause/, (msg) => this.guard(msg, () => this.cmdPause()));
    this.bot.onText(/\/unpause/, (msg) => this.guard(msg, () => this.cmdUnpause()));
    this.bot.onText(/\/budget/, (msg) => this.guard(msg, () => this.cmdBudget()));
    this.bot.onText(/\/invest (.+)/, (msg, match) => this.guard(msg, () => {
      const args = match?.[1]?.trim().split(/\s+/) || [];
      this.cmdInvest(args);
    }));
  }

  // ─── Command Handlers ─────────────────────────────────────

  private async cmdStatus(): Promise<void> {
    const state = this.treasuryAgent.getState();
    const loans = this.creditAgent.getAllActiveLoans();
    const tStatus = this.treasuryAgent.getStatus();
    const cStatus = this.creditAgent.getStatus();

    const balUsd = (parseFloat(state?.balance ?? '0') / 1e6).toFixed(2);
    const yieldCount = state?.yieldPositions?.length ?? 0;
    const pendingCount = state?.pendingTransactions?.length ?? 0;

    await this.send([
      '📊 *Treasury Status*',
      `Balance: \`${balUsd} USDt\``,
      `Yield positions: ${yieldCount}`,
      `Pending TXs: ${pendingCount}`,
      `Active loans: ${loans.length}`,
      '',
      '🤖 *Agents*',
      `Treasury: ${this.statusEmoji(tStatus)} ${tStatus}`,
      `Credit: ${this.statusEmoji(cStatus)} ${cStatus}`,
    ].join('\n'));
  }

  private async cmdDecisions(): Promise<void> {
    const decisions = [
      ...(this.treasuryAgent.getRecentDecisions(5) || []),
      ...(this.creditAgent.getRecentDecisions(5) || []),
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

    if (decisions.length === 0) {
      await this.send('No decisions yet.');
      return;
    }

    const lines = decisions.map(d => {
      const time = new Date(d.timestamp).toLocaleTimeString('ro-RO');
      const src = d.agentType === 'treasury' ? '🏦' : '💳';
      const reasoning = typeof d.reasoning === 'string'
        ? d.reasoning.substring(0, 100)
        : String(d.reasoning).substring(0, 100);
      return `${src} \`${time}\` *${d.action}*\n${reasoning}`;
    });

    await this.send('🧠 *Recent Decisions*\n\n' + lines.join('\n\n'));
  }

  private async cmdDialogue(): Promise<void> {
    const rounds = this.agentDialogue?.getRecentDialogues(1) || [];
    if (rounds.length === 0) {
      await this.send('No board meetings yet. Wait ~45s for the first round.');
      return;
    }

    const r = rounds[0];
    const lines: string[] = [
      `💬 *Board Meeting: ${r.topic}*`,
      `_${r.topicPrompt}_`,
      '',
    ];

    for (const turn of r.turns) {
      const icon = turn.speaker === 'treasury' ? '🏦' : turn.speaker === 'credit' ? '💳' : '🤝';
      const msg = turn.message.substring(0, 200);
      lines.push(`${icon} *${turn.speaker}*: ${msg}`);
    }

    if (r.consensus) {
      lines.push('', `✅ *Consensus*: ${r.consensus.substring(0, 300)}`);
    }

    await this.send(lines.join('\n'));
  }

  private async cmdLoans(): Promise<void> {
    const loans = this.creditAgent.getAllActiveLoans();
    if (loans.length === 0) {
      await this.send('No active loans.');
      return;
    }

    const lines = loans.map(l => {
      const principal = (parseFloat(l.principal) / 1e6).toFixed(2);
      const repaid = (parseFloat(l.repaid) / 1e6).toFixed(2);
      const addr = l.borrower.substring(0, 8) + '…';
      return `• Loan #${l.id} — ${addr} — ${principal} USDt (repaid: ${repaid})`;
    });

    await this.send('💰 *Active Loans*\n\n' + lines.join('\n'));
  }

  private async cmdPause(): Promise<void> {
    try {
      await this.treasuryAgent.emergencyPause();
      await this.send('🛑 *Emergency pause activated.*');
    } catch (err) {
      await this.send(`❌ Pause failed: ${(err as Error).message}`);
    }
  }

  private async cmdUnpause(): Promise<void> {
    // There is no unpause in agent — just restart the monitoring loop
    await this.send('⚠️ Unpause not yet implemented — restart the backend to resume.');
  }

  private async cmdBudget(): Promise<void> {
    const state = this.treasuryAgent.getState();
    const loans = this.creditAgent.getAllActiveLoans();

    const bal = parseFloat(state?.balance ?? '0') / 1e6;
    const yieldTotal = (state?.yieldPositions ?? []).reduce(
      (sum, p) => sum + parseFloat(p.amount) / 1e6, 0,
    );
    const lentTotal = loans.reduce(
      (sum, l) => sum + (parseFloat(l.principal) - parseFloat(l.repaid)) / 1e6, 0,
    );

    await this.send([
      '💼 *Budget Breakdown*',
      `Vault balance: \`${bal.toFixed(2)} USDt\``,
      `In yield: \`${yieldTotal.toFixed(2)} USDt\``,
      `Lent out: \`${lentTotal.toFixed(2)} USDt\``,
      `Total managed: \`${(bal + yieldTotal + lentTotal).toFixed(2)} USDt\``,
    ].join('\n'));
  }

  private async cmdInvest(args: string[]): Promise<void> {
    if (args.length < 2) {
      await this.send('Usage: `/invest <protocol> <amount_usdt>`\nE.g. `/invest aave 100`');
      return;
    }

    const protocol = args[0];
    const amountUsdt = parseFloat(args[1]);
    if (isNaN(amountUsdt) || amountUsdt <= 0) {
      await this.send('❌ Invalid amount.');
      return;
    }

    const amountRaw = BigInt(Math.floor(amountUsdt * 1e6));

    try {
      const hash = await this.treasuryAgent.proposeYieldInvestment(protocol, amountRaw, 0);
      if (!hash) {
        await this.send('❌ Investment rejected by agent.');
        return;
      }
      await this.send(`✅ *Yield investment proposed*\nProtocol: ${protocol}\nAmount: ${amountUsdt} USDt\nTx: \`${hash}\``);
    } catch (err) {
      await this.send(`❌ Investment failed: ${(err as Error).message}`);
    }
  }

  // ─── Event Notifications ───────────────────────────────────

  private subscribeEvents(): void {
    this.unsubscribe = EventBus.subscribeAll((event: AgentEvent) => {
      this.handleEvent(event).catch(err =>
        logger.error('TelegramBot event handler error', { err: (err as Error).message || err }),
      );
    });
  }

  private async handleEvent(event: AgentEvent): Promise<void> {
    switch (event.type) {
      case 'dialogue:consensus': {
        const { topic, consensus } = event.payload as { topic?: string; consensus?: string };
        if (topic && consensus) {
          await this.send(
            `🤝 *Board Decision: ${topic}*\n${consensus.substring(0, 400)}`,
          );
        }
        break;
      }

      case 'credit:loan_created': {
        const { borrower, amount } = event.payload as { borrower: string; amount: string };
        const amtUsd = (parseFloat(amount) / 1e6).toFixed(2);
        await this.send(
          `💳 *New Loan*\nBorrower: \`${borrower}\`\nAmount: ${amtUsd} USDt`,
        );
        break;
      }

      case 'treasury:emergency': {
        await this.send(
          `🚨 *EMERGENCY*\n${event.payload.reason || 'Unknown emergency triggered'}`,
        );
        break;
      }

      // Large transactions → require approval via inline buttons
      case 'treasury:withdrawal_proposed': {
        const { to, amount } = event.payload as { to: string; amount: string };
        const amtUsd = parseFloat(amount) / 1e6;
        if (amtUsd >= 1000) {
          await this.requestApproval('withdrawal', {
            to,
            amount,
            amtUsd: amtUsd.toFixed(2),
          });
        }
        break;
      }

      case 'treasury:yield_proposed': {
        const { protocol, amount } = event.payload as { protocol: string; amount: string };
        const amtUsd = parseFloat(amount) / 1e6;
        if (amtUsd >= 500) {
          await this.requestApproval('yield_invest', {
            protocol,
            amount,
            amtUsd: amtUsd.toFixed(2),
          });
        }
        break;
      }
    }
  }

  // ─── Approval Flow ────────────────────────────────────────

  /** Register inline button callback handler */
  private registerCallbackHandler(): void {
    this.bot.on('callback_query', async (query) => {
      const chatId = String(query.message?.chat?.id);
      if (chatId !== this.chatId) return;

      const data = query.data;
      if (!data) return;

      // Parse callback: approve:<id> or reject:<id>
      const [action, approvalId] = data.split(':');
      if (!approvalId || (action !== 'approve' && action !== 'reject')) return;

      const pending = this.pendingApprovals.get(approvalId);
      if (!pending) {
        await this.bot.answerCallbackQuery(query.id, { text: '⏰ Expired or already handled.' });
        return;
      }

      // Check TTL
      if (Date.now() - pending.createdAt > TelegramBot.APPROVAL_TTL_MS) {
        this.pendingApprovals.delete(approvalId);
        await this.bot.answerCallbackQuery(query.id, { text: '⏰ Approval expired (10min).' });
        return;
      }

      this.pendingApprovals.delete(approvalId);

      if (action === 'reject') {
        await this.bot.answerCallbackQuery(query.id, { text: '❌ Rejected' });
        await this.send(`❌ *${pending.type} rejected* by owner.`);
        logger.info(`Approval ${approvalId} rejected`, { type: pending.type, data: pending.data });
        return;
      }

      // Approve — execute the action
      await this.bot.answerCallbackQuery(query.id, { text: '✅ Approved — executing...' });
      await this.executeApproval(pending.type, pending.data, approvalId);
    });
  }

  /** Send an approval request with inline Approve/Reject buttons */
  private async requestApproval(
    type: 'withdrawal' | 'yield_invest',
    data: Record<string, unknown>,
  ): Promise<void> {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.pendingApprovals.set(id, { type, data, createdAt: Date.now() });

    // Cleanup stale entries
    for (const [key, val] of this.pendingApprovals) {
      if (Date.now() - val.createdAt > TelegramBot.APPROVAL_TTL_MS) {
        this.pendingApprovals.delete(key);
      }
    }

    const desc = type === 'withdrawal'
      ? `⚠️ *Large Withdrawal Proposed*\nTo: \`${data.to}\`\nAmount: ${data.amtUsd} USDt`
      : `⚠️ *Yield Investment Proposed*\nProtocol: ${data.protocol}\nAmount: ${data.amtUsd} USDt`;

    const keyboard: TelegramBotApi.InlineKeyboardMarkup = {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `approve:${id}` },
        { text: '❌ Reject', callback_data: `reject:${id}` },
      ]],
    };

    try {
      await this.bot.sendMessage(this.chatId, desc + '\n\n_Expires in 10 minutes._', {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      try {
        await this.bot.sendMessage(this.chatId, desc + '\n\nExpires in 10 minutes.', {
          reply_markup: keyboard,
        });
      } catch (err) {
        logger.error('TelegramBot approval send error', { err: (err as Error).message });
      }
    }
  }

  /** Execute an approved action */
  private async executeApproval(
    type: 'withdrawal' | 'yield_invest',
    data: Record<string, unknown>,
    approvalId: string,
  ): Promise<void> {
    try {
      if (type === 'withdrawal') {
        // For now, log + notify — the actual withdrawal execution depends on
        // the treasury agent's workflow (it may already be in the pending queue)
        await this.send(
          `✅ *Withdrawal approved*\nTo: \`${data.to}\`\nAmount: ${data.amtUsd} USDt\n_Agent will execute the pending transaction._`,
        );
        logger.info(`Withdrawal approved via Telegram`, { approvalId, data });
      } else if (type === 'yield_invest') {
        const protocol = data.protocol as string;
        const amountRaw = BigInt(data.amount as string);
        const hash = await this.treasuryAgent.proposeYieldInvestment(protocol, amountRaw, 0);
        if (hash) {
          await this.send(
            `✅ *Yield investment executed*\nProtocol: ${protocol}\nAmount: ${data.amtUsd} USDt\nTx: \`${hash}\``,
          );
        } else {
          await this.send(`❌ *Yield investment failed* — agent rejected.`);
        }
      }
    } catch (err) {
      await this.send(`❌ *Execution failed*: ${(err as Error).message}`);
      logger.error('Approval execution failed', { approvalId, type, err: (err as Error).message });
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  /** Only process messages from the whitelisted chat */
  private guard(msg: TelegramBotApi.Message, handler: () => void | Promise<void>): void {
    if (String(msg.chat.id) !== this.chatId) {
      logger.warn(`TelegramBot: unauthorized chat ${msg.chat.id}`);
      return;
    }
    Promise.resolve(handler()).catch(err =>
      logger.error('TelegramBot command error', { err }),
    );
  }

  private async send(text: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    } catch {
      // Markdown parse failed — retry without formatting
      try {
        await this.bot.sendMessage(this.chatId, text);
      } catch (err) {
        logger.error('TelegramBot send error', { err: (err as Error).message });
      }
    }
  }

  private statusEmoji(status: string): string {
    switch (status) {
      case 'active': return '🟢';
      case 'paused': return '🟡';
      case 'error': return '🔴';
      default: return '⚪';
    }
  }
}
