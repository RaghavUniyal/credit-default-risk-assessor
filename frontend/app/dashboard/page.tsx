'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Building,
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
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function OverviewPage() {
  const { user } = useStore();

  // Heatmap highlights state
  const [hoveredBank, setHoveredBank] = useState<string | null>(null);
  const [hoveredNetwork, setHoveredNetwork] = useState<string | null>(null);

  // React Query to fetch portfolio data
  const { data: portfolioData, isLoading } = useQuery({
    queryKey: ['portfolioData', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Fetch customers and predictions in parallel
      const [custRes, predRes] = await Promise.all([
        supabase.from('customers').select('customer_id, customer_name, age, city, primary_bank, card_network, total_credit_limit, cibil_score').eq('user_id', user.id),
        supabase.from('predictions').select('customer_id, risk_score, verdict').eq('user_id', user.id)
      ]);

      if (custRes.error) throw custRes.error;
      if (predRes.error) throw predRes.error;

      const customers = custRes.data || [];
      const predictions = predRes.data || [];

      if (customers.length === 0) {
        return { empty: true };
      }

      // Merge data by customer_id (latest prediction)
      const latestPreds: Record<string, any> = {};
      predictions.forEach(p => {
        latestPreds[p.customer_id] = p;
      });

      const merged = customers.map(c => {
        const pred = latestPreds[c.customer_id] || { risk_score: 0.12, verdict: 'Low Risk' };
        return {
          ...c,
          risk_score: parseFloat(pred.risk_score),
          verdict: pred.verdict
        };
      });

      // calculations
      const totalSize = merged.length;
      const avgPD = merged.reduce((acc, curr) => acc + curr.risk_score, 0) / totalSize;
      const avgCibil = merged.reduce((acc, curr) => acc + curr.cibil_score, 0) / totalSize;
      const totalLimit = merged.reduce((acc, curr) => acc + curr.total_credit_limit, 0);

      // Counts
      let lowCount = 0;
      let medCount = 0;
      let highCount = 0;
      merged.forEach(c => {
        if (c.verdict === 'Low Risk') lowCount++;
        else if (c.verdict === 'Medium Risk') medCount++;
        else if (c.verdict === 'High Risk') highCount++;
      });

      // Segment by Bank
      const bankStats: Record<string, { totalPD: number, count: number, totalLimit: number }> = {};
      merged.forEach(c => {
        const bank = c.primary_bank;
        if (!bankStats[bank]) bankStats[bank] = { totalPD: 0, count: 0, totalLimit: 0 };
        bankStats[bank].totalPD += c.risk_score;
        bankStats[bank].count += 1;
        bankStats[bank].totalLimit += c.total_credit_limit;
      });
      const bankChartData = Object.keys(bankStats).map(b => ({
        bank: b,
        'Avg PD %': parseFloat((bankStats[b].totalPD / bankStats[b].count * 100).toFixed(2)),
        'Limit exposure (Cr)': parseFloat((bankStats[b].totalLimit / 10000000).toFixed(2))
      }));

      // Segment by Network
      const networkStats: Record<string, { totalPD: number, count: number, totalLimit: number }> = {};
      merged.forEach(c => {
        const net = c.card_network;
        if (!networkStats[net]) networkStats[net] = { totalPD: 0, count: 0, totalLimit: 0 };
        networkStats[net].totalPD += c.risk_score;
        networkStats[net].count += 1;
        networkStats[net].totalLimit += c.total_credit_limit;
      });
      const networkChartData = Object.keys(networkStats).map(n => ({
        network: n.replace('_', ' '),
        'Avg PD %': parseFloat((networkStats[n].totalPD / networkStats[n].count * 100).toFixed(2))
      }));

      // Dynamic Heatmap Data (Bank x Network)
      const banksList = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Yes Bank'];
      const networksList = ['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI'];
      const heatmap: Record<string, Record<string, { totalPD: number, count: number }>> = {};
      banksList.forEach(b => {
        heatmap[b] = {};
        networksList.forEach(n => {
          heatmap[b][n] = { totalPD: 0, count: 0 };
        });
      });
      merged.forEach(c => {
        const b = c.primary_bank;
        const n = c.card_network;
        if (heatmap[b] && heatmap[b][n]) {
          heatmap[b][n].totalPD += c.risk_score;
          heatmap[b][n].count += 1;
        }
      });
      const heatmapGrid = banksList.map(b => {
        const row: Record<string, any> = { bank: b };
        networksList.forEach(n => {
          const stats = heatmap[b][n];
          row[n] = stats.count > 0 ? parseFloat((stats.totalPD / stats.count * 100).toFixed(1)) : 15.0; // default safe fallback
        });
        return row;
      });

      // Top High-Risk Customers
      const topStressed = [...merged]
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 5);

      return {
        empty: false,
        totalSize,
        avgPD,
        avgCibil,
        totalLimit,
        counts: { lowCount, medCount, highCount },
        bankChartData,
        networkChartData,
        heatmapGrid,
        topStressed
      };
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 rounded bg-slate-200 dark:bg-slate-800 lg:col-span-2 animate-pulse"></div>
          <div className="h-72 rounded bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
        </div>
      </div>
    );
  }

  const data = portfolioData?.empty ? getMockPortfolioData() : portfolioData;

  const getHeatmapColor = (val: number) => {
    if (val < 25) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10';
    if (val < 35) return 'bg-amber-500/10 text-amber-400 border border-amber-500/10';
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/10';
  };

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'Low Risk':
        return 'text-emerald-400 border border-emerald-500/15 bg-emerald-500/5';
      case 'Medium Risk':
        return 'text-amber-400 border border-amber-500/15 bg-amber-500/5';
      case 'High Risk':
      default:
        return 'text-rose-400 border border-rose-500/15 bg-rose-500/5';
    }
  };

  // Stagger animation rules
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6 text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-2 border-b border-[#E2E8F0] dark:border-[#334155]">
        <div>
          <h2 className="text-lg font-black tracking-wider uppercase text-[#0F172A] dark:text-white">Portfolio Risk Command Center</h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-bold uppercase mt-0.5">Indian credit cards exposures and dynamic default matrix.</p>
        </div>
        {portfolioData?.empty && (
          <span className="inline-flex items-center rounded-sm bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-black text-amber-400 uppercase tracking-widest animate-pulse">
            DEMO MODE (Using Fallback Aggregates)
          </span>
        )}
      </div>

      {/* 4 Cards Grid - Staggered Motion */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Metric 1 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest">Ingested Accounts</span>
            <Users className="h-4 w-4 text-[#FFA028] dark:text-[#FFA028]" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <h3 className="text-xl font-black terminal-text-mono tracking-tight text-[#0F172A] dark:text-white">
              {data?.totalSize?.toLocaleString() ?? "0"}
            </h3>
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">Cardholders</span>
          </div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest">Weighted PD</span>
            <Activity className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <h3 className="text-xl font-black terminal-text-mono text-rose-500">
              {((data?.avgPD ?? 0) * 100).toFixed(2)}%
            </h3>
            <span className="inline-flex items-center text-[11px] font-bold text-rose-400 uppercase">
              Stress Factor
            </span>
          </div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest">Avg CIBIL Score</span>
            <Layers className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <h3 className="text-xl font-black terminal-text-mono text-[#0F172A] dark:text-white">
              {Math.round(data?.avgCibil ?? 0)}
            </h3>
            <span className="inline-flex items-center text-[11px] font-bold text-emerald-400 uppercase">
              Prime Avg
            </span>
          </div>
        </motion.div>

        {/* Metric 4 */}
        <motion.div variants={itemVariants} className="terminal-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest">Outstanding Limit</span>
            <Building className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <h3 className="text-xl font-black terminal-text-mono text-[#0F172A] dark:text-white">
              INR {((data?.totalLimit ?? 0) / 10000000).toFixed(2)} Cr
            </h3>
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">Exposure</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Chart: Bank Exposure */}
        <div className="terminal-card lg:col-span-2 !p-4">
          <h3 className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-4">Bank Exposure and Average PD %</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bankChartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:stroke-slate-800" />
                <XAxis dataKey="bank" stroke="#94A3B8" />
                <YAxis yAxisId="left" stroke="#94A3B8" />
                <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '0.125rem' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="Avg PD %" fill="#EF4444" name="Avg PD %" radius={[1, 1, 0, 0]} isAnimationActive={true} />
                <Bar yAxisId="right" dataKey="Limit exposure (Cr)" fill="#3B82F6" name="Exposure (Cr)" radius={[1, 1, 0, 0]} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Risk segment distribution */}
        <div className="terminal-card flex flex-col !p-4">
          <h3 className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-4">Risk Distribution</h3>
          <div className="flex-1 flex items-center justify-center h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Low Risk (<15%)', value: data?.counts?.lowCount ?? 0, color: '#10B981' },
                    { name: 'Medium Risk (15-40%)', value: data?.counts?.medCount ?? 0, color: '#F59E0B' },
                    { name: 'High Risk (>=40%)', value: data?.counts?.highCount ?? 0, color: '#EF4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={true}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '0.125rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold border-t border-[#E2E8F0] dark:border-slate-800 pt-3">
            <div>
              <span className="text-emerald-400 block">LOW</span>
              <span className="text-slate-400 terminal-text-mono">{data?.counts?.lowCount} Accts</span>
            </div>
            <div>
              <span className="text-yellow-400 block">MEDIUM</span>
              <span className="text-slate-400 terminal-text-mono">{data?.counts?.medCount} Accts</span>
            </div>
            <div>
              <span className="text-rose-400 block">HIGH</span>
              <span className="text-slate-400 terminal-text-mono">{data?.counts?.highCount} Accts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Interactive Heatmap + High-Risk table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Heatmap Card */}
        <div className="terminal-card !p-4 flex flex-col">
          <h3 className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
            <Sparkles className="h-4 w-4 text-[#FFA028] dark:text-[#FFA028]" />
            <span>Bank x Network Risk Heatmap</span>
          </h3>
          <p className="text-[10.5px] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold tracking-wide mb-4">
            Cross-hair highlights on hover. Cell indicates avg PD %.
          </p>

          <div className="flex-1 flex flex-col justify-between">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-slate-800">
                  <th className="py-2 text-[#64748B] dark:text-[#94A3B8] text-left uppercase text-[10px] font-bold">Bank</th>
                  {['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI'].map(net => (
                    <th 
                      key={net} 
                      className={`py-2 uppercase text-[10px] font-bold transition-all ${
                        hoveredNetwork === net ? 'text-[#FFA028] dark:text-[#FFA028] bg-amber-500/5' : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {net.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.heatmapGrid?.map((row: any) => (
                  <tr 
                    key={row.bank} 
                    className={`transition-all ${
                      hoveredBank === row.bank ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className={`py-2 text-left font-bold border-r border-[#E2E8F0] dark:border-slate-800 text-[11px] uppercase ${
                      hoveredBank === row.bank ? 'text-[#FFA028] dark:text-[#FFA028]' : 'text-slate-400'
                    }`}>
                      {row.bank}
                    </td>
                    {['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI'].map(net => {
                      const val = row[net] || 15.0;
                      return (
                        <td
                          key={net}
                          onMouseEnter={() => {
                            setHoveredBank(row.bank);
                            setHoveredNetwork(net);
                          }}
                          onMouseLeave={() => {
                            setHoveredBank(null);
                            setHoveredNetwork(null);
                          }}
                          className={`p-1 font-bold terminal-text-mono transition-all duration-150 cursor-crosshair border ${
                            hoveredBank === row.bank && hoveredNetwork === net 
                              ? 'scale-105 border-[#FFA028] dark:border-[#FFA028] shadow-sm z-10' 
                              : 'border-transparent'
                          }`}
                        >
                          <div className={`py-1.5 rounded-sm ${getHeatmapColor(val)}`}>
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

        {/* High Risk Table */}
        <div className="terminal-card lg:col-span-2 !p-4">
          <h3 className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-4 flex items-center space-x-1.5">
            <ShieldAlert className="h-4.5 w-4.5 text-rose-500" />
            <span>High Stressed Receivables (Highest default PD)</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC]/80 dark:bg-slate-950/80 text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-widest border-b border-[#E2E8F0] dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2">Cust ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">CIBIL</th>
                  <th className="px-3 py-2">Bank</th>
                  <th className="px-3 py-2">Limit</th>
                  <th className="px-3 py-2 text-right">Probability of Default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-900">
                {data?.topStressed?.map((cust: any) => (
                  <tr key={cust.customer_id} className="terminal-table-row">
                    <td className="px-3 py-2 font-mono font-bold text-[#FFA028] dark:text-[#FFA028]">{cust.customer_id}</td>
                    <td className="px-3 py-2 font-bold text-[#0F172A] dark:text-slate-200">{cust.customer_name}</td>
                    <td className="px-3 py-2 font-bold terminal-text-mono">{cust.cibil_score}</td>
                    <td className="px-3 py-2 font-bold">{cust.primary_bank}</td>
                    <td className="px-3 py-2 font-semibold terminal-text-mono">INR {cust.total_credit_limit.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-black">
                      <span className={`inline-flex rounded-sm px-2 py-0.5 text-[11px] font-extrabold ${getVerdictStyle(cust.risk_score >= 0.4 ? 'High Risk' : cust.risk_score >= 0.15 ? 'Medium Risk' : 'Low Risk')}`}>
                        {(cust.risk_score * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// Fallback Mock Data Generator for visual elegance in Demo
function getMockPortfolioData() {
  return {
    totalSize: 10000,
    avgPD: 0.3275,
    avgCibil: 742.7,
    totalLimit: 2549670000,
    counts: {
      lowCount: 4015,
      medCount: 2985,
      highCount: 3000
    },
    bankChartData: [
      { bank: 'HDFC', 'Avg PD %': 28.5, 'Limit exposure (Cr)': 76.5 },
      { bank: 'ICICI', 'Avg PD %': 31.2, 'Limit exposure (Cr)': 63.8 },
      { bank: 'SBI', 'Avg PD %': 38.6, 'Limit exposure (Cr)': 51.0 },
      { bank: 'Axis', 'Avg PD %': 34.0, 'Limit exposure (Cr)': 38.2 },
      { bank: 'Yes Bank', 'Avg PD %': 36.4, 'Limit exposure (Cr)': 25.5 },
    ],
    networkChartData: [
      { network: 'Visa', 'Avg PD %': 31.8 },
      { network: 'Mastercard', 'Avg PD %': 33.5 },
      { network: 'RuPay', 'Avg PD %': 35.1 },
      { network: 'RuPay UPI', 'Avg PD %': 34.0 }
    ],
    heatmapGrid: [
      { bank: 'HDFC', Visa: 26.2, Mastercard: 28.1, RuPay: 31.0, RuPay_UPI: 29.5 },
      { bank: 'ICICI', Visa: 29.5, Mastercard: 32.0, RuPay: 33.4, RuPay_UPI: 31.2 },
      { bank: 'SBI', Visa: 36.4, Mastercard: 39.0, RuPay: 41.2, RuPay_UPI: 39.5 },
      { bank: 'Axis', Visa: 32.1, Mastercard: 34.5, RuPay: 36.0, RuPay_UPI: 35.1 },
      { bank: 'Yes Bank', Visa: 34.0, Mastercard: 36.5, RuPay: 39.2, RuPay_UPI: 37.8 }
    ],
    topStressed: [
      { customer_id: 'IND100561', customer_name: 'Amit Sharma', cibil_score: 412, primary_bank: 'SBI', total_credit_limit: 150000, risk_score: 0.945 },
      { customer_id: 'IND102143', customer_name: 'Priya Iyer', cibil_score: 385, primary_bank: 'Yes Bank', total_credit_limit: 95000, risk_score: 0.912 },
      { customer_id: 'IND100094', customer_name: 'Vikram Singh', cibil_score: 462, primary_bank: 'ICICI', total_credit_limit: 250000, risk_score: 0.884 },
      { customer_id: 'IND107812', customer_name: 'Anjali Verma', cibil_score: 512, primary_bank: 'Axis', total_credit_limit: 100000, risk_score: 0.856 },
      { customer_id: 'IND103004', customer_name: 'Manish Gupta', cibil_score: 488, primary_bank: 'HDFC', total_credit_limit: 500000, risk_score: 0.821 }
    ]
  };
}
