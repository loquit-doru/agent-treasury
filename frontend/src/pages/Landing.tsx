import { Link } from 'react-router-dom';
import {
  Shield,
  Zap,
  LineChart,
  ArrowRight,
  Activity,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navbar Minimal Setup for Landing */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                AgentTreasury <span className="text-green-400">CORE</span>
              </h1>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
          >
            Launch App
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-16 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-900/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-xs font-medium text-gray-400 mb-4 animate-pulse">
            <Zap className="w-3.5 h-3.5 text-green-400" />
            Built for Tether Hackathon Galactica: WDK Edition
          </div>

          <h2 className="text-5xl sm:text-7xl font-extrabold tracking-tight">
            AgentTreasury CORE <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-600">Autonomous CFO for DAOs</span>
          </h2>
          
          <p className="text-xl sm:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Multi-agent treasury management with on-chain credit scoring
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-8 py-4 text-base font-bold text-gray-950 hover:bg-green-400 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_-5px_var(--color-green-500)]"
            >
              Enter Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Tech stack badges */}
          <div className="pt-16 pb-8 flex flex-wrap items-center justify-center gap-4 opacity-70">
            {['Built with Tether WDK', 'Powered by OpenClaw'].map((tech) => (
              <span key={tech} className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm font-medium text-gray-300">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="bg-gray-950 py-24 border-t border-gray-900 relative">
         <div className="max-w-7xl mx-auto px-4 z-10 relative">
           <div className="text-center mb-16">
             <h3 className="text-3xl font-bold text-white mb-4">Dual-Agent Architecture</h3>
             <p className="text-gray-400 max-w-2xl mx-auto">Seamlessly automating treasury management and on-chain credit scoring.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <FeatureCard 
               icon={<Shield className="w-8 h-8 text-cyan-400" />}
               title="Treasury Agent"
               description="Multi-sig security, intelligent timelocks, and dynamic risk limits executed autonomously."
             />
             <FeatureCard 
               icon={<LineChart className="w-8 h-8 text-emerald-400" />}
               title="Credit Agent"
               description="On-chain history evaluation across 3 dynamic tiers to authorize instant, uncollateralized loans."
             />
             <FeatureCard 
               icon={<Activity className="w-8 h-8 text-blue-400" />}
               title="Real-time Dashboard"
               description="Monitor agent decisions, treasury balances, and active yield positions via WebSockets."
             />
           </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-auto bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-600" />
            <span>AgentTreasury CORE &copy; 2026</span>
          </div>
          <div>
            Built for Tether Hackathon Galactica
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 hover:bg-gray-900/80 hover:border-gray-700 transition-all group">
      <div className="w-14 h-14 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h4 className="text-xl font-semibold text-white mb-3">{title}</h4>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
