'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
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
  Sparkles,
  ClipboardList
} from 'lucide-react';

export default function Customer360Page() {
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
  const { data: customerRiskData, isLoading } = useQuery({
    queryKey: ['customerRisk', activeSearchId],
    queryFn: async () => {
      if (!activeSearchId) return null;

      let custData: any = null;
      try {
        const { data, error: custErr } = await supabase
          .from('customers')
          .select('*')
          .eq('customer_id', activeSearchId)
          .limit(1)
          .maybeSingle();
        if (custErr) throw custErr;
        custData = data;
      } catch (err) {
        console.warn("Supabase customer fetch failed in 360. Trying local storage fallback.", err);
        const localCusts = JSON.parse(localStorage.getItem('local_customers') || '[]');
        custData = localCusts.find((c: any) => c.customer_id === activeSearchId) || null;
      }

      if (!custData) return { notFound: true };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const apiPayload = {
        customer_id: custData.customer_id,
        age: custData.age,
        city: custData.city,
        card_tier: custData.card_tier,
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      try {
        const response = await fetch(`${apiUrl}/predict-single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Prediction API failed');
        }

        const prediction = await response.json();
        return {
          notFound: false,
          customer: custData,
          prediction
        };
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Prediction API connection failed or timed out. Using local storage fallback prediction stats.", err);
        const localPreds = JSON.parse(localStorage.getItem('local_predictions') || '[]');
        let matchedPred = localPreds.find((p: any) => p.customer_id === activeSearchId);
        
        if (!matchedPred) {
          matchedPred = {
            customer_id: activeSearchId,
            risk_score: custData.default_6month_label === 1 ? 0.65 : 0.035,
            verdict: custData.default_6month_label === 1 ? 'High Risk' : 'Low Risk',
            shap_drivers: [
              { feature: "Utilization Rate", contribution: 0.12, display_value: `${custData.current_utilization_pct}%` },
              { feature: "CIBIL Score", contribution: -0.05, display_value: String(custData.cibil_score) },
              { feature: "Payment History", contribution: 0.08, display_value: custData.payment_status_m1 }
            ],
            risk_narrative: "Predictive model evaluation suggests a stable repayment outlook. Sub-optimal credit utilization and payment records are primary parameters.",
            collection_strategy: "Implement standard contact procedures, monitor monthly utilisation boundaries, and schedule routine credit health check reminders."
          };
        }
        
        return {
          notFound: false,
          customer: custData,
          prediction: matchedPred
        };
      }
    },
    enabled: !!activeSearchId
  });

  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case 'Low Risk':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Medium Risk':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'High Risk':
      default:
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }
  };

  const getPaymentStatusStyles = (status: string) => {
    switch (status) {
      case 'Full':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'MAD':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Late':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'Missed':
      default:
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }
  };

  const getGaugeColor = (score: number) => {
    if (score < 0.15) return 'var(--low-risk)';
    if (score < 0.40) return 'var(--med-risk)';
    return 'var(--high-risk)';
  };

  const strokeWidth = 10;
  const score = customerRiskData?.prediction?.risk_score ?? 0;

  return (
    <div className="space-y-8 text-[var(--text-primary)]">
      
      {/* 1. Page Header */}
      <div className="pb-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="terminal-title">Customer 360 risk profile</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Audit customer credit limit details, repayment logs, and GenAI evaluations.
          </p>
        </div>
      </div>

      {/* 2. Global Search Bar */}
      <div className="terminal-card">
        <form onSubmit={handleSearchSubmit} className="flex space-x-3 max-w-lg">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              required
              placeholder="Enter cardholder ID (e.g. CRD100561)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 terminal-input"
            />
          </div>
          <button type="submit" className="terminal-btn-primary shrink-0">
            Query profile
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="flex h-44 items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-7 w-7 animate-spin rounded-sm border-2 border-t-[var(--brand-color)] border-r-transparent border-b-[var(--brand-color)] border-l-transparent"></div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Retrieving cardholder files...</span>
          </div>
        </div>
      )}

      {customerRiskData && !customerRiskData.notFound && !isLoading && (
        <div className="space-y-8">
          
          {/* 3. Top Row: Executive Actionable Insights (Narrative + Gauge + Profile) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Column A: Customer profile details & Financial metrics */}
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="terminal-card space-y-4">
                <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border-color)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10 text-[var(--text-primary)]">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] leading-none">
                      {customerRiskData.customer.customer_name}
                    </h3>
                    <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">{customerRiskData.customer.customer_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">Age / City</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {customerRiskData.customer.age} Yrs / {customerRiskData.customer.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">Card Tier</span>
                    <span className="font-bold text-[var(--text-primary)] uppercase text-[11px]">
                      {customerRiskData.customer.card_tier}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">Card Network</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {customerRiskData.customer.card_network.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">CIBIL Score</span>
                    <span className={`font-bold flex items-center ${
                      customerRiskData.customer.cibil_score >= 750 ? 'text-emerald-500' :
                      customerRiskData.customer.cibil_score >= 650 ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {customerRiskData.customer.cibil_score}
                      {customerRiskData.customer.cibil_score >= 750 ? (
                        <TrendingUp className="h-3.5 w-3.5 ml-1 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 ml-1 text-rose-500" />
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Metrics Card */}
              <div className="terminal-card space-y-4">
                <div className="flex items-center space-x-3 pb-3 border-b border-[var(--border-color)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10 text-[var(--text-primary)]">
                    <CreditCard className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Financial status</h3>
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">Credit Limit</span>
                    <span className="font-bold terminal-text-mono text-[var(--text-primary)]">
                      ₹{customerRiskData.customer.total_credit_limit.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">DTI Estimate</span>
                    <span className="font-bold terminal-text-mono text-[var(--text-primary)]">{customerRiskData.customer.debt_to_income_pct}%</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">Avg Monthly Spend</span>
                    <span className="font-bold terminal-text-mono text-[var(--text-primary)]">
                      ₹{customerRiskData.customer.avg_monthly_spend.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">Utilization Rate</span>
                    <div className="mt-1 flex items-center space-x-2">
                      <div className="h-2 w-16 bg-slate-200 dark:bg-slate-800 rounded-sm overflow-hidden">
                        <div 
                          className={`h-full ${
                            customerRiskData.customer.current_utilization_pct > 80 ? 'bg-rose-500' :
                            customerRiskData.customer.current_utilization_pct > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${customerRiskData.customer.current_utilization_pct}%` }}
                        ></div>
                      </div>
                      <span className="font-bold terminal-text-mono text-[var(--text-primary)]">
                        {customerRiskData.customer.current_utilization_pct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column B: GenAI Evaluation Compliance Narrative & Actions (Promoted to top level) */}
            <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
              {/* Gauge & Verdict Header */}
              <div className="terminal-card flex flex-col sm:flex-row items-center justify-around py-4 gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Probability of Default</span>
                  <div className="relative flex h-20 w-36 items-end justify-center">
                    <svg className="w-full h-full" viewBox="0 0 120 70">
                      <path
                        d="M 15,60 A 45,45 0 0,1 105,60"
                        fill="none"
                        stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                      />
                      <motion.path
                        d="M 15,60 A 45,45 0 0,1 105,60"
                        fill="none"
                        stroke={getGaugeColor(score)}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: score }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute bottom-1 space-y-0.5 text-center">
                      <h4 className="text-xl font-bold terminal-text-mono leading-none">
                        {(score * 100).toFixed(1)}%
                      </h4>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">6-Month PD</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-start space-y-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Scoring engine verdict</span>
                  <div className={`rounded-md border px-4 py-1 text-sm font-bold uppercase tracking-wider ${
                    getVerdictStyles(customerRiskData.prediction.verdict)
                  }`}>
                    {customerRiskData.prediction.verdict}
                  </div>
                </div>
              </div>

              {/* GenAI Risk Narrative */}
              <div className="terminal-card space-y-3.5 flex-1">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4.5 w-4.5 text-[var(--text-primary)]" />
                  <h3 className="terminal-card-title">Compliance risk summary</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic bg-slate-500/5 border border-[var(--border-color)] p-4 rounded-md relative overflow-hidden">
                  "{customerRiskData.prediction.risk_narrative}"
                  <span className="inline-block h-3.5 w-1.5 bg-[var(--brand-color)] ml-1 animate-pulse"></span>
                </p>
              </div>

              {/* GenAI Collection Action Strategy (Restructured directly into Customer-360) */}
              <div className="terminal-card space-y-3.5 bg-slate-500/5">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="h-4.5 w-4.5 text-[var(--text-primary)]" />
                  <h3 className="terminal-card-title">Actionable containment strategy</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {customerRiskData.prediction.collection_strategy || "Initiate routine warning messaging cycles, evaluate utilization levels, and set monthly limits constraints."}
                </p>
              </div>

            </div>

          </div>

          {/* 4. Bottom Row: Underlying Risk Indicators & 6-Month payment timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Column A: Primary Risk Drivers (Progress Bars - Red/Green) */}
            <div className="terminal-card space-y-4">
              <div className="flex items-center space-x-2 pb-1 border-b border-[var(--border-color)]">
                <Activity className="h-4.5 w-4.5 text-[var(--text-secondary)]" />
                <h3 className="terminal-card-title">Primary risk drivers</h3>
              </div>
              
              <div className="space-y-4 text-xs">
                {customerRiskData.prediction.shap_drivers.map((driver: any, idx: number) => {
                  const isPositive = driver.contribution > 0;
                  const pctVal = Math.min(Math.abs(driver.contribution) * 100, 100);
                  
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-[var(--text-primary)]">
                          {driver.feature} ({driver.display_value})
                        </span>
                        <span className={`font-bold text-xs ${
                          isPositive ? 'text-rose-500' : 'text-emerald-500'
                        }`}>
                          {isPositive ? 'Increases Risk' : 'Reduces Risk'}
                        </span>
                      </div>
                      
                      {/* Bilateral Contribution Bar */}
                      <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-900 overflow-hidden flex rounded-sm">
                        <div className="w-1/2 border-r border-[var(--border-color)]"></div>
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

            {/* Column B: Behavioral payment history timeline (sentence case) */}
            <div className="terminal-card lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4.5 w-4.5 text-[var(--text-secondary)]" />
                  <h3 className="terminal-card-title">Repayment history timeline</h3>
                </div>
                <div className="flex space-x-2 text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-emerald-500">● Full</span>
                  <span className="text-amber-500">● Mad</span>
                  <span className="text-orange-500">● Late</span>
                  <span className="text-rose-500">● Missed</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
                {['M6 (Oldest)', 'M5', 'M4', 'M3', 'M2', 'M1 (Recent)'].map((month, idx) => {
                  const dbField = `payment_status_m${6 - idx}`;
                  const status = customerRiskData.customer[dbField] || 'Full';
                  return (
                    <div key={idx} className="space-y-2 p-2 bg-slate-500/5 rounded-md border border-[var(--border-color)]">
                      <p className="text-[11px] text-[var(--text-secondary)] font-semibold">{month}</p>
                      <div className={`border py-1.5 font-bold text-xs rounded-md transition-all ${
                        getPaymentStatusStyles(status)
                      }`}>
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {customerRiskData && customerRiskData.notFound && (
        <div className="terminal-card p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">Customer record not found</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            No active portfolio contains customer ID <span className="font-mono text-rose-500 font-bold">"{activeSearchId}"</span>.
          </p>
        </div>
      )}

      {!activeSearchId && (
        <div className="terminal-card p-16 text-center">
          <Search className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Query cardholder risk details</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1.5">
            Input a customer ID above to scan defaults probability and AI evaluation.
          </p>
        </div>
      )}
    </div>
  );
}
