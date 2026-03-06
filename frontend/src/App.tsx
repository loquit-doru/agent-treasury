/**
 * AgentTreasury Dashboard — Main App Component
 */

import { useEffect, useState } from 'react';
import {
  Shield,
  Wallet,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Users,
  BarChart3,
} from 'lucide-react';
import { AgentStatus as AgentStatusComponent } from './components/AgentStatus';
import { LiveLogs } from './components/LiveLogs';
import { WalletConnect } from './components/WalletConnect';
import { useDashboard } from './hooks/useDashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { formatAmount, formatPercentage } from './utils/format';
import type {
  AgentStatusData,
  AgentDecision,
  DashboardData,
  TreasuryState,
} from './types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export default function App() {
  const { data, isLoading, error, refresh } = useDashboard();
  const { isConnected, lastMessage } = useWebSocket(WS_URL);

  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatusData>({
    treasury: 'idle',
    credit: 'idle',
  });

  // Merge REST + WS data
  useEffect(() => {
    if (data) {
      setDecisions(data.agentDecisions || []);
      setAgentStatus({
        treasury: data.agentStatus?.treasury || 'idle',
        credit: data.agentStatus?.credit || 'idle',
      });
    }
  }, [data]);

  // Handle real-time WS updates
  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as { type: string; data: DashboardData };
    if (
      msg.type === 'dashboard:initial' ||
      msg.type === 'dashboard:update'
    ) {
      setDecisions(msg.data.agentDecisions || []);
      setAgentStatus({
        treasury: msg.data.agentStatus?.treasury || 'idle',
        credit: msg.data.agentStatus?.credit || 'idle',
      });
    }
    if (msg.type === 'agent:event') {
      // Append live event as decision
      const event = msg.data as unknown as AgentDecision;
      if (event?.id) {
        setDecisions((prev) => [...prev, event].slice(-50));
      }
    }
  }, [lastMessage]);

  const treasury: TreasuryState = data?.treasury || {
    balance: '0',
    dailyVolume: '0',
    pendingTransactions: [],
    yieldPositions: [],
    lastUpdated: 0,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-green-400" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                AgentTreasury <span className="text-green-400">CORE</span>
              </h1>
              <p className="text-xs text-gray-500">
                Autonomous DAO CFO &mdash; Tether Hackathon Galactica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AgentStatusComponent
              status={agentStatus}
              wsConnected={isConnected}
            />
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-sm">{error}</span>
            <button
              onClick={refresh}
              className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={<DollarSign className="w-5 h-5 text-green-400" />}
            label="Treasury Balance"
            value={`${formatAmount(treasury.balance)} USDt`}
            sub="Vault holdings"
          />
          <KPICard
            icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
            label="Daily Volume"
            value={`${formatAmount(treasury.dailyVolume)} USDt`}
            sub="In / Out today"
          />
          <KPICard
            icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
            label="Yield Positions"
            value={String(treasury.yieldPositions.length)}
            sub={
              treasury.yieldPositions.length > 0
                ? `Avg ${formatPercentage(
                    treasury.yieldPositions.reduce(
                      (s, p) => s + p.apy,
                      0,
                    ) / treasury.yieldPositions.length,
                  )} APY`
                : 'No active positions'
            }
          />
          <KPICard
            icon={<Users className="w-5 h-5 text-yellow-400" />}
            label="Credit Profiles"
            value={String(data?.creditProfiles?.length ?? 0)}
            sub={`${data?.activeLoans?.length ?? 0} active loans`}
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Treasury + Credit panels */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Transactions */}
            <Panel title="Pending Transactions" icon={<Wallet className="w-4 h-4 text-green-400" />}>
              {treasury.pendingTransactions.length === 0 ? (
                <EmptyState text="No pending transactions" />
              ) : (
                <div className="divide-y divide-gray-800">
                  {treasury.pendingTransactions.map((tx) => (
                    <div
                      key={tx.txHash}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-mono text-gray-300">
                          {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tx.signatures} sig(s) &middot;{' '}
                          {tx.executed ? 'Executed' : 'Pending'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-green-400">
                        {formatAmount(tx.amount)} USDt
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Yield Positions */}
            <Panel title="Yield Positions" icon={<TrendingUp className="w-4 h-4 text-purple-400" />}>
              {treasury.yieldPositions.length === 0 ? (
                <EmptyState text="No active yield positions" />
              ) : (
                <div className="divide-y divide-gray-800">
                  {treasury.yieldPositions.map((pos, i) => (
                    <div
                      key={i}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-white capitalize">
                          {pos.protocol}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatPercentage(pos.apy)} APY
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-purple-400">
                        {formatAmount(pos.amount)} USDt
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Active Loans */}
            <Panel title="Active Loans" icon={<Users className="w-4 h-4 text-yellow-400" />}>
              {(!data?.activeLoans || data.activeLoans.length === 0) ? (
                <EmptyState text="No active loans" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                        <th className="py-2 text-left">Borrower</th>
                        <th className="py-2 text-right">Principal</th>
                        <th className="py-2 text-right">Rate</th>
                        <th className="py-2 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.activeLoans.map((loan) => (
                        <tr key={loan.id}>
                          <td className="py-2 font-mono text-gray-300">
                            {loan.borrower.slice(0, 6)}...
                            {loan.borrower.slice(-4)}
                          </td>
                          <td className="py-2 text-right text-white">
                            {formatAmount(loan.principal)} USDt
                          </td>
                          <td className="py-2 text-right text-gray-400">
                            {formatPercentage(loan.interestRate / 100)}
                          </td>
                          <td className="py-2 text-right text-gray-400">
                            {new Date(
                              loan.dueDate * 1000,
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          {/* Right: Live Logs */}
          <div className="lg:col-span-1">
            <LiveLogs decisions={decisions} />
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && !data && (
          <div className="fixed inset-0 bg-gray-950/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-green-400 animate-spin" />
              <p className="text-sm text-gray-400">
                Connecting to agents...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-gray-600">
          <span>AgentTreasury CORE &mdash; Tether Hackathon Galactica: WDK Edition</span>
          <span>Powered by WDK + OpenClaw</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Reusable helper components ──────────────────────── */

function KPICard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-gray-500 text-center py-6">{text}</p>
  );
}
