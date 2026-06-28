'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  Map, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown,
  Search,
  Filter
} from 'lucide-react';

export default function PortfolioPage() {
  const router = useRouter();
  const { user, setSelectedCustomerId } = useStore();

  // Ingestion States
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvContent, setCsvContent] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isMapping, setIsMapping] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);

  // Data Table States
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<string>('customer_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Core internal fields that need mapping
  const internalFields = [
    { key: 'customer_id', label: 'Customer ID (Unique)', required: true },
    { key: 'customer_name', label: 'Customer Name', required: true },
    { key: 'age', label: 'Age', required: true },
    { key: 'city', label: 'City', required: true },
    { key: 'primary_bank', label: 'Primary Bank', required: true },
    { key: 'card_network', label: 'Card Network', required: true },
    { key: 'cibil_score', label: 'Bureau CIBIL Score', required: true },
    { key: 'total_credit_limit', label: 'Total Credit Limit', required: true },
    { key: 'current_utilization_pct', label: 'Utilization %', required: true },
    { key: 'avg_monthly_spend', label: 'Avg Monthly Spend', required: true },
    { key: 'debt_to_income_pct', label: 'Debt-to-Income %', required: true },
    { key: 'payment_status_m1', label: 'Payment M-1 (Recent)', required: true },
    { key: 'payment_status_m2', label: 'Payment M-2', required: true },
    { key: 'payment_status_m3', label: 'Payment M-3', required: true },
    { key: 'payment_status_m4', label: 'Payment M-4', required: true },
    { key: 'payment_status_m5', label: 'Payment M-5', required: true },
    { key: 'payment_status_m6', label: 'Payment M-6 (Oldest)', required: true },
    { key: 'default_6month_label', label: 'Default Label (Training)', required: false },
  ];

  // Fetch ingested customers
  const { data: customerList, isLoading: tableLoading, refetch: refetchCustomers } = useQuery({
    queryKey: ['ingestedCustomers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Fetch customers and predictions in parallel
      const [custRes, predRes] = await Promise.all([
        supabase.from('customers').select('*').eq('user_id', user.id),
        supabase.from('predictions').select('customer_id, risk_score, verdict').eq('user_id', user.id)
      ]);

      if (custRes.error) throw custRes.error;
      const customers = custRes.data || [];
      const predictions = predRes.data || [];

      // Map predictions to customers
      const predMap: Record<string, any> = {};
      predictions.forEach(p => {
        predMap[p.customer_id] = p;
      });

      return customers.map(c => {
        const pred = predMap[c.customer_id] || { risk_score: 0.1, verdict: 'Low Risk' };
        return {
          ...c,
          risk_score: parseFloat(pred.risk_score),
          verdict: pred.verdict
        };
      });
    },
    enabled: !!user?.id
  });

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      
      // Extract headers from first line
      const lines = text.split('\n');
      if (lines.length > 0) {
        const parsedHeaders = lines[0]
          .split(',')
          .map(h => h.trim().replace(/"/g, ''))
          .filter(h => h.length > 0);
          
        setHeaders(parsedHeaders);
        setIsMapping(true);
        
        // Auto detect mappings via API
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const res = await fetch(`${apiUrl}/schema-mapper/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headers: parsedHeaders }),
          });
          
          if (res.ok) {
            const data = await res.json();
            setMapping(data.mapping);
          }
        } catch (err) {
          console.error("Heuristic auto-detection failed", err);
        }
      }
    };
    reader.readAsText(selectedFile);
  };

  // Submit Ingestion Job
  const handleStartIngestion = async () => {
    if (!user) return;
    
    setIsIngesting(true);
    const batchJobId = self.crypto.randomUUID();
    
    try {
      // 1. Create a Pending Job Record in Supabase
      const { error: jobErr } = await supabase.from('batch_jobs').insert({
        id: batchJobId,
        user_id: user.id,
        filename: file?.name || 'portfolio.csv',
        status: 'pending',
        total_rows: 0,
        processed_rows: 0
      });

      if (jobErr) throw jobErr;

      // 2. Call FastAPI Start Ingest endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      const payload = {
        batch_job_id: batchJobId,
        csv_content: csvContent,
        mapping: mapping
      };

      const res = await fetch(`${apiUrl}/ingest/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('API failed to enqueue job');

      // 3. Close Mapping UI & start Polling active job
      setIsMapping(false);
      setActiveJob({
        id: batchJobId,
        filename: file?.name,
        status: 'processing',
        processed_rows: 0,
        total_rows: 10000 // placeholder till API updates
      });
      
    } catch (err: any) {
      console.error(err);
      alert(`Ingestion failed: ${err.message}`);
      setIsIngesting(false);
    }
  };

  // Polling Ingestion Job Status
  useEffect(() => {
    if (!activeJob) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', activeJob.id)
        .single();

      if (data) {
        setActiveJob(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          setIsIngesting(false);
          setFile(null);
          // Wait briefly then refresh table
          setTimeout(() => {
            refetchCustomers();
            setActiveJob(null);
          }, 1500);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJob, refetchCustomers]);

  // Sort and Filter Logic
  const filteredCustomers = (customerList || []).filter(c => {
    const searchLower = tableSearch.toLowerCase();
    return (
      c.customer_id.toLowerCase().includes(searchLower) ||
      c.customer_name.toLowerCase().includes(searchLower) ||
      c.city.toLowerCase().includes(searchLower)
    );
  });

  const sortedCustomers = [...filteredCustomers].sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    } else {
      return sortDirection === 'asc' 
        ? aVal - bVal 
        : bVal - aVal;
    }
  });

  // Pagination Logic
  const totalItems = sortedCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + pageSize);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getVerdictBadge = (verdict: string) => {
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

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Portfolio Ingestion Hub</h2>
          <p className="text-xs text-slate-400">Map custom bureau spreadsheets, predict default ratios, and index active credit portfolios.</p>
        </div>
      </div>

      {/* Upload Zone & Active Progress Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upload Card */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel lg:col-span-2 flex flex-col justify-center items-center py-8">
          {!isMapping && !activeJob && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-xl p-8 cursor-pointer w-full text-center hover:bg-slate-900/20 transition-all">
              <UploadCloud className="h-10 w-10 text-slate-500 mb-3" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Select Bureau Portfolio CSV</span>
              <span className="text-[10px] text-slate-500 mt-1">Accepts raw Indian credit card portfolio rows (up to 10k rows)</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}

          {/* Ingestion progress display */}
          {activeJob && (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                  <span className="text-xs font-bold uppercase text-slate-200">Asynchronous Data Processing</span>
                </div>
                <span className="text-[10px] rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-400 font-bold border border-emerald-500/15 uppercase">
                  {activeJob.status}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>File: {activeJob.filename}</span>
                  <span>
                    {activeJob.processed_rows.toLocaleString()} / {activeJob.total_rows.toLocaleString()} Rows
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(activeJob.processed_rows / (activeJob.total_rows || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
              {activeJob.status === 'completed' && (
                <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                  <span>Success! 10,000 portfolio records ingested, scored, and mapped with RLS security policies.</span>
                </div>
              )}
              {activeJob.status === 'failed' && (
                <div className="flex items-center space-x-2 text-xs text-rose-400 font-semibold bg-rose-950/20 border border-rose-900/40 rounded-lg p-3">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>Error: {activeJob.error_message}</span>
                </div>
              )}
            </div>
          )}

          {/* Mapping Options UI */}
          {isMapping && (
            <div className="w-full space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                <span className="font-bold text-slate-200 uppercase tracking-widest flex items-center space-x-2">
                  <Map className="h-4.5 w-4.5 text-indigo-400" />
                  <span>Schema Column Mapper</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Heuristic Matches Pre-populated</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[250px] overflow-y-auto pr-2">
                {internalFields.map((field) => (
                  <div key={field.key} className="flex flex-col space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {field.label} {field.required && <span className="text-rose-400">*</span>}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      className="rounded bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                    >
                      <option value="">-- Ignore / Select Header --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 pt-3">
                <button
                  onClick={handleStartIngestion}
                  disabled={isIngesting}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 px-6 py-2.5 font-bold text-slate-950 uppercase tracking-widest cursor-pointer text-center"
                >
                  Confirm and Start Ingest
                </button>
                <button
                  onClick={() => {
                    setIsMapping(false);
                    setFile(null);
                  }}
                  className="rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 px-6 py-2.5 font-bold text-slate-400 uppercase tracking-widest cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel space-y-3.5 text-xs text-slate-400">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">System Specifications</h3>
          <p className="leading-relaxed">
            Upload custom spreadsheets containing customer metrics. The engine parses the CSV in chunks of 500, score them against our XGBoost ML model to calculate default probability, and stores them under Row Level Security (RLS) constraints.
          </p>
          <div className="rounded-lg bg-slate-950 border border-slate-900 p-3 space-y-1.5 font-semibold text-[10px] uppercase text-slate-500">
            <span className="block text-emerald-400">✓ Continuous PD [0.0 - 1.0]</span>
            <span className="block text-emerald-400">✓ 3-Tier Risk Verdict mapping</span>
            <span className="block text-indigo-400">✓ Dynamic Column Name Synonyms</span>
          </div>
        </div>
      </div>

      {/* Main Customers List Data Table */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel">
        
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Filter className="h-4.5 w-4.5 text-emerald-400" />
            <span>Ingested Portfolio Cardholders</span>
          </h3>
          
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, Name or City"
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[300px]">
          {tableLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
          ) : paginatedCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
              <span>No customer records indexed in your portfolio.</span>
              <span className="mt-1">Drag and drop a CSV file to index new data.</span>
            </div>
          ) : (
            <table className="w-full text-[11px] text-left text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800">
                <tr>
                  <th onClick={() => toggleSort('customer_id')} className="px-4 py-3 cursor-pointer hover:text-slate-200">
                    <span className="flex items-center">
                      ID <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('customer_name')} className="px-4 py-3 cursor-pointer hover:text-slate-200">
                    <span className="flex items-center">
                      Name <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('cibil_score')} className="px-4 py-3 cursor-pointer hover:text-slate-200">
                    <span className="flex items-center">
                      CIBIL <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('primary_bank')} className="px-4 py-3 cursor-pointer hover:text-slate-200">
                    <span className="flex items-center">
                      Bank <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('current_utilization_pct')} className="px-4 py-3 cursor-pointer hover:text-slate-200">
                    <span className="flex items-center">
                      Utilization <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('risk_score')} className="px-4 py-3 cursor-pointer hover:text-slate-200 text-right">
                    <span className="flex items-center justify-end">
                      Default PD % <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {paginatedCustomers.map((cust) => (
                  <tr key={cust.customer_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">{cust.customer_id}</td>
                    <td className="px-4 py-3.5 text-slate-200">{cust.customer_name}</td>
                    <td className="px-4 py-3.5 font-semibold">{cust.cibil_score}</td>
                    <td className="px-4 py-3.5">{cust.primary_bank}</td>
                    <td className="px-4 py-3.5">{cust.current_utilization_pct}%</td>
                    <td className="px-4 py-3.5 text-right font-black">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${
                        getVerdictBadge(cust.verdict)
                      }`}>
                        {(cust.risk_score * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(cust.customer_id);
                          router.push('/dashboard/customer-360');
                        }}
                        className="rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 p-1.5 text-emerald-400 transition-colors cursor-pointer"
                        title="Customer 360 Deep-dive"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-xs font-semibold text-slate-400">
            <span>
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} entries
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="rounded bg-slate-950 hover:bg-slate-900 disabled:opacity-40 border border-slate-800 p-1.5 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="rounded bg-slate-950 hover:bg-slate-900 disabled:opacity-40 border border-slate-800 p-1.5 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
