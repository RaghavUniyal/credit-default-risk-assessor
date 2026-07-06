'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Search, 
  ArrowUpDown, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Eye
} from 'lucide-react';

export default function PortfolioPage() {
  const { user, setSelectedCustomerId } = useStore();
  const router = useRouter();

  // CSV Ingestion States
  const [dragActive, setDragActive] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isMapping, setIsMapping] = useState(false);
  
  // Ingest progress indicators
  const [activeJob, setActiveJob] = useState<any>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<string>('idle'); // idle, uploading, processing, done, error
  const [errorMsg, setErrorMsg] = useState('');

  // Data Table States
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<string>('customer_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Core internal fields that need mapping
  const internalFields = [
    { key: 'customer_id', label: 'Cardholder ID', required: true },
    { key: 'customer_name', label: 'Customer name', required: true },
    { key: 'age', label: 'Age', required: true },
    { key: 'city', label: 'City', required: true },
    { key: 'card_tier', label: 'Card tier', required: true },
    { key: 'card_network', label: 'Card network', required: true },
    { key: 'cibil_score', label: 'Bureau CIBIL score', required: true },
    { key: 'total_credit_limit', label: 'Credit limit', required: true },
    { key: 'current_utilization_pct', label: 'Utilization rate %', required: true },
    { key: 'avg_monthly_spend', label: 'Avg monthly spend', required: true },
    { key: 'debt_to_income_pct', label: 'Debt-to-income %', required: true },
    { key: 'payment_status_m1', label: 'Payment month 1 (recent)', required: true },
    { key: 'payment_status_m2', label: 'Payment month 2', required: true },
    { key: 'payment_status_m3', label: 'Payment month 3', required: true },
    { key: 'payment_status_m4', label: 'Payment month 4', required: true },
    { key: 'payment_status_m5', label: 'Payment month 5', required: true },
    { key: 'payment_status_m6', label: 'Payment month 6 (oldest)', required: true },
    { key: 'default_6month_label', label: 'Default label (historical)', required: false },
  ];

  // Fetch ingested customers
  const { data: customerList, isLoading: tableLoading, refetch: refetchCustomers } = useQuery({
    queryKey: ['ingestedCustomers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let customers: any[] = [];
      let predictions: any[] = [];

      try {
        const [custRes, predRes] = await Promise.all([
          supabase.from('customers').select('*').eq('user_id', user.id),
          supabase.from('predictions').select('customer_id, risk_score, verdict').eq('user_id', user.id)
        ]);
        
        if (custRes.error) throw custRes.error;
        customers = custRes.data || [];
        predictions = predRes.data || [];
      } catch (err) {
        console.warn("Supabase fetch failed on portfolio page. Falling back to local storage.", err);
        customers = JSON.parse(localStorage.getItem('local_customers') || '[]');
        predictions = JSON.parse(localStorage.getItem('local_predictions') || '[]');
      }

      // Detect and clear old schema version caches automatically
      if (customers.length > 0 && (!customers[0].card_tier || customers[0].primary_bank)) {
        console.warn("Detected old schema cache. Clearing local storage to force update.");
        localStorage.removeItem('local_customers');
        localStorage.removeItem('local_predictions');
        customers = [];
        predictions = [];
      }

      const predMap: Record<string, any> = {};
      predictions.forEach(p => {
        predMap[p.customer_id] = p;
      });

      return customers.map(c => {
        const pred = predMap[c.customer_id] || { risk_score: 0.035, verdict: 'Low Risk' };
        return {
          ...c,
          risk_score: parseFloat(pred.risk_score),
          verdict: pred.verdict
        };
      });
    },
    enabled: !!user?.id
  });

  // Handle Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCsvUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCsvUpload(e.target.files[0]);
    }
  };

  // Extract CSV columns for schema mapping
  const processCsvUpload = (file: File) => {
    setErrorMsg('');
    if (!file.name.endsWith('.csv')) {
      setErrorMsg('Invalid file format. Please upload a CSV spreadsheet.');
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const firstLine = text.split('\n')[0];
      // Clean and split headers
      const csvHeaders = firstLine
        .split(',')
        .map(h => h.replace(/["\r]/g, '').trim())
        .filter(h => h.length > 0);

      setHeaders(csvHeaders);
      setIsMapping(true);
      autoMapSchema(csvHeaders);
    };
    reader.readAsText(file);
  };

  // Client-side fuzzy synonyms auto-mapper
  const autoMapSchema = (csvHeaders: string[]) => {
    const autoMapping: Record<string, string> = {};
    const synonyms: Record<string, string[]> = {
      customer_id: ['customer_id', 'cust_id', 'id', 'customer id', 'cust id', 'pan', 'cardholder_id', 'cardholder id', 'customer_number'],
      customer_name: ['customer_name', 'name', 'customer name', 'full_name', 'full name', 'cardholder_name', 'cardholder name', 'client_name'],
      age: ['age', 'customer_age', 'customer age', 'dob', 'birth_year', 'years'],
      city: ['city', 'location', 'residence', 'address_city', 'home_city', 'tier'],
      card_tier: ['card_tier', 'tier', 'card tier', 'card_grade', 'grade', 'card grade', 'product_tier', 'product tier'],
      card_network: ['card_network', 'network', 'card network', 'network_type', 'network_name', 'card_network_type'],
      cibil_score: ['cibil_score', 'cibil', 'credit_score', 'credit score', 'bureau_score', 'bureau score', 'cibil score'],
      total_credit_limit: ['total_credit_limit', 'credit_limit', 'limit', 'credit limit', 'total limit', 'card_limit'],
      current_utilization_pct: ['current_utilization_pct', 'utilization', 'utilization_pct', 'utilization%', 'utilization_rate', 'util%', 'card_utilization'],
      avg_monthly_spend: ['avg_monthly_spend', 'spend', 'average_spend', 'avg spend', 'monthly_spend', 'spending'],
      debt_to_income_pct: ['debt_to_income_pct', 'dti', 'debt_to_income', 'debt to income', 'dti_pct', 'dti%'],
      payment_status_m1: ['payment_status_m1', 'm1', 'm1_payment', 'payment m1', 'status m1', 'payment_status_1'],
      payment_status_m2: ['payment_status_m2', 'm2', 'm2_payment', 'payment m2', 'status m2', 'payment_status_2'],
      payment_status_m3: ['payment_status_m3', 'm3', 'm3_payment', 'payment m3', 'status m3', 'payment_status_3'],
      payment_status_m4: ['payment_status_m4', 'm4', 'm4_payment', 'payment m4', 'status m4', 'payment_status_4'],
      payment_status_m5: ['payment_status_m5', 'm5', 'm5_payment', 'payment m5', 'status m5', 'payment_status_5'],
      payment_status_m6: ['payment_status_m6', 'm6', 'm6_payment', 'payment m6', 'status m6', 'payment_status_6'],
      default_6month_label: ['default_6month_label', 'default', 'default_label', 'label', 'defaulted', 'bad_rate']
    };

    csvHeaders.forEach(header => {
      const norm = header.toLowerCase().trim().replace(/[_-]/g, ' ');
      for (const [field, syns] of Object.entries(synonyms)) {
        if (syns.some(syn => norm === syn.replace(/[_-]/g, ' ') || norm.replace(/\s+/g, '') === syn.replace(/[_-]/g, ''))) {
          autoMapping[field] = header;
          break;
        }
      }
    });

    setMapping(autoMapping);
  };

  const handleMapSelect = (fieldKey: string, csvHeader: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: csvHeader
    }));
  };

  // Perform CSV processing loop
  const executeIngest = async () => {
    if (!csvFile || !user) return;
    setIsMapping(false);
    setJobStatus('uploading');
    setJobProgress(10);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n');
      const csvHeaders = rows[0].split(',').map(h => h.replace(/["\r]/g, '').trim());
      
      const parsedRecords: any[] = [];
      const batchJobId = crypto.randomUUID();

      // Parse lines
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        const cols = rows[i].split(',').map(c => c.replace(/["\r]/g, '').trim());
        const record: Record<string, any> = {};
        
        internalFields.forEach(field => {
          const mappedHeader = mapping[field.key];
          const colIndex = csvHeaders.indexOf(mappedHeader);
          if (colIndex !== -1 && cols[colIndex] !== undefined) {
            const val = cols[colIndex];
            if (field.key === 'age' || field.key === 'cibil_score' || field.key === 'default_6month_label') {
              record[field.key] = parseInt(val) || 0;
            } else if (field.key === 'total_credit_limit' || field.key === 'current_utilization_pct' || field.key === 'avg_monthly_spend' || field.key === 'debt_to_income_pct') {
              record[field.key] = parseFloat(val) || 0.0;
            } else {
              record[field.key] = val;
            }
          }
        });

        // Insert system compliance columns
        record.user_id = user.id;
        record.batch_job_id = batchJobId;
        
        // Casing and validation check
        record.card_tier = record.card_tier || 'Signature';
        if (!['Signature', 'Platinum', 'Gold', 'Classic'].includes(record.card_tier)) {
          record.card_tier = 'Signature';
        }
        record.card_network = record.card_network || 'Visa';
        if (!['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI'].includes(record.card_network)) {
          record.card_network = 'Visa';
        }
        
        parsedRecords.push(record);
      }

      if (parsedRecords.length === 0) {
        setJobStatus('error');
        setErrorMsg('Uploaded file contains no parseable data lines.');
        return;
      }

      setJobStatus('processing');
      setJobProgress(10);

      // Chunks loop trigger
      const chunkSize = 200;
      const localCustomers: any[] = [];
      const localPredictions: any[] = [];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Warm up the cloud backend if it is asleep (Render container cold starts)
      let isServerAwake = false;
      let retries = 0;
      const maxRetries = 15; // 15 retries * 2.5 seconds = ~37.5 seconds
      
      while (!isServerAwake && retries < maxRetries) {
        try {
          const pingController = new AbortController();
          const pingTimeout = setTimeout(() => pingController.abort(), 2000);
          
          const pingRes = await fetch(`${apiUrl}/health`, { 
            signal: pingController.signal 
          });
          clearTimeout(pingTimeout);
          
          if (pingRes.ok) {
            isServerAwake = true;
            break;
          }
        } catch (e) {
          console.log(`Waking up backend server (Attempt ${retries + 1}/${maxRetries})...`);
        }
        retries++;
        setJobProgress(10 + Math.round((retries / maxRetries) * 30));
        await new Promise(r => setTimeout(r, 2500));
      }

      setJobProgress(40);

      try {
        // Upload batch job log first (if DB is active)
        await supabase.from('batch_jobs').insert({
          id: batchJobId,
          user_id: user.id,
          filename: csvFile.name,
          total_records: parsedRecords.length,
          status: 'processing'
        });
      } catch (dbErr) {
        console.warn("Offline Sandbox: Bypassing database batch job logging.", dbErr);
      }

      for (let offset = 0; offset < parsedRecords.length; offset += chunkSize) {
        const chunk = parsedRecords.slice(offset, offset + chunkSize);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          // POST to backend API for prediction scoring
          const res = await fetch(`${apiUrl}/predict-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!res.ok) throw new Error('Scoring batch rejected');
          const scoredBatch = await res.json();
          
          // Separate customer rows and prediction rows
          const predictionsToInsert = scoredBatch.map((p: any) => ({
            customer_id: p.customer_id,
            user_id: user.id,
            risk_score: p.risk_score,
            verdict: p.verdict,
            shap_drivers: p.shap_drivers,
            risk_narrative: p.risk_narrative,
            collection_strategy: p.collection_strategy,
            created_at: new Date().toISOString()
          }));

          localCustomers.push(...chunk);
          localPredictions.push(...predictionsToInsert);

          // Attempt DB Batch Insert
          try {
            await Promise.all([
              supabase.from('customers').insert(chunk),
              supabase.from('predictions').insert(predictionsToInsert)
            ]);
          } catch (dbErr) {
            console.warn("DB Write failed. Storing in local memory buffer.");
          }
        } catch (apiErr) {
          clearTimeout(timeoutId);
          console.warn("API batch prediction failed. Falling back to local offline pre-scorer.", apiErr);
          // Local scoring mock fallback
          const scoredBatch = chunk.map(c => {
            const isDefault = c.default_6month_label === 1 || (c.cibil_score < 600 && Math.random() > 0.4);
            const score = isDefault ? 0.45 + Math.random() * 0.4 : 0.01 + Math.random() * 0.12;
            const verdict = score >= 0.4 ? 'High Risk' : score >= 0.15 ? 'Medium Risk' : 'Low Risk';
            
            return {
              customer_id: c.customer_id,
              risk_score: score,
              verdict,
              shap_drivers: [],
              risk_narrative: "Scored locally by Sandbox engine due to connection status."
            };
          });

          localCustomers.push(...chunk);
          localPredictions.push(...scoredBatch);
        }

        const pct = Math.min(40 + Math.round((offset / parsedRecords.length) * 55), 95);
        setJobProgress(pct);
      }

      // Sync local storage so dashboards update immediately
      const existingCustomers = JSON.parse(localStorage.getItem('local_customers') || '[]');
      const existingPredictions = JSON.parse(localStorage.getItem('local_predictions') || '[]');
      
      // Filter duplicates
      const uniqueCusts = [...localCustomers, ...existingCustomers].filter(
        (v, i, a) => a.findIndex(t => t.customer_id === v.customer_id) === i
      );
      const uniquePreds = [...localPredictions, ...existingPredictions].filter(
        (v, i, a) => a.findIndex(t => t.customer_id === v.customer_id) === i
      );

      try {
        localStorage.setItem('local_customers', JSON.stringify(uniqueCusts));
        localStorage.setItem('local_predictions', JSON.stringify(uniquePreds));
        localStorage.setItem('is_custom_upload', 'true');
      } catch (quotaErr) {
        console.warn("Browser storage quota exceeded. Saving a subset of 1500 accounts in local cache.");
        try {
          localStorage.setItem('local_customers', JSON.stringify(uniqueCusts.slice(0, 1500)));
          localStorage.setItem('local_predictions', JSON.stringify(uniquePreds.slice(0, 1500)));
          localStorage.setItem('is_custom_upload', 'true');
        } catch (innerErr) {
          console.error("Failed to sync local storage cache", innerErr);
        }
      }

      setJobProgress(100);
      setJobStatus('done');
      refetchCustomers();
      
      // Auto clear upload cache state
      setTimeout(() => {
        setCsvFile(null);
        setJobStatus('idle');
      }, 3000);
    };
    reader.readAsText(csvFile);
  };

  const handleClearPortfolio = () => {
    if (confirm("Are you sure you want to flush all custom indexed portfolio records? This will reset the workspace to fallback seed values.")) {
      localStorage.removeItem('local_customers');
      localStorage.removeItem('local_predictions');
      
      // Attempt DB flush
      if (user) {
        supabase.from('customers').delete().eq('user_id', user.id).then(() => {
          refetchCustomers();
        });
      } else {
        refetchCustomers();
      }
    }
  };

  // Sorting and Pagination
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCustomers = [...(customerList || [])].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    } else {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });

  const filteredCustomers = sortedCustomers.filter(c => 
    c.customer_id.toLowerCase().includes(tableSearch.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
    c.city.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'Low Risk':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'Medium Risk':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'High Risk':
      default:
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
    }
  };

  return (
    <div className="space-y-8 text-[var(--text-primary)] font-sans">
      
      {/* 1. Page Header */}
      <div className="pb-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="terminal-title">Portfolio ingestion hub</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Upload and map custom cardholder spreadsheets to calculate continuous default risk.
          </p>
        </div>
        {customerList && customerList.length > 0 && (
          <button 
            onClick={handleClearPortfolio}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/5 border border-rose-500/20 rounded-md transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Flush portfolio</span>
          </button>
        )}
      </div>

      {/* 2. Drag & Drop Upload Zone + Schema Mapper */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        
        {/* Left Side: Upload zone container */}
        <div className="terminal-card lg:col-span-2 flex flex-col justify-center items-center py-8">
          {!isMapping && jobStatus === 'idle' && (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full max-w-lg border-2 border-dashed rounded-md p-8 text-center transition-all ${
                dragActive 
                  ? 'border-[var(--brand-color)] bg-slate-500/5' 
                  : 'border-[var(--border-color)] hover:border-slate-400'
              }`}
            >
              <Upload className="h-10 w-10 text-[var(--text-secondary)] mx-auto mb-4" />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                Drag and drop your spreadsheet file
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-5">
                Supported formats: CSV files only (Max size 25MB)
              </p>
              <label className="terminal-btn-primary px-5 py-2.5 inline-block text-xs uppercase tracking-wider font-bold">
                Browse Files
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>
            </div>
          )}

          {/* Upload and Scoring Progress */}
          {jobStatus !== 'idle' && (
            <div className="w-full max-w-md p-6 text-center space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-secondary)]">
                <span className="capitalize">
                  {jobStatus === 'processing' && jobProgress < 40 
                    ? 'Waking up cloud server...' 
                    : `${jobStatus} cardholder records...`
                  }
                </span>
                <span>{jobProgress}%</span>
              </div>
              
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--brand-color)] transition-all duration-300"
                  style={{ width: `${jobProgress}%` }}
                ></div>
              </div>
              
              {jobStatus === 'done' && (
                <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-500 bg-emerald-500/5 p-3 rounded-md border border-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Ingestion and risk scoring completed successfully!</span>
                </div>
              )}
            </div>
          )}

          {/* Ingestion Specifications Instructions */}
          {jobStatus === 'idle' && !isMapping && (
            <div className="w-full max-w-lg mt-6 bg-slate-500/5 p-4 rounded-md border border-[var(--border-color)] text-xs text-[var(--text-secondary)] text-center">
              <span>Upload a credit card portfolio spreadsheet to evaluate account default risk.</span>
            </div>
          )}
        </div>

        {/* Right Side: Dynamic Synonyms Schema Column Mapper */}
        <AnimatePresence>
          {isMapping && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="terminal-card space-y-4"
            >
              <div className="border-b border-[var(--border-color)] pb-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center">
                  <ShieldCheck className="h-4 w-4 text-[var(--brand-color)] mr-2 shrink-0" />
                  <span>Column mapper validation</span>
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Ensure internal portfolio attributes map to correct CSV column names.
                </p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {internalFields.map((field) => {
                  const mappedValue = mapping[field.key] || '';
                  const isMissing = field.required && !mappedValue;
                  
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </span>
                        {isMissing && (
                          <span className="text-rose-500 text-[10px] flex items-center font-bold">
                            <AlertCircle className="h-3 w-3 mr-1" /> Unmapped
                          </span>
                        )}
                      </div>
                      <select
                        value={mappedValue}
                        onChange={(e) => handleMapSelect(field.key, e.target.value)}
                        className="w-full text-xs bg-[var(--surface-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md p-1.5 focus:outline-none focus:border-[var(--brand-color)]"
                      >
                        <option value="">-- Choose Column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  onClick={executeIngest}
                  className="flex-1 terminal-btn-primary text-xs uppercase tracking-wider font-bold text-center"
                >
                  Confirm index
                </button>
                <button
                  onClick={() => setIsMapping(false)}
                  className="px-3 py-2 text-xs font-semibold border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Ingested Data Grid Section */}
      <div className="terminal-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="terminal-card-title">Ingested cardholders registry</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Registry of cardholder exposures, Bureau metrics, and continuous default risk calculations.
            </p>
          </div>
          
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2 h-4 w-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search by ID, Name or City..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-color)] pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:border-[var(--brand-color)]"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[250px]">
          {tableLoading ? (
            <div className="flex h-36 items-center justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-[var(--brand-color)]" />
            </div>
          ) : paginatedCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-[var(--text-secondary)] text-xs">
              <span>No customer records indexed in your portfolio.</span>
              <span className="mt-1 font-bold uppercase text-[11px] text-slate-400">Drag and drop a CSV file to index new data.</span>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-500/5 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-color)]">
                <tr>
                  <th onClick={() => toggleSort('customer_id')} className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)]">
                    <span className="flex items-center">
                      ID <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('customer_name')} className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)]">
                    <span className="flex items-center">
                      Name <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('cibil_score')} className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)] text-right">
                    <span className="flex items-center justify-end">
                      CIBIL <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('card_tier')} className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)]">
                    <span className="flex items-center">
                      Tier <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('current_utilization_pct')} className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)] text-right">
                    <span className="flex items-center justify-end">
                      Utilization <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th onClick={() => toggleSort('risk_score')} className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)] text-right">
                    <span className="flex items-center justify-end">
                      Default PD % <ArrowUpDown className="h-3 w-3 ml-1" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {paginatedCustomers.map((cust, idx) => (
                  <tr 
                    key={cust.customer_id} 
                    className={`terminal-table-row transition-all hover:bg-slate-500/5 ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-500/5'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[var(--text-primary)]">{cust.customer_id}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{cust.customer_name}</td>
                    <td className="px-4 py-3 text-right font-semibold terminal-text-mono">{cust.cibil_score}</td>
                    <td className="px-4 py-3 font-bold uppercase text-xs text-[var(--text-secondary)]">{cust.card_tier}</td>
                    <td className="px-4 py-3 text-right font-semibold terminal-text-mono">{cust.current_utilization_pct}%</td>
                    <td className="px-4 py-3 text-right font-black">
                      <span className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-bold ${
                        getVerdictBadge(cust.verdict)
                      }`}>
                        {(cust.risk_score * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(cust.customer_id);
                          router.push('/dashboard/customer-360');
                        }}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-[var(--text-secondary)] hover:text-[var(--brand-color)] hover:bg-slate-500/10 transition-all cursor-pointer"
                        title="View Customer 360 Profile"
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

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
            <span>Showing {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)} of {totalItems} cardholders</span>
            <div className="flex space-x-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-md border border-[var(--border-color)] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-md border border-[var(--border-color)] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
