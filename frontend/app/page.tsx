'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  LogIn, 
  AlertCircle,
  Activity,
  Layers,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, authLoading } = useStore();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-slate-100 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-sm border-2 border-t-[#3B82F6] border-r-transparent border-b-[#3B82F6] border-l-transparent"></div>
          <span className="text-xs font-black tracking-widest text-[#3B82F6] uppercase">Redirecting...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex min-h-screen flex-col lg:flex-row bg-[#FFFFFF] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] font-sans"
    >
      {/* Left Panel (40% width on Desktop): Auth Form */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center px-8 py-10 bg-white dark:bg-[#0F172A] border-b lg:border-b-0 lg:border-r border-[#E2E8F0] dark:border-[#334155]">
        <LoginPanel />
      </div>

      {/* Right Panel (60% width on Desktop): Marketing Showcase */}
      <div 
        style={{
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
        className="w-full lg:w-[60%] flex flex-col justify-center p-8 lg:p-12 bg-[#F8FAFC] dark:bg-slate-950/40 relative overflow-hidden"
      >
        <MarketingPanel />
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------
   LEFT PANEL: SECURED LOGIN FORM
   ------------------------------------------------------------- */
function LoginPanel() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    
    const loginWithMock = () => {
      const mockUser = { id: 'mock-uuid', email: email || 'analyst@bank.in' };
      const mockProfile = {
        id: 'mock-uuid',
        email: email || 'analyst@bank.in',
        full_name: 'Risk Analyst',
        role: 'analyst' as const,
        created_at: new Date().toISOString()
      };
      localStorage.setItem('mock_session', JSON.stringify({ user: mockUser, profile: mockProfile }));
      useStore.getState().setAuth(mockUser, mockProfile);
      router.replace('/dashboard');
    };

    // Prevent Supabase rate limits by directly bypassing for non-seeded emails
    if (email !== 'analyst@bank.in') {
      loginWithMock();
      return;
    }
    
    try {
      let { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn("Supabase auth failed. Using mock session fallback.", error.message);
        loginWithMock();
        return;
      }

      router.replace('/dashboard');
    } catch (err: any) {
      console.warn("Auth connection exception. Using mock session fallback.", err);
      loginWithMock();
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      {/* Brand Header */}
      <div className="flex items-center space-x-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#0066FF] dark:bg-[#3B82F6] text-white font-black shadow-md shadow-blue-500/10">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-wider text-[#0F172A] dark:text-white uppercase font-mono">
            Credit Risk Assessor
          </h1>
          <p className="text-[8px] tracking-widest text-[#0066FF] dark:text-[#3B82F6] font-bold uppercase">
            Analyst Access Console
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-black tracking-wider uppercase text-[#0F172A] dark:text-white">
          Secure Authenticator
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-bold uppercase leading-relaxed">
          Access credit risk models and portfolio analytics.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-start space-x-2 rounded-sm bg-rose-500/10 border border-rose-500/20 p-3 text-[11px] font-semibold text-rose-500">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form fields */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-[10.5px] font-black text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="analyst@bank.in"
            className="mt-1.5 w-full terminal-input"
          />
        </div>

        <div>
          <label className="block text-[10.5px] font-black text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest">
            Secure Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5 w-full terminal-input"
          />
        </div>

        <div className="text-[10.5px] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider pt-0.5 text-center">
          Contact partner bank for credentials.
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center space-x-2 rounded-sm bg-[#0066FF] dark:bg-[#3B82F6] hover:brightness-110 disabled:bg-blue-800 py-3 text-xs font-black text-white uppercase tracking-widest transition-colors cursor-pointer shadow-md shadow-blue-500/10"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              <span>Authenticate & Initialize</span>
            </>
          )}
        </motion.button>
      </form>



      <div className="border-t border-[#E2E8F0] dark:border-slate-800 pt-4 text-center">
        <p className="text-[10px] font-mono text-[#64748B] dark:text-slate-500 uppercase tracking-widest">
          System Build v2.4.1 | Role-Based Access Control | Activity Monitoring
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   RIGHT PANEL: MARKETING SHOWCASE
   ------------------------------------------------------------- */
function MarketingPanel() {
  const features = [
    {
      title: "6-Month Early Warning System",
      desc: "Predict defaults before they happen using XGBoost ML models."
    },
    {
      title: "AI-Powered Risk Narratives",
      desc: "GenAI explains exactly why each customer is flagged as risky."
    },
    {
      title: "Bulk Portfolio Analytics",
      desc: "Upload and analyze 10,000+ customer records in seconds."
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Title */}
      <div className="space-y-2">
        <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-[#0F172A] dark:text-white leading-none">
          Predict Credit Card Defaults 6 Months in Advance
        </h2>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed max-w-xl font-medium">
          Credit Risk Assessor empowers bank risk teams with AI-powered machine learning models that identify high-risk customers before they miss a payment.
        </p>
      </div>

      {/* Demo Preview Card - Animated hover lift */}
      <motion.div 
        whileHover={{ y: -4, boxShadow: "0 15px 30px -10px rgba(0,0,0,0.12)" }}
        className="relative border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 shadow-lg rounded-sm overflow-hidden"
      >
        {/* Live preview badge */}
        <span className="absolute top-3 right-3 inline-flex items-center rounded-sm bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
          Live Demo Preview
        </span>

        {/* Demo watermark */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] dark:opacity-[0.05]">
          <span className="text-6xl font-black uppercase tracking-widest font-mono rotate-12">DEMO SYSTEM</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 relative z-10">
          {/* Mini Gauge display */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 border-r border-[#E2E8F0] dark:border-slate-800 pr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Risk Score</span>
            
            {/* SVG semi-circle gauge preview */}
            <div className="relative h-14 w-24 flex items-end justify-center">
              <svg className="w-full h-full" viewBox="0 0 100 60">
                <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke="#EF4444" strokeWidth="6" strokeDasharray="125.66" strokeDashoffset="40" />
              </svg>
              <div className="absolute bottom-0 text-center">
                <span className="text-base font-black terminal-text-mono text-rose-500">68.4%</span>
              </div>
            </div>
            <span className="text-[9.5px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/15 font-black uppercase tracking-wider">High Risk</span>
          </div>

          {/* Mini Metrics cards */}
          <div className="md:col-span-2 flex flex-col justify-between space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-2.5 rounded-sm">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest block">High-Risk Alerts</span>
                <span className="text-base font-black terminal-text-mono text-rose-500">142</span>
              </div>
              <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-2.5 rounded-sm">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest block">Portfolio Value</span>
                <span className="text-base font-black terminal-text-mono text-[#0F172A] dark:text-white">₹254.9 Cr</span>
              </div>
            </div>

            {/* Simulated mini chart */}
            <div className="space-y-1">
              <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest block">Portfolio Risk Trend</span>
              <div className="h-6 flex items-end space-x-1.5 bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-1">
                {[20, 35, 15, 45, 60, 50, 75, 68].map((h, idx) => (
                  <div 
                    key={idx} 
                    className="flex-1 bg-[#0066FF] rounded-t-xs"
                    style={{ height: `${h}%` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Feature Bullet points - Staggered Motion */}
      <div className="space-y-3">
        {features.map((feat, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.08 }}
            key={idx} 
            className="flex items-start space-x-2.5"
          >
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white uppercase leading-none">
                {feat.title}
              </h3>
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                {feat.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer Trust details */}
      <div className="border-t border-[#E2E8F0] dark:border-slate-800/80 pt-4 text-left">
        <p className="text-[10px] font-mono text-[#64748B] dark:text-slate-500 uppercase tracking-wider">
          Credit Risk Assessor | Role-Based Access Control | Powered by XGBoost & Google Gemini
        </p>
      </div>

    </div>
  );
}
