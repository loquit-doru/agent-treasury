/**
 * AgentDialogue — Inter-agent LLM dialogue orchestrator
 * 
 * Every ~45s, Treasury and Credit agents hold a "board meeting" where they
 * discuss the current state of the system. Each agent speaks through the LLM,
 * sees the other's perspective, and they reach consensus. The full dialogue is
 * emitted via EventBus and appears live on the dashboard.
 */

import { LLMClient } from '../services/LLMClient';
import EventBus from './EventBus';
import logger from '../utils/logger';
import type { TreasuryAgent } from '../agents/TreasuryAgent';
import type { CreditAgent } from '../agents/CreditAgent';
import type { RiskAgent } from '../agents/RiskAgent';
import type { AgentConfig } from '../types';
import { ethers } from 'ethers';

// Dialogue topics rotate each cycle
const DIALOGUE_TOPICS = [
  {
    id: 'capital_allocation',
    prompt: 'How should we allocate treasury capital between yield farming and lending reserves?',
    context: 'Capital allocation strategy — balance between earning yield and maintaining liquidity for borrowers.',
  },
  {
    id: 'risk_review',
    prompt: 'What are the current risk factors and how should we adjust our exposure?',
    context: 'Joint risk assessment — combining treasury risk with credit portfolio risk.',
  },
  {
    id: 'yield_vs_lending',
    prompt: 'Should we increase yield positions or reserve more for lending operations?',
    context: 'Opportunity cost analysis — yield farming returns vs lending interest income.',
  },
  {
    id: 'emergency_preparedness',
    prompt: 'Are we prepared for a sudden spike in withdrawals or loan defaults?',
    context: 'Stress testing — evaluate liquidity buffers and worst-case scenarios.',
  },
  {
    id: 'portfolio_health',
    prompt: 'How healthy is our overall portfolio and what adjustments should we make?',
    context: 'Holistic portfolio review — treasury health + credit book quality.',
  },
];

interface DialogueTurn {
  speaker: 'treasury' | 'credit' | 'risk' | 'consensus';
  message: string;
  timestamp: number;
}

interface DialogueRound {
  topic: string;
  topicPrompt: string;
  turns: DialogueTurn[];
  consensus: string;
  timestamp: number;
}

export class AgentDialogue {
  private llm: LLMClient;
  private treasuryAgent: TreasuryAgent;
  private creditAgent: CreditAgent;
  private riskAgent: RiskAgent | null;
  private dialogueInterval: NodeJS.Timeout | null = null;
  private roundCount = 0;
  private recentDialogues: DialogueRound[] = [];
  private readonly maxHistory = 10;

  constructor(
    _config: AgentConfig,
    treasuryAgent: TreasuryAgent,
    creditAgent: CreditAgent,
    llmClient: LLMClient,
    riskAgent?: RiskAgent,
  ) {
    this.treasuryAgent = treasuryAgent;
    this.creditAgent = creditAgent;
    this.riskAgent = riskAgent || null;
    this.llm = llmClient;
  }

  /**
   * Start periodic dialogue rounds
   */
  start(): void {
    logger.info('AgentDialogue orchestrator starting...');

    // First dialogue after 20s (let agents initialize first)
    setTimeout(() => {
      this.runDialogueRound().catch(err =>
        logger.error('Initial dialogue round failed', { err })
      );
    }, 20000);

    // Then every 45 seconds
    this.dialogueInterval = setInterval(() => {
      this.runDialogueRound().catch(err =>
        logger.error('Dialogue round failed', { err })
      );
    }, 45000);
  }

  /**
   * Stop the dialogue orchestrator
   */
  stop(): void {
    if (this.dialogueInterval) {
      clearInterval(this.dialogueInterval);
      this.dialogueInterval = null;
    }
    logger.info('AgentDialogue orchestrator stopped');
  }

