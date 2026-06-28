'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { motion } from 'framer-motion';
import { 
  Search, 
  User, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  FileText,
  Calendar,
  Activity,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function Customer360Page() {
  const router = useRouter();
  const { theme } = useTheme();
  const { selectedCustomerId, setSelectedCustomerId } = useStore();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCustomerId) {
      setActiveSearchId(selectedCustomerId);
      setSearchInput(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const targetId = searchInput.trim().toUpperCase();
      setActiveSearchId(targetId);
      setSelectedCustomerId(targetId);
    }
  };

  // Fetch customer details and predict risk
  const { data: customerRiskData, isLoading, error } = useQuery({
    queryKey: ['customerRisk', activeSearchId],
    queryFn: async () => {
      if (!activeSearchId) return null;

      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', activeSearchId)
        .limit(1)
        .maybeSingle();

      if (custErr) throw custErr;
      if (!custData) return { notFound: true };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const apiPayload = {
        customer_id: custData.customer_id,
        age: custData.age,
        city: custData.city,
        primary_bank: custData.primary_bank,
        card_network: custData.card_network,
        cibil_score: custData.cibil_score,
        total_credit_limit: custData.total_credit_limit,
        current_utilization_pct: custData.current_utilization_pct,
        avg_monthly_spend: custData.avg_monthly_spend,
        debt_to_income_pct: custData.debt_to_income_pct,
        payment_status_m1: custData.payment_status_m1,
        payment_status_m2: custData.payment_status_m2,
        payment_status_m3: custData.payment_status_m3,
        payment_status_m4: custData.payment_status_m4,
        payment_status_m5: custData.payment_status_m5,
        payment_status_m6: custData.payment_status_m6,
      };

      const response = await fetch(`${apiUrl}/predict-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        throw new Error('Prediction API failed');
      }

      const prediction = await response.json();

      return {
        notFound: false,
        customer: custData,
        prediction
      };
    },
    enabled: !!activeSearchId
  });

  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case 'Low Risk':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Medium Risk':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'High Risk':
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  const getPaymentStatusStyles = (status: string) => {
    switch (status) {
      case 'Full':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
      case 'MAD':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
      case 'Late':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/20';
      case 'Missed':
      default:
        return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
    }
  };

  const getGaugeColor = (score: number) => {
    if (score < 0.15) return '#10B981'; // Emerald
    if (score < 0.40) return '#F59E0B'; // Amber
    return '#EF4444'; // Rose
  };

  // SVG Gauge calculations
  const radius = 50;
  const strokeWidth = 8;
  const circumference = Math.PI * radius; // 157.08 for semi-circle
  const score = customerRiskData?.prediction?.risk_score ?? 0;
  const strokeDashoffset = circumference * (1 - score);

  return (
    <div className="space-y-6 text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Title */}
      <div className="pb-2 border-b border-[#E2E8F0] dark:border-[#334155]">
        <h2 className="text-lg font-black tracking-wider uppercase text-[#0F172A] dark:text-white">Customer 360 Risk Profile</h2>
        <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase mt-0.5">Deep-dive customer risk timelines, CIBIL metrics, and SHAP contributors.</p>
      </div>

      {/* Global Search Bar */}
      <div className="terminal-card !p-4">
        <form onSubmit={handleSearchSubmit} className="flex space-x-2 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Customer ID (e.g. IND100002)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full terminal-input pl-8"
            />
          </div>
          <button
            type="submit"
            className="rounded-sm bg-[#2563EB] hover:bg-blue-600 px-5 text-[10px] font-black text-white uppercase tracking-widest transition-colors cursor-pointer"
          >
            Query
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-44 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
          <div className="h-44 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
          <div className="h-32 rounded bg-slate-200 dark:bg-slate-800 md:col-span-2 animate-pulse"></div>
        </div>
      )}

      {customerRiskData && !customerRiskData.notFound && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Identity, Financials, Timeline - Left Panels */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity & Financials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Panel 1: Identity & Bureau */}
              <div className="terminal-card space-y-3.5">
                <div className="flex items-center space-x-2.5 pb-2.5 border-b border-[#E2E8F0] dark:border-slate-800">
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#2563EB]/10 text-[#2563EB] dark:text-[#3B82F6]">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#0F172A] dark:text-white uppercase leading-none">
                      {customerRiskData.customer.customer_name}
                    </h3>
                    <p className="text-[8px] font-mono text-slate-500 mt-1">{customerRiskData.customer.customer_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-[10px]">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">Age / City</span>
                    <span className="font-bold text-[#0F172A] dark:text-slate-200">
                      {customerRiskData.customer.age} Yrs / {customerRiskData.customer.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">Primary Bank</span>
                    <span className="font-bold text-[#0F172A] dark:text-slate-200">{customerRiskData.customer.primary_bank}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">Card Network</span>
                    <span className="font-bold text-[#0F172A] dark:text-slate-200">
                      {customerRiskData.customer.card_network.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">CIBIL Score</span>
                    <span className={`font-black terminal-text-mono flex items-center ${
                      customerRiskData.customer.cibil_score >= 750 ? 'text-emerald-500' :
                      customerRiskData.customer.cibil_score >= 650 ? 'text-yellow-500' : 'text-rose-500'
                    }`}>
                      {customerRiskData.customer.cibil_score}
                      {customerRiskData.customer.cibil_score >= 750 ? (
                        <TrendingUp className="h-3 w-3 ml-1 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 ml-1 text-rose-500" />
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Financial Health */}
              <div className="terminal-card space-y-3.5">
                <div className="flex items-center space-x-2.5 pb-2.5 border-b border-[#E2E8F0] dark:border-slate-800">
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#2563EB]/10 text-[#2563EB] dark:text-[#3B82F6]">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#0F172A] dark:text-white uppercase leading-none">Financial Health</h3>
                    <p className="text-[8px] text-slate-500 mt-1">Income exposure and limit utilizations</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-[10px]">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">Credit Limit</span>
                    <span className="font-bold terminal-text-mono text-[#0F172A] dark:text-slate-200">
                      INR {customerRiskData.customer.total_credit_limit.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">DTI Estimate</span>
                    <span className="font-bold terminal-text-mono text-[#0F172A] dark:text-slate-200">{customerRiskData.customer.debt_to_income_pct}%</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">Avg Monthly Spend</span>
                    <span className="font-bold terminal-text-mono text-[#0F172A] dark:text-slate-200">
                      INR {customerRiskData.customer.avg_monthly_spend.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block">Utilization %</span>
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="h-1.5 w-16 bg-[#E2E8F0] dark:bg-slate-900 rounded-none overflow-hidden">
                        <div 
                          className={`h-full ${
                            customerRiskData.customer.current_utilization_pct > 80 ? 'bg-rose-500' :
                            customerRiskData.customer.current_utilization_pct > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${customerRiskData.customer.current_utilization_pct}%` }}
                        ></div>
                      </div>
                      <span className="font-bold terminal-text-mono text-[#0F172A] dark:text-slate-300">
                        {customerRiskData.customer.current_utilization_pct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 3: Behavioral Timeline */}
            <div className="terminal-card">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800 mb-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6]" />
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-200 uppercase tracking-wider">6-Month Payment Timeline</span>
                </div>
                <div className="flex space-x-2 text-[8px] font-bold uppercase tracking-wider">
                  <span className="text-emerald-500">● Full</span>
                  <span className="text-amber-500">● MAD</span>
                  <span className="text-orange-500">● Late</span>
                  <span className="text-rose-500">● Missed</span>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-2 text-center">
                {['M6 (Oldest)', 'M5', 'M4', 'M3', 'M2', 'M1 (Recent)'].map((month, idx) => {
                  const dbField = `payment_status_m${6 - idx}`;
                  const status = customerRiskData.customer[dbField];
                  return (
                    <div key={idx} className="space-y-1.5">
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{month}</p>
                      <div className={`border p-2.5 font-extrabold text-[9px] uppercase tracking-wider rounded-sm transition-all ${
                        getPaymentStatusStyles(status)
                      }`}>
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel: SHAP Explainability Chart */}
            <div className="terminal-card">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Activity className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6]" />
                <span>Risk Driver Contributions (SHAP Values)</span>
              </h3>
              
              <div className="space-y-3.5 text-[10px]">
                {customerRiskData.prediction.shap_drivers.map((driver: any, idx: number) => {
                  const isPositive = driver.contribution > 0;
                  const pctVal = Math.min(Math.abs(driver.contribution) * 100, 100);
                  
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-[#0F172A] dark:text-slate-200">
                          {driver.feature} ({driver.display_value})
                        </span>
                        <span className={`font-bold terminal-text-mono text-[9px] ${
                          isPositive ? 'text-rose-500' : 'text-emerald-500'
                        }`}>
                          {isPositive ? '+' : ''}{(driver.contribution * 100).toFixed(1)}% PD Influence
                        </span>
                      </div>
                      
                      {/* Bilateral Contribution Bar */}
                      <div className="relative h-1.5 w-full bg-[#E2E8F0] dark:bg-slate-950 overflow-hidden flex rounded-none">
                        <div className="w-1/2 border-r border-[#E2E8F0] dark:border-slate-800"></div>
                        <div 
                          className={`absolute top-0 h-full ${
                            isPositive ? 'bg-rose-500 left-1/2' : 'bg-emerald-500 right-1/2'
                          }`}
                          style={{ 
                            width: `${pctVal / 2}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* SVG Risk Gauge & Narrative - Right Panels */}
          <div className="space-y-6">
            
            {/* SVG Radial Gauge */}
            <div className="terminal-card text-center flex flex-col items-center justify-center space-y-4 py-6">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Continuous Probability of Default</span>
              
              {/* Semi-Circle SVG Gauge */}
              <div className="relative flex h-24 w-44 items-end justify-center">
                <svg className="w-full h-full" viewBox="0 0 120 70">
                  {/* Background Arc */}
                  <path
                    d="M 10,60 A 50,50 0 0,1 110,60"
                    fill="none"
                    stroke={theme === 'dark' ? '#334155' : '#E2E8F0'}
                    strokeWidth={strokeWidth}
                    strokeLinecap="square"
                  />
                  {/* Foreground Animated Arc */}
                  <motion.path
                    d="M 10,60 A 50,50 0 0,1 110,60"
                    fill="none"
                    stroke={getGaugeColor(score)}
                    strokeWidth={strokeWidth}
                    strokeLinecap="square"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: score }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </svg>
                {/* Score text overlay */}
                <div className="absolute bottom-1 space-y-0.5">
                  <h4 className="text-2xl font-black terminal-text-mono leading-none text-[#0F172A] dark:text-white">
                    {(score * 100).toFixed(1)}%
                  </h4>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">6-Month PD</p>
                </div>
              </div>

              {/* Verdict badge */}
              <div className={`rounded-sm border px-4 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                getVerdictStyles(customerRiskData.prediction.verdict)
              }`}>
                {customerRiskData.prediction.verdict}
              </div>
            </div>

            {/* AI Risk Narrative */}
            <div className="terminal-card space-y-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6]" />
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-200 uppercase tracking-wider">GenAI Compliance Narrative</h3>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-300 leading-relaxed italic bg-[#F8FAFC] dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-900 p-3 rounded-none relative overflow-hidden">
                "{customerRiskData.prediction.risk_narrative}"
                {/* Blinking Cursor representing streaming trace */}
                <span className="inline-block h-3 w-1.5 bg-[#2563EB] dark:bg-[#3B82F6] ml-1 animate-pulse"></span>
              </p>
            </div>

            {/* Quick Action Navigation to Collections */}
            <button
              onClick={() => {
                setSelectedCustomerId(customerRiskData.customer.customer_id);
                router.push('/dashboard/collections');
              }}
              className="flex w-full items-center justify-between rounded-sm bg-[#2563EB]/10 hover:bg-[#2563EB]/25 border border-[#2563EB]/20 p-3.5 text-[9px] font-black uppercase tracking-wider text-[#2563EB] dark:text-[#3B82F6] group cursor-pointer"
            >
              <span>Target Collections Strategy</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

          </div>

        </div>
      )}

      {customerRiskData && customerRiskData.notFound && (
        <div className="terminal-card p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-white">Customer Record Not Found</h3>
          <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase mt-2">
            No active portfolio contains customer ID <span className="font-mono text-rose-500 font-bold">"{activeSearchId}"</span>.
          </p>
        </div>
      )}

      {!activeSearchId && (
        <div className="terminal-card p-16 text-center">
          <Search className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-white">Risk Query Terminal Active</h3>
          <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase mt-1">
            Input a customer ID above to scan default metrics.
          </p>
        </div>
      )}
    </div>
  );
}
