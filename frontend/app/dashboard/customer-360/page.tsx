'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  User, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  FileText,
  Calendar,
  IndianRupee,
  Activity,
  ArrowRight
} from 'lucide-react';

export default function Customer360Page() {
  const router = useRouter();
  const { searchQuery, setSearchQuery, selectedCustomerId, setSelectedCustomerId } = useStore();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);

  // Sync state with global search or selected customer ID from other views
  useEffect(() => {
    if (selectedCustomerId) {
      setActiveSearchId(selectedCustomerId);
      setSearchInput(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSearchId(searchInput.trim().toUpperCase());
      setSelectedCustomerId(searchInput.trim().toUpperCase());
    }
  };

  // Fetch customer details and predict risk
  const { data: customerRiskData, isLoading, error, refetch } = useQuery({
    queryKey: ['customerRisk', activeSearchId],
    queryFn: async () => {
      if (!activeSearchId) return null;

      // 1. Fetch customer demographics from Supabase
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', activeSearchId)
        .limit(1)
        .maybeSingle();

      if (custErr) throw custErr;
      if (!custData) return { notFound: true };

      // 2. Call FastAPI backend /predict-single endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      // Map database row format back to API CustomerFeatureInput Pydantic structure
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
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'MAD':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Late':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Missed':
      default:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Customer 360 Risk Profile</h2>
        <p className="text-xs text-slate-400">Perform deep-dive analysis on bureau records, payment timelines, and SHAP explainability drivers.</p>
      </div>

      {/* Local Search Bar */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
        <form onSubmit={handleSearchSubmit} className="flex space-x-3 max-w-lg">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
            <input
              type="text"
              placeholder="Enter Customer ID (e.g. IND100002)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-11 pr-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 text-xs font-bold text-slate-950 uppercase tracking-widest transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-64 rounded-xl bg-slate-900/40 border border-slate-900 animate-pulse"></div>
          <div className="h-64 rounded-xl bg-slate-900/40 border border-slate-900 animate-pulse"></div>
          <div className="h-40 rounded-xl bg-slate-900/40 border border-slate-900 md:col-span-2 animate-pulse"></div>
        </div>
      )}

      {/* Results View */}
      {customerRiskData && !customerRiskData.notFound && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Identity and Risk narrative - Left Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Row 1: Identity & Bureau + Financial Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Panel 1: Identity & Bureau */}
              <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel space-y-4">
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-900">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-emerald-400">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {customerRiskData.customer.customer_name}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{customerRiskData.customer.customer_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">Age / City</span>
                    <span className="text-slate-200 font-semibold">
                      {customerRiskData.customer.age} Yrs / {customerRiskData.customer.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">Primary Bank</span>
                    <span className="text-slate-200 font-semibold">{customerRiskData.customer.primary_bank}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">Card Network</span>
                    <span className="text-slate-200 font-semibold">
                      {customerRiskData.customer.card_network.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">CIBIL Score</span>
                    <span className={`font-black flex items-center ${
                      customerRiskData.customer.cibil_score >= 750 ? 'text-emerald-400' :
                      customerRiskData.customer.cibil_score >= 650 ? 'text-yellow-400' : 'text-rose-400'
                    }`}>
                      {customerRiskData.customer.cibil_score}
                      {customerRiskData.customer.cibil_score >= 750 ? (
                        <TrendingUp className="h-3 w-3 ml-1 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-3 w-3 ml-1 text-rose-400" />
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Financial Health */}
              <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel space-y-4">
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-900">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-indigo-400">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Financial Status</h3>
                    <p className="text-[9px] text-slate-400">Credit utilization and income ratios</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">Credit Limit</span>
                    <span className="text-slate-200 font-semibold">
                      INR {customerRiskData.customer.total_credit_limit.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">DTI Estimate</span>
                    <span className="text-slate-200 font-semibold">{customerRiskData.customer.debt_to_income_pct}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">Avg Monthly Spend</span>
                    <span className="text-slate-200 font-semibold">
                      INR {customerRiskData.customer.avg_monthly_spend.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block">Utilization %</span>
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="h-1.5 w-20 rounded-full bg-slate-950 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            customerRiskData.customer.current_utilization_pct > 80 ? 'bg-rose-500' :
                            customerRiskData.customer.current_utilization_pct > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${customerRiskData.customer.current_utilization_pct}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-slate-300">
                        {customerRiskData.customer.current_utilization_pct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>

            {/* Panel 3: Behavioral Payment Timeline */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
              <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
                <div className="flex items-center space-x-2.5">
                  <Calendar className="h-4.5 w-4.5 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">6-Month Payment Timeline</span>
                </div>
                <div className="flex space-x-3 text-[9px] font-bold uppercase tracking-wider">
                  <span className="text-emerald-400">● Full</span>
                  <span className="text-yellow-400">● MAD</span>
                  <span className="text-orange-400">● Late</span>
                  <span className="text-rose-400">● Missed</span>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-3 text-center">
                {['M6 (Oldest)', 'M5', 'M4', 'M3', 'M2', 'M1 (Recent)'].map((month, idx) => {
                  // M1 maps to payment_status_m1, M6 to payment_status_m6
                  const dbField = `payment_status_m${6 - idx}`;
                  const status = customerRiskData.customer[dbField];
                  return (
                    <div key={idx} className="space-y-2">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{month}</p>
                      <div className={`rounded-lg border p-3 font-extrabold text-[11px] uppercase tracking-wider transition-all ${
                        getPaymentStatusStyles(status)
                      }`}>
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel: SHAP Explainability Driver Chart */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Activity className="h-4.5 w-4.5 text-emerald-400" />
                <span>Top Risk Score Drivers (SHAP Explainability)</span>
              </h3>
              
              <div className="space-y-4 text-xs">
                {customerRiskData.prediction.shap_drivers.map((driver: any, idx: number) => {
                  const isPositive = driver.contribution > 0;
                  const pctVal = Math.min(Math.abs(driver.contribution) * 100, 100);
                  
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          {driver.feature} ({driver.display_value})
                        </span>
                        <span className={`font-mono font-bold text-[10px] uppercase ${
                          isPositive ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {isPositive ? '+' : ''}{(driver.contribution * 100).toFixed(2)}% Default Risk
                        </span>
                      </div>
                      
                      {/* Bidirectional Bar */}
                      <div className="relative h-2 w-full rounded-full bg-slate-950 overflow-hidden flex">
                        <div className="w-1/2 border-r border-slate-800"></div>
                        <div 
                          className={`absolute top-0 h-full rounded-full ${
                            isPositive ? 'bg-rose-500/80 left-1/2' : 'bg-emerald-500/80 right-1/2'
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

          {/* Continuous Probability Narrative Gauge - Right Panel */}
          <div className="space-y-6">
            
            {/* PD Circular Display Card */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-6 glass-panel text-center flex flex-col items-center justify-center space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Risk Score</span>
              
              {/* Radial Gauge */}
              <div className="relative flex h-36 w-36 items-center justify-center">
                {/* Background Ring */}
                <svg className="absolute h-full w-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    strokeWidth="10"
                    stroke="#1e293b"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    strokeWidth="10"
                    // Green for Low, Yellow for Med, Red for High
                    stroke={
                      customerRiskData.prediction.risk_score < 0.15 ? '#10b981' :
                      customerRiskData.prediction.risk_score < 0.40 ? '#f59e0b' : '#ef4444'
                    }
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - customerRiskData.prediction.risk_score)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="space-y-0.5">
                  <h4 className="text-3xl font-black text-white">
                    {(customerRiskData.prediction.risk_score * 100).toFixed(1)}%
                  </h4>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">6-Month PD</p>
                </div>
              </div>

              {/* Verdict badge */}
              <div className={`rounded-full border px-4 py-1 text-xs font-black uppercase tracking-wider ${
                getVerdictStyles(customerRiskData.prediction.verdict)
              }`}>
                {customerRiskData.prediction.verdict}
              </div>
            </div>

            {/* AI Risk Narrative */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel space-y-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">AI GenAI Risk Narrative</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 border border-slate-900 rounded-lg p-3.5">
                "{customerRiskData.prediction.risk_narrative}"
              </p>
              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                <span>Model: Gemini 1.5 Flash</span>
                <span>Context: Bureau + Delinquency</span>
              </div>
            </div>

            {/* Quick Action Navigator to Collections */}
            <button
              onClick={() => {
                // Router navigate to collections and keep customer ID
                router.push('/dashboard/collections');
              }}
              className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-emerald-900/10 to-indigo-900/10 hover:from-emerald-900/20 hover:to-indigo-900/20 border border-emerald-500/15 p-4 text-xs font-bold uppercase tracking-wider text-emerald-400 group cursor-pointer"
            >
              <span>Collections strategist</span>
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1 text-emerald-400" />
            </button>

          </div>

        </div>
      )}

      {customerRiskData && customerRiskData.notFound && (
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-12 glass-panel text-center">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">Customer Record Not Found</h3>
          <p className="text-xs text-slate-400 mt-2">
            No active portfolio contains customer ID <span className="font-mono text-rose-300 font-bold">"{activeSearchId}"</span>. 
            Please upload a portfolio or try another search (e.g. IND100000 to IND109999).
          </p>
        </div>
      )}

      {!activeSearchId && (
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-16 glass-panel text-center">
          <Search className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">Search Portal Active</h3>
          <p className="text-xs text-slate-400 mt-2">
            Enter a Customer ID above to search, or browse records in the <a href="/dashboard/portfolio" className="text-emerald-400 hover:underline">Portfolio Upload</a> tab.
          </p>
        </div>
      )}
    </div>
  );
}
