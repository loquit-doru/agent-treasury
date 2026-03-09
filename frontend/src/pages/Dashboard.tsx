import { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Users,
  BarChart3,
  Wallet,
  PauseCircle,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { LiveLogs } from '../components/LiveLogs';
import { BonusFeatures } from '../components/BonusFeatures';
import { useDashboard } from '../hooks/useDashboard';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatAmount, formatPercentage } from '../utils/format';
import type {
  AgentStatusData,
  AgentDecision,
  DashboardData,
  TreasuryState,
  YieldPosition,
  PendingTransaction
} from '../types';
import { AgentStatus } from '../components/AgentStatus';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

import { apiUrl, wsUrl } from '../utils/api';

const WS_URL = wsUrl();

// API helpers for Quick Actions
const syncTreasury = async () => {
  try {
    const res = await fetch(apiUrl('/api/treasury/sync'), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to sync treasury');
  } catch (err) {
    console.error(err);
  }
};

const pauseAgents = async () => {
  try {
    const res = await fetch(apiUrl('/api/emergency/pause'), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to pause agents');
  } catch (err) {
    console.error(err);
  }
};

export default function Dashboard() {
  const { data, isLoading, error, refresh } = useDashboard();
  const { isConnected, lastMessage } = useWebSocket(WS_URL);

  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatusData>({
    treasury: 'idle',
    credit: 'idle',
  });
  
  // Historical balance data for the chart (last 24 updates)
  const [balanceHistory, setBalanceHistory] = useState<{ time: string, balance: number }[]>([]);

  // Live "seconds ago" counter
  const [lastFetch, setLastFetch] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastFetch) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastFetch]);

  // Normalize raw EventBus events ({ type, source, payload }) into AgentDecision shape
  const normalizeDecision = (raw: Record<string, unknown>): AgentDecision => {
    if (raw.action && raw.agentType) return raw as unknown as AgentDecision;
    // payload may contain { action, reasoning, data, status } from enhanced events
    const payload = (raw.payload || {}) as Record<string, unknown>;
    return {
      id: (raw.id as string) || `${raw.type || 'event'}-${raw.timestamp || Date.now()}`,
      agentType: (raw.agentType || raw.source || 'treasury') as AgentDecision['agentType'],
      action: (payload.action || raw.action || raw.type || 'unknown') as string,
      reasoning: (payload.reasoning || raw.reasoning || '') as string,
      data: (payload.data || raw.data || raw.payload || {}) as Record<string, unknown>,
      txHash: (payload.txHash || raw.txHash) as string | undefined,
      status: (payload.status || raw.status || 'executed') as AgentDecision['status'],
      timestamp: (raw.timestamp || Date.now()) as number,
    };
  };

  // Merge REST + WS data
  useEffect(() => {
    if (data) {
      const normalized = (data.agentDecisions || []).map((d: AgentDecision) => normalizeDecision(d as unknown as Record<string, unknown>));
      setDecisions(normalized);
      setLastFetch(Date.now());
      setAgentStatus({
        treasury: data.agentStatus?.treasury || 'idle',
        credit: data.agentStatus?.credit || 'idle',
      });
      // Initialize balance history with current if empty
      if (balanceHistory.length === 0 && data.treasury) {
        setBalanceHistory([{ 
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
          balance: Number(data.treasury.balance) / 1e6 
        }]);
      }
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
      const wsNormalized = (msg.data.agentDecisions || []).map((d: AgentDecision) => normalizeDecision(d as unknown as Record<string, unknown>));
      setDecisions(wsNormalized);
      setAgentStatus({
        treasury: msg.data.agentStatus?.treasury || 'idle',
        credit: msg.data.agentStatus?.credit || 'idle',
      });
      
      if (msg.data.treasury) {
        const newBalance = Number(msg.data.treasury.balance) / 1e6;
        const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        setBalanceHistory(prev => {
          const updated = [...prev, { time: timeStr, balance: newBalance }];
          return updated.slice(-24); // Keep last 24 points
        });
      }
    }
    if (msg.type === 'agent:event') {
      // Append live event as decision
      const event = normalizeDecision(msg.data as unknown as Record<string, unknown>);
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
  
  // Prepare Credit Score Distribution data
  const scoreDistribution = [
    { name: 'Poor (<600)', count: 0, color: '#ef4444' },     // red-500
    { name: 'Fair (600-699)', count: 0, color: '#eab308' },  // yellow-500
    { name: 'Good (700-799)', count: 0, color: '#3b82f6' },  // blue-500
    { name: 'Excellent (800+)', count: 0, color: '#22c55e' } // green-500
  ];
  
  if (data?.creditProfiles) {
    data.creditProfiles.forEach(p => {
      if (p.score < 600) scoreDistribution[0].count++;
      else if (p.score < 700) scoreDistribution[1].count++;
      else if (p.score < 800) scoreDistribution[2].count++;
      else scoreDistribution[3].count++;
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
         <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Mission Control</h2>
            <div className="flex items-center gap-3">
               <p className="text-sm text-gray-400">AgentTreasury real-time overview and health</p>
               <div className="h-4 w-px bg-gray-800" />
               <AgentStatus status={agentStatus} wsConnected={isConnected || !!data} />
               <div className="h-4 w-px bg-gray-800" />
               <span className="text-[11px] text-gray-500 font-mono tabular-nums">
                 updated {secondsAgo}s ago
               </span>
            </div>
         </div>
         {/* Quick Actions Panel */}
         <div className="flex gap-3">
             <button
               onClick={syncTreasury}
               className="inline-flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 hover:border-gray-700 transition-colors"
             >
               <RefreshCw className="w-4 h-4 text-green-400" />
               Sync Treasury
             </button>
             <button
               onClick={() => {
                 if (window.confirm('Are you sure you want to pause all agent activities? This action requires multi-sig to resume.')) {
                   pauseAgents();
                 }
               }}
               className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-all hover:scale-105"
             >
               <PauseCircle className="w-4 h-4" />
               Emergency Pause
             </button>
         </div>
      </div>

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
          icon={<DollarSign className="w-5 h-5 text-cyan-400" />}
          label="Treasury Balance"
          value={`$${(Number(treasury.balance) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USDt`}
          sub="Vault holdings"
        />
        <KPICard
          icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
          label="Daily Volume"
          value={`$${(Number(treasury.dailyVolume) / 1e6).toLocaleString('en-US')} USDt`}
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
                    (s: number, p: YieldPosition) => s + p.apy,
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Treasury Balance History (Last 24 updates)" icon={<Activity className="w-4 h-4 text-green-400" />}>
          <div className="h-[250px] w-full pt-4">
            {balanceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceHistory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }}
                    itemStyle={{ color: '#22d3ee' }}
                  />
                  <Area type="monotone" dataKey="balance" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center">
                 <EmptyState text="Waiting for initial data..." />
               </div>
            )}
          </div>
        </Panel>
        
        <Panel title="Credit Score Distribution" icon={<BarChart3 className="w-4 h-4 text-blue-400" />}>
            <div className="h-[250px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} margin={{ top: 5, right: 0, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} angle={-15} textAnchor="end" />
                <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#374151', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Treasury + Credit panels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Loans */}
          <Panel title="Active Loans" icon={<Users className="w-4 h-4 text-emerald-400" />}>
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
                      <tr key={loan.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 font-mono text-gray-300">
                          {loan.borrower.slice(0, 6)}...
                          {loan.borrower.slice(-4)}
                        </td>
                        <td className="py-3 text-right text-white font-medium">
                          {formatAmount(loan.principal)} USDt
                        </td>
                        <td className="py-3 text-right text-gray-400">
                          {formatPercentage(loan.interestRate / 100)}
                        </td>
                        <td className="py-3 text-right text-gray-400">
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

          {/* Pending Transactions */}
          <Panel title="Pending Transactions (Multi-sig)" icon={<Wallet className="w-4 h-4 text-cyan-400" />}>
            {treasury.pendingTransactions.length === 0 ? (
              <EmptyState text="No pending transactions" />
            ) : (
              <div className="divide-y divide-gray-800">
                {treasury.pendingTransactions.map((tx: PendingTransaction) => (
                  <div
                    key={tx.txHash}
                    className="py-4 flex items-center justify-between hover:bg-gray-800/10 transition-colors px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-gray-400" />
                       </div>
                       <div>
                        <p className="text-sm font-mono text-gray-300">
                          {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tx.signatures} sig(s) &middot;{' '}
                          <span className={tx.executed ? "text-green-500" : "text-yellow-500"}>
                            {tx.executed ? 'Executed' : 'Pending'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
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
                {treasury.yieldPositions.map((pos: YieldPosition, i: number) => (
                  <div
                    key={i}
                    className="py-4 flex items-center justify-between hover:bg-gray-800/10 transition-colors px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-purple-900/30 flex items-center justify-center border border-purple-500/20">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                       </div>
                       <div>
                        <p className="text-sm font-medium text-white capitalize">
                          {pos.protocol}
                        </p>
                        <p className="text-xs text-purple-400 font-medium">
                          {formatPercentage(pos.apy)} APY
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {formatAmount(pos.amount)} USDt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </div>

        {/* Right: Agent Activity Timeline & Live Logs */}
        <div className="lg:col-span-1 space-y-6">
           {/* Activity Timeline Overlaying LiveLogs conceptually, keeping the LiveLogs component untouched but presenting a clean timeline */}
           <Panel title="Agent Activity Timeline" icon={<Zap className="w-4 h-4 text-yellow-500" />}>
              <div className="relative pl-6 border-l border-gray-800/50 ml-4 space-y-6 py-2 h-[450px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                {decisions.length === 0 ? (
                   <EmptyState text="Waiting for agent actions..." />
                ) : (
                  decisions.slice(0, 20).map((decision, i) => (
                    <div key={decision.id || i} className={`relative transition-all duration-700 overflow-hidden ${i === 0 ? 'animate-pulse-once' : ''}`}>
                      {/* Timeline dot */}
                      <span className={`absolute -left-[30px] top-1.5 flex h-3 w-3 rounded-full ring-4 ring-gray-900 ${
                         decision.agentType === 'treasury' ? 'bg-cyan-500' : 'bg-emerald-500'
                      } ${i === 0 ? 'animate-ping-slow' : ''}`} />
                      
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                           <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900/50 border border-gray-800/50 ${
                             decision.agentType === 'treasury' ? 'text-cyan-400' : 'text-emerald-400'
                           }`}>
                             {decision.agentType}
                           </span>
                           <span className="text-[10px] text-gray-500 font-mono">
                             {new Date(decision.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                           </span>
                        </div>
                        
                        <h4 className="text-sm font-bold text-white/90 capitalize leading-tight">
                           {(decision.action || 'Unknown Action').replace(/_/g, ' ')}
                        </h4>
                        
                        <p className="text-[12px] text-gray-400 leading-relaxed mt-0.5 break-words overflow-hidden line-clamp-3">
                          {decision.reasoning}
                        </p>
                        
                        {(decision.status === 'failed' || decision.txHash) && (
                          <div className="mt-2 flex items-center gap-3">
                            {decision.status === 'failed' && (
                               <div className="text-[10px] text-red-400 flex items-center gap-1 font-medium bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20">
                                  <XCircle className="w-3 h-3 shrink-0" /> Failed
                               </div>
                            )}
                            {decision.txHash && (
                               <div className="text-[10px] text-gray-500 font-mono bg-gray-900/50 px-1.5 py-0.5 rounded border border-gray-800/50 truncate max-w-[150px]">
                                  Tx: {decision.txHash.slice(0,6)}...{decision.txHash.slice(-4)}
                               </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
           </Panel>

           <LiveLogs decisions={decisions} />

        </div>
      </div>

      {/* ── Bonus Features Section ── */}
      <BonusFeatures />

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
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:bg-gray-750 transition-colors shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black text-white tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-2 font-medium">{sub}</p>
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
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-2 bg-gray-800/80">
        {icon}
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center">
       <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-gray-600" />
       </div>
       <p className="text-sm font-medium text-gray-500">{text}</p>
    </div>
  );
}

// Ensure Zap is imported if it wasn't
function Zap(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