  /**
   * Run a single dialogue round between the two agents
   */
  async runDialogueRound(): Promise<void> {
    const topic = DIALOGUE_TOPICS[this.roundCount % DIALOGUE_TOPICS.length];
    this.roundCount++;

    const turns: DialogueTurn[] = [];
    const stateContext = this.gatherStateContext();

    // --- Turn 1: Treasury speaks first ---
    const treasuryMessage = await this.agentSpeak('treasury', topic, stateContext, []);
    turns.push({ speaker: 'treasury', message: treasuryMessage, timestamp: Date.now() });

    EventBus.emitEvent('dialogue:turn', 'treasury', {
      action: 'dialogue',
      reasoning: `💬 [Board Meeting — ${topic.id}] ${treasuryMessage}`,
      data: { topic: topic.id, turn: 1, speaker: 'treasury' },
      status: 'executed',
    });

    await new Promise(r => setTimeout(r, 2000));

    // --- Turn 2: Credit responds ---
    const creditMessage = await this.agentSpeak('credit', topic, stateContext, turns);
    turns.push({ speaker: 'credit', message: creditMessage, timestamp: Date.now() });

    EventBus.emitEvent('dialogue:turn', 'credit', {
      action: 'dialogue',
      reasoning: `💬 [Board Meeting — ${topic.id}] ${creditMessage}`,
      data: { topic: topic.id, turn: 2, speaker: 'credit' },
      status: 'executed',
    });

    await new Promise(r => setTimeout(r, 2000));

    // --- Turn 3: Risk Agent weighs in ---
    const riskMessage = this.riskAgent
      ? await this.agentSpeak('risk', topic, stateContext, turns)
      : this.fallbackMessage('risk', topic.id);
    turns.push({ speaker: 'risk', message: riskMessage, timestamp: Date.now() });

    EventBus.emitEvent('dialogue:turn', 'risk', {
      action: 'dialogue',
      reasoning: `💬 [Board Meeting — ${topic.id}] ${riskMessage}`,
      data: { topic: topic.id, turn: 3, speaker: 'risk' },
      status: 'executed',
    });

    await new Promise(r => setTimeout(r, 2000));

    // --- Turn 4: Treasury reacts to both ---
    const treasuryReaction = await this.agentSpeak('treasury', topic, stateContext, turns);
    turns.push({ speaker: 'treasury', message: treasuryReaction, timestamp: Date.now() });

    EventBus.emitEvent('dialogue:turn', 'treasury', {
      action: 'dialogue',
      reasoning: `💬 [Board Meeting — ${topic.id}] ${treasuryReaction}`,
      data: { topic: topic.id, turn: 4, speaker: 'treasury' },
      status: 'executed',
    });

    await new Promise(r => setTimeout(r, 2000));

    // --- Turn 5: Credit final perspective ---
    const creditReaction = await this.agentSpeak('credit', topic, stateContext, turns);
    turns.push({ speaker: 'credit', message: creditReaction, timestamp: Date.now() });

    EventBus.emitEvent('dialogue:turn', 'credit', {
      action: 'dialogue',
      reasoning: `💬 [Board Meeting — ${topic.id}] ${creditReaction}`,
      data: { topic: topic.id, turn: 5, speaker: 'credit' },
      status: 'executed',
    });

    await new Promise(r => setTimeout(r, 2000));

    // --- Consensus: Synthesize all three perspectives ---
    const consensus = await this.synthesizeConsensus(topic, stateContext, turns);
    turns.push({ speaker: 'consensus', message: consensus, timestamp: Date.now() });

    const round: DialogueRound = {
      topic: topic.id,
      topicPrompt: topic.prompt,
      turns,
      consensus,
      timestamp: Date.now(),
    };

    this.recentDialogues.push(round);
    if (this.recentDialogues.length > this.maxHistory) {
      this.recentDialogues.shift();
    }

    // Emit consensus as a special event
    EventBus.emitEvent('dialogue:consensus', 'treasury', {
      action: 'board_consensus',
      reasoning: `✅ [Board Decision — ${topic.id}] ${consensus}`,
      data: {
        topic: topic.id,
        turns: turns.length,
        speakers: turns.map(t => t.speaker),
      },
      status: 'executed',
    });

    logger.info(`Dialogue round complete: ${topic.id}`, {
      turns: turns.length,
      consensusLength: consensus.length,
    });
  }

