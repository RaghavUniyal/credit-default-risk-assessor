'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ShieldAlert, 
  Building,
  CreditCard,
  Users,
  Activity,
  Layers
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

  // React Query to fetch portfolio data
  const { data: portfolioData, isLoading, error } = useQuery({
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
        // Since we want the latest, we overwrite. If there are duplicates, we keep the last one.
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

      // 1. Calculations
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
        topStressed
      };
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded bg-slate-900 animate-pulse"></div>
          <div className="h-4 w-32 rounded bg-slate-900 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-900/60 border border-slate-900 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-80 rounded-xl bg-slate-900/60 border border-slate-900 lg:col-span-2 animate-pulse"></div>
          <div className="h-80 rounded-xl bg-slate-900/60 border border-slate-900 animate-pulse"></div>
        </div>
      </div>
    );
  }

  const data = portfolioData?.empty ? getMockPortfolioData() : portfolioData;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Portfolio Risk Overview</h2>
          <p className="text-xs text-slate-400">Indian Credit Cards default risk analytics & capital adequacy impact dashboard.</p>
        </div>
        {portfolioData?.empty && (
          <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400 uppercase tracking-widest animate-pulse">
            DEMO MODE (No Portfolio Uploaded)
          </span>
        )}
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingested Accounts</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-white">{data?.totalSize.toLocaleString()}</h3>
            <span className="text-[9px] font-bold text-slate-500 uppercase">Accounts</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weighted PD</span>
            <Activity className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-rose-400">{(data?.avgPD * 100).toFixed(2)}%</h3>
            <span className="inline-flex items-center text-[10px] font-semibold text-rose-400">
              <TrendingUp className="mr-0.5 h-3 w-3" />
              Stress level
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg CIBIL Score</span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-white">{Math.round(data?.avgCibil)}</h3>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400">
              <TrendingUp className="mr-0.5 h-3 w-3" />
              Prime Avg
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding Limit</span>
            <Building className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-xl font-black text-white">
              INR {(data?.totalLimit / 10000000).toFixed(2)} Cr
            </h3>
            <span className="text-[9px] font-bold text-slate-500 uppercase">Limit Exposure</span>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Chart: Bank Segmentation */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Bank Exposure and Average PD %</h3>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bankChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="bank" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#64748b" label={{ value: 'PD %', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#818cf8" label={{ value: 'Limit Exposure (Cr)', angle: 90, position: 'insideRight', fill: '#818cf8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="Avg PD %" fill="#f87171" name="Avg PD %" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="Limit exposure (Cr)" fill="#818cf8" name="Exposure (Cr)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Risk segment distribution */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel flex flex-col">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Risk Distribution</h3>
          <div className="flex-1 flex items-center justify-center h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Low Risk (<15%)', value: data?.counts.lowCount, color: '#10b981' },
                    { name: 'Medium Risk (15-40%)', value: data?.counts.medCount, color: '#eab308' },
                    { name: 'High Risk (>=40%)', value: data?.counts.highCount, color: '#ef4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#eab308" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold border-t border-slate-900 pt-3">
            <div>
              <span className="text-emerald-400 block">LOW</span>
              <span className="text-slate-400 text-[9px]">{data?.counts.lowCount} Accts</span>
            </div>
            <div>
              <span className="text-yellow-400 block">MEDIUM</span>
              <span className="text-slate-400 text-[9px]">{data?.counts.medCount} Accts</span>
            </div>
            <div>
              <span className="text-rose-400 block">HIGH</span>
              <span className="text-slate-400 text-[9px]">{data?.counts.highCount} Accts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Network PD and High-Risk Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Network Chart */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">PD % by Card Network</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.networkChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="network" type="category" stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                <Bar dataKey="Avg PD %" fill="#fbbf24" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High Risk Table */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Stressed Assets - Highest Default Risk</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Cust ID</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">CIBIL</th>
                  <th className="px-4 py-2.5">Bank</th>
                  <th className="px-4 py-2.5">Limit</th>
                  <th className="px-4 py-2.5 text-right">Continuous PD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {data?.topStressed.map((cust: any) => (
                  <tr key={cust.customer_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">{cust.customer_id}</td>
                    <td className="px-4 py-3 text-slate-200">{cust.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${cust.cibil_score < 600 ? 'text-red-400' : 'text-slate-300'}`}>
                        {cust.cibil_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">{cust.primary_bank}</td>
                    <td className="px-4 py-3">INR {cust.total_credit_limit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex rounded-full bg-rose-950/50 border border-rose-800/30 px-2 py-0.5 font-black text-rose-400">
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
    topStressed: [
      { customer_id: 'IND100561', customer_name: 'Amit Sharma', cibil_score: 412, primary_bank: 'SBI', total_credit_limit: 150000, risk_score: 0.945 },
      { customer_id: 'IND102143', customer_name: 'Priya Iyer', cibil_score: 385, primary_bank: 'Yes Bank', total_credit_limit: 95000, risk_score: 0.912 },
      { customer_id: 'IND100094', customer_name: 'Vikram Singh', cibil_score: 462, primary_bank: 'ICICI', total_credit_limit: 250000, risk_score: 0.884 },
      { customer_id: 'IND107812', customer_name: 'Anjali Verma', cibil_score: 512, primary_bank: 'Axis', total_credit_limit: 100000, risk_score: 0.856 },
      { customer_id: 'IND103004', customer_name: 'Manish Gupta', cibil_score: 488, primary_bank: 'HDFC', total_credit_limit: 500000, risk_score: 0.821 }
    ]
  };
}
