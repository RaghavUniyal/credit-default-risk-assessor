'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  CreditCard,
  Users,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

export default function OverviewPage() {
  const { user } = useStore();

  // Heatmap hover states
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);
  const [hoveredCibil, setHoveredCibil] = useState<string | null>(null);

  // React Query to fetch portfolio data
  const { data: portfolioData, isLoading } = useQuery({
    queryKey: ['portfolioData', user?.id],
    queryFn: async () => {
      if (!user) return null;

      let customers: any[] = [];
      let predictions: any[] = [];
      let isDemo = false;
      let isCustom = false;

      try {
        const [custRes, predRes] = await Promise.all([
          supabase.from('customers').select('customer_id, customer_name, age, city, card_tier, card_network, total_credit_limit, cibil_score'),
          supabase.from('predictions').select('customer_id, risk_score, verdict')
        ]);

        if (custRes.error) throw custRes.error;
        if (predRes.error) throw predRes.error;

        customers = custRes.data || [];
        predictions = predRes.data || [];
      } catch (err) {
        console.warn("Supabase fetch failed on dashboard. Falling back to local storage.", err);
        customers = JSON.parse(localStorage.getItem('local_customers') || '[]');
        predictions = JSON.parse(localStorage.getItem('local_predictions') || '[]');
        isDemo = localStorage.getItem('is_custom_upload') !== 'true';
        isCustom = localStorage.getItem('is_custom_upload') === 'true';
      }

      // If database is empty and local cache is empty, auto-seed using scored JSON seed files!
      if (customers.length === 0) {
        try {
          console.log("Portfolio is empty. Fetching local pre-scored seed data...");
          const [seedCustRes, seedPredRes] = await Promise.all([
            fetch('/seed_customers.json'),
            fetch('/seed_predictions.json')
          ]);
          if (seedCustRes.ok && seedPredRes.ok) {
            customers = await seedCustRes.json();
            predictions = await seedPredRes.json();
            isDemo = true;
            
            // Save to local storage for persistent mock database sessions
            localStorage.setItem('local_customers', JSON.stringify(customers));
            localStorage.setItem('local_predictions', JSON.stringify(predictions));
          } else {
            return { empty: true };
          }
        } catch (seedErr) {
          console.error("Failed to fetch seed portfolio details", seedErr);
          return { empty: true };
        }
      }

      // Merge data by customer_id
      const latestPreds: Record<string, any> = {};
      predictions.forEach(p => {
        latestPreds[p.customer_id] = p;
      });

      const merged = customers.map(c => {
        const pred = latestPreds[c.customer_id] || { risk_score: 0.035, verdict: 'Low Risk' };
        return {
          ...c,
          risk_score: parseFloat(pred.risk_score),
          verdict: pred.verdict
        };
      });

      const totalSize = merged.length;
      const avgPD = merged.reduce((acc, curr) => acc + curr.risk_score, 0) / totalSize;
      const avgCibil = merged.reduce((acc, curr) => acc + curr.cibil_score, 0) / totalSize;
      const totalLimit = merged.reduce((acc, curr) => acc + curr.total_credit_limit, 0);

      // Risk level counts
      let lowCount = 0;
      let medCount = 0;
      let highCount = 0;
      merged.forEach(c => {
        if (c.verdict === 'Low Risk') lowCount++;
        else if (c.verdict === 'Medium Risk') medCount++;
        else if (c.verdict === 'High Risk') highCount++;
      });

      // Segment by Card Tier (Signature, Platinum, Gold, Classic)
      const cardTiers = ['Signature', 'Platinum', 'Gold', 'Classic'];
      const tierStats: Record<string, { totalPD: number, count: number, totalLimit: number }> = {};
      cardTiers.forEach(t => {
        tierStats[t] = { totalPD: 0, count: 0, totalLimit: 0 };
      });

      merged.forEach(c => {
        const tier = c.card_tier || 'Signature';
        if (tierStats[tier]) {
          tierStats[tier].totalPD += c.risk_score;
          tierStats[tier].count += 1;
          tierStats[tier].totalLimit += c.total_credit_limit;
        }
      });

      const tierChartData = cardTiers.map(t => {
        const stats = tierStats[t];
        return {
          tier: t,
          'Avg PD %': stats.count > 0 ? parseFloat((stats.totalPD / stats.count * 100).toFixed(2)) : 0.0,
          'Limit exposure (Cr)': stats.count > 0 ? parseFloat((stats.totalLimit / 10000000).toFixed(2)) : 0.0
        };
      });

      // Heatmap data: Card Tier x CIBIL Score brackets
      const cibilBrackets = ['Poor (<600)', 'Fair (600-700)', 'Good (700-800)', 'Excellent (800+)'];
      const heatmap: Record<string, Record<string, { totalPD: number, count: number }>> = {};
      cardTiers.forEach(t => {
        heatmap[t] = {};
        cibilBrackets.forEach(b => {
          heatmap[t][b] = { totalPD: 0, count: 0 };
        });
      });

      merged.forEach(c => {
        const t = c.card_tier || 'Signature';
        const cibil = c.cibil_score;
        let bracket = 'Excellent (800+)';
        if (cibil < 600) bracket = 'Poor (<600)';
        else if (cibil < 700) bracket = 'Fair (600-700)';
        else if (cibil < 800) bracket = 'Good (700-800)';
        
        if (heatmap[t] && heatmap[t][bracket]) {
          heatmap[t][bracket].totalPD += c.risk_score;
          heatmap[t][bracket].count += 1;
        }
      });

      const heatmapGrid = cardTiers.map(t => {
        const row: Record<string, any> = { tier: t };
        cibilBrackets.forEach(b => {
          const stats = heatmap[t][b];
          row[b] = stats.count > 0 ? parseFloat((stats.totalPD / stats.count * 100).toFixed(1)) : 0.0;
        });
        return row;
      });

      // Top High-Risk accounts
      const topStressed = [...merged]
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 5);

      return {
        empty: false,
        isDemo,
        isCustom,
        totalSize,
        avgPD,
        avgCibil,
        totalLimit,
        counts: { lowCount, medCount, highCount },
        tierChartData,
        heatmapGrid,
        topStressed
      };
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-7 w-7 animate-spin rounded-sm border-2 border-t-[var(--brand-color)] border-r-transparent border-b-[var(--brand-color)] border-l-transparent"></div>
          <span className="text-xs font-semibold tracking-wider text-[var(--text-secondary)]">Analyzing portfolio receivables...</span>
        </div>
      </div>
    );
  }

  const data = portfolioData?.empty ? getMockPortfolioData() : portfolioData;

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'Low Risk':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'Medium Risk':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'High Risk':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
    }
  };

  const getHeatmapColor = (val: number) => {
    if (val === 0) return 'bg-slate-500/5 text-slate-400 border border-transparent';
    if (val < 3.5) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    if (val < 10.0) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
  };

  // Staggered animations
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="space-y-8">
      
      {/* Disclaimer Warning Banners */}
      {data?.isDemo && (
        <div className="flex items-center space-x-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-600 dark:text-amber-400 text-xs font-semibold">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 animate-pulse text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Heads Up:</strong> This dashboard is displaying dummy cardholder records and simulated default probabilities for demonstration purposes.
          </span>
        </div>
      )}
      {data?.isCustom && (
        <div className="flex items-center space-x-3 rounded-lg border border-teal-500/20 bg-teal-500/5 px-4 py-3 text-teal-600 dark:text-teal-400 text-xs font-semibold">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
          <span>
            <strong>Offline Mode:</strong> Displaying custom portfolio CSV upload details.
          </span>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h2 className="terminal-title">
            Portfolio risk dashboard
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Analyze credit card receivables exposure, average default probabilities, and credit stress matrices.
          </p>
        </div>
        {data?.isDemo && (
          <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-500 tracking-wider animate-pulse">
            Demo Mode (Using Fallback Aggregates)
          </span>
        )}
      </div>

      {/* 2. KPI Cards Grid - Large & High Readability */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Card 1 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="terminal-caption uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Active Accounts</span>
            <Users className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="terminal-kpi-value">
              {data?.totalSize?.toLocaleString() ?? "0"}
            </h3>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Cardholders</span>
          </div>
        </motion.div>

        {/* Card 2: Probability of Default (Highlighted with neutral styling, not danger-red) */}
        <motion.div 
          variants={itemVariants} 
          className="terminal-card border-l-4 border-l-slate-700 dark:border-l-slate-400 bg-slate-500/5"
        >
          <div className="flex items-center justify-between">
            <span className="terminal-caption uppercase font-bold tracking-widest text-slate-500">Average Risk PD</span>
            <Activity className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="terminal-kpi-value text-slate-800 dark:text-slate-100">
              {((data?.avgPD ?? 0) * 100).toFixed(2)}%
            </h3>
            <span className="inline-flex items-center text-xs font-semibold text-[var(--text-secondary)]">
              Portfolio Mean
            </span>
          </div>
        </motion.div>

        {/* Card 3 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="terminal-caption uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Average Cibil</span>
            <Layers className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="terminal-kpi-value">
              {Math.round(data?.avgCibil ?? 0)}
            </h3>
            <span className="inline-flex items-center text-xs font-semibold text-[var(--text-secondary)]">
              Credit Score
            </span>
          </div>
        </motion.div>

        {/* Card 4 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="terminal-caption uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Limit Exposure</span>
            <CreditCard className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="terminal-kpi-value">
              ₹{((data?.totalLimit ?? 0) / 10000000).toFixed(2)} Cr
            </h3>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Total limit</span>
          </div>
        </motion.div>
      </motion.div>

      {/* 3. Actionable High Stressed Receivables Watchlist (Promoted to the top) */}
      <div className="terminal-card">
        <div className="flex items-center space-x-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-rose-500" />
          <h3 className="terminal-card-title">Stressed accounts watchlist</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-500/5 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-color)]">
              <tr>
                <th className="px-4 py-3">Cardholder ID</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3 text-right">CIBIL Score</th>
                <th className="px-4 py-3">Card Tier</th>
                <th className="px-4 py-3 text-right">Credit Limit</th>
                <th className="px-4 py-3 text-right">Probability of Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {data?.topStressed?.map((cust: any) => (
                <tr key={cust.customer_id} className="terminal-table-row">
                  <td className="px-4 py-3 font-mono font-bold text-[var(--text-primary)]">{cust.customer_id}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{cust.customer_name}</td>
                  <td className="px-4 py-3 text-right font-semibold terminal-text-mono">{cust.cibil_score}</td>
                  <td className="px-4 py-3 font-semibold uppercase text-xs text-[var(--text-secondary)]">{cust.card_tier}</td>
                  <td className="px-4 py-3 text-right font-semibold terminal-text-mono">₹{cust.total_credit_limit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-black">
                    <span className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-bold ${getVerdictStyle(cust.risk_score >= 0.4 ? 'High Risk' : cust.risk_score >= 0.15 ? 'Medium Risk' : 'Low Risk')}`}>
                      {(cust.risk_score * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Split Bar Charts + Risk Stat Cards (Side-by-side layout) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Side-by-side Card Tier Risk Charts */}
        <div className="terminal-card lg:col-span-2 space-y-6">
          <h3 className="terminal-card-title border-b border-[var(--border-color)] pb-2.5">
            Card tier metrics distribution
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Chart A: Limit Exposure (Teal) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">Limit Exposure (Cr)</span>
              <div className="h-44 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.tierChartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="tier" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '0.375rem' }} />
                    <Bar dataKey="Limit exposure (Cr)" fill="var(--exposure-color)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Average PD % (Navy/Slate) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">Average Risk PD %</span>
              <div className="h-44 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.tierChartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="tier" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '0.375rem' }} />
                    <Bar dataKey="Avg PD %" fill="var(--neutral-series)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Risk Segment Stat Cards (Replacing the donut chart) */}
        <div className="terminal-card flex flex-col justify-between">
          <h3 className="terminal-card-title border-b border-[var(--border-color)] pb-2.5">
            Risk segment volume
          </h3>
          
          <div className="flex-1 flex flex-col justify-center space-y-4 py-2">
            {/* Low Risk Card */}
            <div className="flex items-center justify-between p-3.5 rounded-md bg-emerald-500/5 border border-emerald-500/10">
              <div>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Low Risk (&lt;15%)</span>
                <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {data?.counts?.lowCount?.toLocaleString() ?? "0"}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm">
                Safe
              </span>
            </div>

            {/* Medium Risk Card */}
            <div className="flex items-center justify-between p-3.5 rounded-md bg-amber-500/5 border border-amber-500/10">
              <div>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Medium Risk (15-40%)</span>
                <span className="block text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {data?.counts?.medCount?.toLocaleString() ?? "0"}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm">
                Watch
              </span>
            </div>

            {/* High Risk Card */}
            <div className="flex items-center justify-between p-3.5 rounded-md bg-rose-500/5 border border-rose-500/10">
              <div>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">High Risk (&gt;=40%)</span>
                <span className="block text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {data?.counts?.highCount?.toLocaleString() ?? "0"}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-sm">
                Critical
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Deep-dive Heatmap Grid (Lowest-urgency at bottom) */}
      <div className="terminal-card">
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h3 className="terminal-card-title">Card tier vs. bureau CIBIL matrix</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Aggregated default risk metrics across credit score brackets and product lines.
        </p>

        <div className="max-w-4xl mx-auto">
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="py-3 text-[var(--text-secondary)] text-left uppercase text-xs font-bold w-1/4">Product Line</th>
                {['Poor (<600)', 'Fair (600-700)', 'Good (700-800)', 'Excellent (800+)'].map(bracket => (
                  <th 
                    key={bracket} 
                    className={`py-3 uppercase text-xs font-bold transition-all ${
                      hoveredCibil === bracket ? 'text-[var(--text-primary)] bg-slate-500/5' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {bracket.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.heatmapGrid?.map((row: any) => (
                <tr 
                  key={row.tier} 
                  className={`transition-all ${
                    hoveredTier === row.tier ? 'bg-slate-500/5' : ''
                  }`}
                >
                  <td className={`py-3 text-left font-semibold border-r border-[var(--border-color)] text-sm uppercase ${
                    hoveredTier === row.tier ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  }`}>
                    {row.tier}
                  </td>
                  {['Poor (<600)', 'Fair (600-700)', 'Good (700-800)', 'Excellent (800+)'].map(bracket => {
                    const val = row[bracket] || 0.0;
                    return (
                      <td
                        key={bracket}
                        onMouseEnter={() => {
                          setHoveredTier(row.tier);
                          setHoveredCibil(bracket);
                        }}
                        onMouseLeave={() => {
                          setHoveredTier(null);
                          setHoveredCibil(null);
                        }}
                        className="p-1.5 font-bold terminal-text-mono transition-all duration-150 border border-transparent"
                      >
                        <div className={`py-2.5 rounded-md text-sm font-bold ${getHeatmapColor(val)}`}>
                          {val.toFixed(1)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Fallback Mock Data Generator for visual elegance in Demo
function getMockPortfolioData() {
  return {
    isDemo: true,
    isCustom: false,
    totalSize: 10000,
    avgPD: 0.0350,
    avgCibil: 762.3,
    totalLimit: 2549670000,
    counts: {
      lowCount: 8228,
      medCount: 1095,
      highCount: 677
    },
    tierChartData: [
      { tier: 'Signature', 'Avg PD %': 3.63, 'Limit exposure (Cr)': 76.5 },
      { tier: 'Platinum', 'Avg PD %': 3.51, 'Limit exposure (Cr)': 63.8 },
      { tier: 'Gold', 'Avg PD %': 3.50, 'Limit exposure (Cr)': 51.0 },
      { tier: 'Classic', 'Avg PD %': 3.38, 'Limit exposure (Cr)': 38.2 }
    ],
    heatmapGrid: [
      { tier: 'Signature', 'Poor (<600)': 42.5, 'Fair (600-700)': 12.8, 'Good (700-800)': 2.5, 'Excellent (800+)': 0.8 },
      { tier: 'Platinum', 'Poor (<600)': 45.1, 'Fair (600-700)': 14.2, 'Good (700-800)': 2.8, 'Excellent (800+)': 0.9 },
      { tier: 'Gold', 'Poor (<600)': 43.8, 'Fair (600-700)': 13.9, 'Good (700-800)': 2.6, 'Excellent (800+)': 0.8 },
      { tier: 'Classic', 'Poor (<600)': 40.2, 'Fair (600-700)': 11.5, 'Good (700-800)': 2.1, 'Excellent (800+)': 0.6 }
    ],
    topStressed: [
      { customer_id: 'CRD100561', customer_name: 'Amit Sharma', cibil_score: 412, card_tier: 'Classic', total_credit_limit: 80000, risk_score: 0.845 },
      { customer_id: 'CRD102143', customer_name: 'Priya Iyer', cibil_score: 385, card_tier: 'Gold', total_credit_limit: 150000, risk_score: 0.812 },
      { customer_id: 'CRD100094', customer_name: 'Vikram Singh', cibil_score: 462, card_tier: 'Platinum', total_credit_limit: 350000, risk_score: 0.784 },
      { customer_id: 'CRD107812', customer_name: 'Anjali Verma', cibil_score: 512, card_tier: 'Signature', total_credit_limit: 800000, risk_score: 0.756 },
      { customer_id: 'CRD103004', customer_name: 'Manish Gupta', cibil_score: 488, card_tier: 'Signature', total_credit_limit: 1200000, risk_score: 0.721 }
    ]
  };
}