  /**
   * Have a specific agent speak in the dialogue
   */
  private async agentSpeak(
    speaker: 'treasury' | 'credit' | 'risk',
    topic: typeof DIALOGUE_TOPICS[0],
    stateContext: string,
    previousTurns: DialogueTurn[],
  ): Promise<string> {
    const systemPrompts: Record<string, string> = {
      treasury: `You are the Treasury Agent in a board meeting with the Credit Agent and Risk Agent. You manage a USDt treasury vault — your priority is capital preservation and yield optimization. Speak in first person, be concise (2-3 sentences). Reference specific numbers from the current state.`,
      credit: `You are the Credit Agent in a board meeting with the Treasury Agent and Risk Agent. You manage lending operations and credit scoring — your priority is protecting the treasury from bad loans while enabling growth. Speak in first person, be concise (2-3 sentences). Reference specific numbers from the current state.`,
      risk: `You are the Risk & Compliance Agent in a board meeting with the Treasury Agent and Credit Agent. You are the cautious voice — focused on systemic risk, liquidity buffers, regulatory compliance, and worst-case scenarios. Challenge assumptions, flag hidden risks. Speak in first person, be concise (2-3 sentences). Reference specific numbers.`,
    };

    const speakerLabels: Record<string, string> = {
      treasury: 'Treasury Agent',
      credit: 'Credit Agent',
      risk: 'Risk Agent',
      consensus: 'Moderator',
    };

    const conversationHistory = previousTurns.map(t => {
      return `${speakerLabels[t.speaker] || t.speaker}: ${t.message}`;
    }).join('\n');

    const prompt = `${topic.context}

Current System State:
${stateContext}

Discussion Topic: ${topic.prompt}

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n\nYour response (continue the discussion, react to what was said):` : 'You speak first. Open the discussion:'}`;

    try {
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: systemPrompts[speaker] },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 120,
      });

      return response.choices[0]?.message?.content?.trim() || this.fallbackMessage(speaker, topic.id);
    } catch (error) {
      logger.error(`LLM dialogue error for ${speaker}`, { error });
      return this.fallbackMessage(speaker, topic.id);
    }
  }

  /**
   * Synthesize consensus from the dialogue
   */
  private async synthesizeConsensus(
    topic: typeof DIALOGUE_TOPICS[0],
    stateContext: string,
    turns: DialogueTurn[],
  ): Promise<string> {
    const speakerLabels: Record<string, string> = {
      treasury: 'Treasury Agent',
      credit: 'Credit Agent',
      risk: 'Risk & Compliance Agent',
    };
    const conversation = turns.map(t => {
      const role = speakerLabels[t.speaker] || t.speaker;
      return `${role}: ${t.message}`;
    }).join('\n');

    const prompt = `You are the Board Secretary synthesizing a consensus from this three-agent discussion.

Topic: ${topic.prompt}

System State:
${stateContext}

Discussion:
${conversation}

Write a 1-2 sentence consensus decision that all three agents would agree on. Be specific and actionable.`;

    try {
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: 'You are a neutral board secretary. Synthesize concise, actionable consensus from agent discussions. 1-2 sentences max.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      return response.choices[0]?.message?.content?.trim() || 'No consensus reached — revisit next cycle.';
    } catch (error) {
      logger.error('LLM consensus synthesis error', { error });
      return 'Agents agree to maintain current positions and revisit next cycle.';
    }
  }

  /**
   * Gather current state from both agents for context
   */
  private gatherStateContext(): string {
    const treasuryState = this.treasuryAgent.getState();
    const activeLoans = this.creditAgent.getAllActiveLoans();
    const profiles = this.creditAgent.getProfiles();

    const balance = treasuryState
      ? ethers.formatUnits(treasuryState.balance, 6)
      : '0';
    const dailyVolume = treasuryState
      ? ethers.formatUnits(treasuryState.dailyVolume, 6)
      : '0';
    const yieldPositions = treasuryState?.yieldPositions || [];
    const totalInvested = yieldPositions.reduce(
      (sum, p) => sum + Number(ethers.formatUnits(p.amount, 6)), 0
    );
    const totalBorrowed = activeLoans.reduce(
      (sum, l) => sum + Number(ethers.formatUnits(l.principal, 6)), 0
    );
    const overdueCount = activeLoans.filter(l => l.dueDate * 1000 < Date.now()).length;

    return [
      `Treasury Balance: ${balance} USDt`,
      `Daily Volume: ${dailyVolume} USDt`,
      `Yield Positions: ${yieldPositions.length} (total invested: ${totalInvested.toFixed(2)} USDt)`,
      `Active Loans: ${activeLoans.length} (total: ${totalBorrowed.toFixed(2)} USDt)`,
      `Overdue Loans: ${overdueCount}`,
      `Credit Profiles: ${profiles.length}`,
      `Pending Transactions: ${treasuryState?.pendingTransactions.length || 0}`,
    ].join('\n');
  }

  /**
   * Deterministic fallback messages when LLM is unavailable
   */
  private fallbackMessage(speaker: 'treasury' | 'credit' | 'risk', topic: string): string {
    if (speaker === 'treasury') {
      const messages: Record<string, string> = {
        capital_allocation: 'I recommend maintaining at least 60% liquid reserves. Yield farming is profitable but we need liquidity buffers for unexpected withdrawals.',
        risk_review: 'Current risk exposure is within acceptable limits. The vault balance provides adequate coverage for all pending obligations.',
        yield_vs_lending: 'Yield positions are generating stable returns. I suggest keeping current allocation unless lending demand increases significantly.',
        emergency_preparedness: 'We have sufficient liquid reserves to handle a 30% surge in withdrawal requests. Emergency pause is ready if needed.',
        portfolio_health: 'Portfolio is healthy with diversified yield positions. No concentration risk detected in current allocations.',
      };
      return messages[topic] || 'Treasury operations are stable. No concerns at this time.';
    } else if (speaker === 'credit') {
      const messages: Record<string, string> = {
        capital_allocation: 'From the lending side, we need at least 40% reserves for potential borrower disbursements. Current profiles suggest moderate demand ahead.',
        risk_review: 'Credit portfolio shows no defaults. All active loans are current. Risk score distribution is healthy across borrower profiles.',
        yield_vs_lending: 'Lending interest rates are competitive. If we see more borrower applications, we may need Treasury to reduce yield positions to fund loans.',
        emergency_preparedness: 'All loans have adequate collateral coverage. Default probability across the portfolio is below 5%.',
        portfolio_health: 'Credit book quality is strong — no delinquencies. I recommend opening capacity for new prime borrowers.',
      };
      return messages[topic] || 'Credit operations are stable. All loans performing as expected.';
    } else {
      const messages: Record<string, string> = {
        capital_allocation: 'I urge caution — we should stress-test the 60/40 split before committing. What if yields drop 50% simultaneously with a bank run?',
        risk_review: 'While current metrics look healthy, I see concentration risk in our Aave-only yield strategy. We should diversify protocols to limit counterparty exposure.',
        yield_vs_lending: 'Both sides make valid points, but neither addresses tail risk. I recommend a 10% emergency buffer that neither yield nor lending can touch.',
        emergency_preparedness: 'Our current buffers assume normal market conditions. In a black swan event, correlated defaults could hit both yield and credit simultaneously.',
        portfolio_health: 'The portfolio appears stable on the surface, but I want to flag that our single-protocol dependency on Aave is a systemic risk factor.',
      };
      return messages[topic] || 'From a compliance perspective, I advise maintaining conservative risk parameters until market conditions stabilize.';
    }
  }

  /**
   * Get recent dialogue rounds for API/dashboard
   */
  getRecentDialogues(limit: number = 5): DialogueRound[] {
    return this.recentDialogues.slice(-limit).reverse();
  }
}
