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
        router.replace('/dashboard');
      } else {
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
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] font-sans transition-colors duration-200">
      
      {/* Left Panel: Auth Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:w-[450px] lg:w-[480px] lg:px-12 bg-white dark:bg-[#0F172A] border-r border-[#E2E8F0] dark:border-[#334155]">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo header */}
          <div className="flex items-center space-x-2.5 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#2563EB] dark:bg-[#3B82F6] text-white font-bold shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider text-[#0F172A] dark:text-white uppercase">Risk Assessor</h1>
              <p className="text-[8px] tracking-widest text-[#2563EB] dark:text-[#3B82F6] font-bold uppercase">Credit Default Console</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black tracking-wider uppercase text-[#0F172A] dark:text-white">
              {isRegistering ? 'Register Analyst Profile' : 'Secured Access Console'}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase">
              {isRegistering 
                ? 'Request credentials for portfolio default probability assessments.' 
                : 'Access CIBIL score dynamics and credit risk models.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mt-5 flex items-start space-x-2 rounded bg-rose-500/10 border border-rose-500/20 p-3 text-[11px] font-semibold text-rose-500">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="mt-6 space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="mt-1.5 w-full terminal-input"
                />
              </div>
            )}

            <div>
              <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
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
              <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Secure Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full terminal-input"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Departmental Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="mt-1.5 w-full terminal-input"
                >
                  <option value="analyst">Risk Analyst (Read/Write)</option>
                  <option value="risk_officer">Risk Officer (Approve Strategy)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center space-x-1.5 rounded-sm bg-[#2563EB] dark:bg-[#3B82F6] hover:brightness-110 disabled:bg-blue-800 py-2.5 text-xs font-black text-white uppercase tracking-widest transition-colors cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : isRegistering ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Secure Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg('');
              }}
              className="text-[10px] text-[#2563EB] dark:text-[#3B82F6] hover:underline font-black tracking-widest transition-colors uppercase cursor-pointer"
            >
              {isRegistering ? 'Already have an account? Log In' : 'New here? Create an account'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Hero Graphic Panel */}
      <div className="hidden flex-1 flex-col items-center justify-center p-12 bg-slate-100 dark:bg-slate-950 lg:flex">
        <div className="max-w-sm text-center space-y-6">
          <div className="relative inline-flex items-center justify-center rounded-sm border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B]/70 p-6 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Active Portfolio Statistics</span>
                <span className="text-[8px] rounded-sm bg-emerald-500/10 px-2 py-0.5 text-emerald-400 font-bold border border-emerald-500/20">STABLE</span>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="space-y-1 text-left">
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Total Exposure</p>
                  <p className="text-base font-extrabold terminal-text-mono text-[#0F172A] dark:text-white">INR 254.9 Cr</p>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Weighted Portfolio PD</p>
                  <p className="text-base font-extrabold terminal-text-mono text-rose-500">32.75%</p>
                </div>
              </div>
              <div className="h-1.5 w-full bg-[#E2E8F0] dark:bg-slate-900 rounded-none overflow-hidden">
                <div className="h-full w-[32%] bg-[#3B82F6]"></div>
              </div>
              <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8] text-left leading-relaxed">
                Secured via Row Level Security (RLS) policies. Linked with an XGBoost ML predictive engine and SHAP explainability.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-black tracking-wider uppercase text-[#0F172A] dark:text-white">Credit Default Risk Assessor</h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Predicting 6-month credit card defaults using CIBIL trajectories, SHAP feature metrics, and automated collection strategies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
