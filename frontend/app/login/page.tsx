'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { ShieldCheck, LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { authLoading, setAuthLoading } = useStore();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'analyst' | 'risk_officer'>('analyst');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // AuthProvider will detect the change and redirect
      router.replace('/dashboard');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (!fullName) {
        throw new Error('Please enter your full name');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) throw error;
      
      if (data?.session) {
        // Automatically signed in
        router.replace('/dashboard');
      } else {
        // Confirmation email required
        setErrorMsg('Registration successful! Please check your email for confirmation link.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Registration failed.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Left Panel: Auth Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:w-[450px] lg:w-[500px] lg:px-12 bg-slate-900/40 border-r border-slate-900">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo header */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white uppercase">ANTIGRAVITY</h1>
              <p className="text-[10px] tracking-wider text-slate-400 font-semibold uppercase">Risk Analytics Division</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {isRegistering ? 'Register Officer Account' : 'Analyst Command Center'}
            </h2>
            <p className="text-sm text-slate-400">
              {isRegistering 
                ? 'Request credentials for the Indian Banking Default risk assessor.' 
                : 'Access default risk probability matrix and collections engine.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mt-6 flex items-start space-x-2.5 rounded-lg bg-red-950/40 border border-red-900/50 p-3.5 text-xs text-red-300">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="mt-8 space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@bank.in"
                className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Secure Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Departmental Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="analyst">Risk Analyst (Read/Write)</option>
                  <option value="risk_officer">Risk Officer (Approve Strategy)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center space-x-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 py-3 text-sm font-semibold text-slate-950 transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></div>
              ) : isRegistering ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Request Account</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Secure Access</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg('');
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold tracking-wide transition-colors uppercase cursor-pointer"
            >
              {isRegistering ? 'Have an active profile? Log In' : 'Need bank credentials? Request Access'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Hero Graphic Panel */}
      <div className="hidden flex-1 flex-col items-center justify-center p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black lg:flex">
        <div className="max-w-md text-center space-y-6">
          <div className="relative inline-flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-2xl glass-panel">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Active Portfolio Analysis</span>
                <span className="text-[10px] rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400 font-bold border border-emerald-500/20">LIVE</span>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Exposure</p>
                  <p className="text-lg font-extrabold text-white">INR 254.9 Cr</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Avg Portfolio PD</p>
                  <p className="text-lg font-extrabold text-rose-400">32.75%</p>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                <div className="h-full w-[32%] bg-gradient-to-r from-emerald-500 to-rose-500"></div>
              </div>
              <p className="text-[10px] text-slate-500 text-left">
                Secured via Row Level Security (RLS) on PostgreSQL. Integrated with XGBoost predictive scoring engine.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-white">Credit Default Risk Assessor</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Predicting 6-month default risks with CIBIL trajectories, SHAP explainable features, and automated collection strategies powered by Gemini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
