'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BrainCircuit, 
  Send, 
  HelpCircle, 
  RefreshCw, 
  ShieldAlert,
  User,
  ArrowRight,
  Bot
} from 'lucide-react';

export default function CollectionsPage() {
  const router = useRouter();
  const { user, selectedCustomerId, setSelectedCustomerId } = useStore();
  const [activeTab, setActiveTab] = useState<'strategist' | 'simulator'>('strategist');

  // Tab 1: Collections Strategist States
  const [selectedId, setSelectedId] = useState<string>('');
  const [strategyText, setStrategyText] = useState<string>('');
  const [isStreamingStrategy, setIsStreamingStrategy] = useState(false);

  // Tab 2: Regulatory Simulator States
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
    { 
      role: 'assistant', 
      content: "Regulatory Simulation Portal active. Pre-loaded with latest Reserve Bank of India (RBI) risk weights directives (including the 25% credit card receivables hike). Query capital ratios or portfolio segmentations below."
    }
  ]);
  const [isStreamingChat, setIsStreamingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreamingChat]);

  useEffect(() => {
    if (selectedCustomerId) {
      setSelectedId(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // Fetch list of high-risk customers
  const { data: highRiskCustomers } = useQuery({
    queryKey: ['highRiskList', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: predData } = await supabase
        .from('predictions')
        .select('customer_id, risk_score, verdict')
        .eq('user_id', user.id)
        .eq('verdict', 'High Risk')
        .order('risk_score', { ascending: false })
        .limit(15);

      if (!predData || predData.length === 0) return [];
      
      const ids = predData.map(p => p.customer_id);
      
      const { data: custData } = await supabase
        .from('customers')
        .select('customer_id, customer_name, cibil_score')
        .in('customer_id', ids);

      if (!custData) return [];

      return predData.map(p => {
        const cust = custData.find(c => c.customer_id === p.customer_id) || { customer_name: 'Unknown', cibil_score: 700 };
        return {
          customer_id: p.customer_id,
          customer_name: cust.customer_name,
          cibil_score: cust.cibil_score,
          risk_score: parseFloat(p.risk_score),
        };
      });
    },
    enabled: !!user?.id
  });

  // Fetch selected customer metrics
  const { data: selectedCustomerDetails } = useQuery({
    queryKey: ['selectedCustomerDetails', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', selectedId)
        .limit(1)
        .maybeSingle();
      return data || null;
    },
    enabled: !!selectedId
  });

  const handleRunStrategy = async () => {
    if (!selectedId) return;
    
    setStrategyText('');
    setIsStreamingStrategy(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      const response = await fetch(`${apiUrl}/generate-strategy/${selectedId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('API request failed');
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            const chunk = trimmed.slice(6);
            if (chunk === '[DONE]') {
              break;
            }
            setStrategyText(prev => prev + chunk);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setStrategyText('Error generating collections strategy. Check API connection.');
    } finally {
      setIsStreamingStrategy(false);
    }
  };

  const handleSendSimulatorQuery = async (queryText: string) => {
    const textToSend = queryText || chatInput;
    if (!textToSend.trim() || isStreamingChat) return;

    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: textToSend }]);
    setIsStreamingChat(true);

    let streamReply = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(`${apiUrl}/regulatory-simulation?query=${encodeURIComponent(textToSend)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('API query failed');
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            const chunk = trimmed.slice(6);
            if (chunk === '[DONE]') {
              break;
            }
            streamReply += chunk;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: streamReply };
              return updated;
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Simulation Error: Failed to communicate with simulator backend.' };
        return updated;
      });
    } finally {
      setIsStreamingChat(false);
    }
  };

  const presetQueries = [
    "How does the new RBI 25% risk weight hike affect our portfolio capital adequacy?",
    "Which exposure segments are most impacted by the RBI provisioning requirements?",
    "Suggest risk mitigation strategies for accounts with utilization > 80% and CIBIL < 600."
  ];

  return (
    <div className="space-y-6 text-[#0F172A] dark:text-[#F8FAFC] h-[calc(100vh-8rem)] flex flex-col">
      {/* Title */}
      <div className="shrink-0 pb-2 border-b border-[#E2E8F0] dark:border-[#334155]">
        <h2 className="text-lg font-black tracking-wider uppercase text-[#0F172A] dark:text-white">Collections & Compliance Command</h2>
        <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase mt-0.5">Stream targeted collection actions and simulate RBI compliance stress tests.</p>
      </div>

      {/* Tabs Menu */}
      <div className="shrink-0 flex space-x-2 border-b border-[#E2E8F0] dark:border-slate-800 pb-1.5">
        <button
          onClick={() => setActiveTab('strategist')}
          className={`px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
            activeTab === 'strategist'
              ? 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#3B82F6] border-[#2563EB]/25'
              : 'text-[#64748B] dark:text-[#94A3B8] border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          Collections Strategist
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#3B82F6] border-[#2563EB]/25'
              : 'text-[#64748B] dark:text-[#94A3B8] border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          Regulatory Simulator
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        
        {/* Tab 1: Collections Strategist */}
        {activeTab === 'strategist' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
            {/* Left selector */}
            <div className="terminal-card flex flex-col space-y-4 overflow-y-auto max-h-full">
              <h3 className="text-[10px] font-black text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Select High-Risk Debtor</h3>
              
              <div className="space-y-1.5">
                <label className="text-[8px] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wide">Cardholder ID</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-sm bg-[#F8FAFC] dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none"
                >
                  <option value="">-- Choose High-Risk Customer --</option>
                  {highRiskCustomers?.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.customer_id} - {c.customer_name} (CIBIL: {c.cibil_score})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomerDetails ? (
                <div className="rounded-sm bg-[#F8FAFC] dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-900 p-4 space-y-3.5 text-[10px] flex-1 flex flex-col justify-between max-h-[220px]">
                  <div className="flex items-center space-x-2 pb-1.5 border-b border-[#E2E8F0] dark:border-slate-900">
                    <User className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6]" />
                    <span className="font-bold text-[#0F172A] dark:text-slate-200">{selectedCustomerDetails.customer_name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-[8px] text-slate-500 font-bold block">CIBIL</span>
                      <span className="font-semibold terminal-text-mono">{selectedCustomerDetails.cibil_score}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 font-bold block">Utilization</span>
                      <span className="font-semibold terminal-text-mono">{selectedCustomerDetails.current_utilization_pct}%</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 font-bold block">Credit Limit</span>
                      <span className="font-semibold terminal-text-mono">INR {selectedCustomerDetails.total_credit_limit.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 font-bold block">Spend Avg</span>
                      <span className="font-semibold terminal-text-mono">INR {selectedCustomerDetails.avg_monthly_spend.toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRunStrategy}
                    disabled={isStreamingStrategy}
                    className="flex w-full items-center justify-between rounded-sm bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-800 px-4 py-2 text-[9px] font-black text-white uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    <span>Run Strategist</span>
                    <ArrowRight className="h-4 w-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#E2E8F0] dark:border-slate-800 text-slate-500 text-xs rounded-sm">
                  <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose debtor to run advice strategists</span>
                </div>
              )}
            </div>

            {/* Right: Output text stream */}
            <div className="terminal-card lg:col-span-2 flex flex-col overflow-hidden max-h-full">
              <h3 className="shrink-0 text-[10px] font-black text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-3 flex items-center space-x-2">
                <BrainCircuit className="h-4 w-4 text-[#2563EB] dark:text-[#3B82F6]" />
                <span>AI Collection Strategy Console</span>
              </h3>
              
              <div className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950/60 border border-[#E2E8F0] dark:border-slate-900 p-4 font-mono text-[10px] text-[#0F172A] dark:text-slate-300 leading-relaxed max-h-full">
                {isStreamingStrategy && !strategyText && (
                  <div className="flex space-x-1.5 items-center text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#2563EB] dark:text-[#3B82F6]" />
                    <span>Establishing GenAI collection streams...</span>
                  </div>
                )}
                {strategyText ? (
                  <div className="space-y-4 whitespace-pre-wrap relative">
                    {strategyText}
                    {isStreamingStrategy && (
                      <span className="inline-block h-3.5 w-1.5 bg-[#2563EB] dark:bg-[#3B82F6] ml-1 animate-pulse"></span>
                    )}
                  </div>
                ) : (
                  !isStreamingStrategy && <span className="text-slate-400 dark:text-slate-650 italic">Terminal output is currently empty. Run client strategist.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Regulatory Simulator Chat */}
        {activeTab === 'simulator' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages box */}
            <div className="flex-1 overflow-y-auto bg-[#F8FAFC]/50 dark:bg-slate-950/20 border border-[#E2E8F0] dark:border-slate-800 rounded-t-sm p-4 space-y-4 min-h-0">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-start space-x-3.5 max-w-2xl ${
                      msg.role === 'user' ? 'ml-auto justify-end' : ''
                    }`}
                  >
                    {msg.role !== 'user' && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#2563EB] text-white font-bold shrink-0 shadow shadow-blue-500/10">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`border p-3.5 text-[10px] leading-relaxed rounded-sm ${
                      msg.role === 'user'
                        ? 'bg-[#FFFFFF] dark:bg-[#1E293B] border-[#2563EB]/25 text-[#0F172A] dark:text-slate-200'
                        : 'bg-[#FFFFFF] dark:bg-slate-950/60 border-[#E2E8F0] dark:border-slate-900 text-[#64748B] dark:text-slate-350'
                    }`}>
                      <div className="whitespace-pre-wrap font-sans relative">
                        {msg.content || (
                          <div className="flex items-center space-x-1.5 text-slate-500">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#2563EB] dark:text-[#3B82F6]" />
                            <span>Computing capital adequacy impacts...</span>
                          </div>
                        )}
                        {/* Blinking Cursor block on active stream */}
                        {msg.role === 'assistant' && !msg.content && isStreamingChat && (
                          <span className="inline-block h-3.5 w-1.5 bg-[#2563EB] dark:bg-[#3B82F6] ml-1 animate-pulse"></span>
                        )}
                        {msg.role === 'assistant' && msg.content && idx === messages.length - 1 && isStreamingChat && (
                          <span className="inline-block h-3.5 w-1.5 bg-[#2563EB] dark:bg-[#3B82F6] ml-1 animate-pulse"></span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Input & Presets */}
            <div className="shrink-0 bg-[#FFFFFF] dark:bg-slate-950 border border-t-0 border-[#E2E8F0] dark:border-slate-800 p-3.5 rounded-b-sm space-y-3">
              {/* Presets suggestions */}
              <div className="hidden sm:flex flex-wrap gap-1.5">
                {presetQueries.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendSimulatorQuery(q)}
                    disabled={isStreamingChat}
                    className="flex items-center space-x-1 rounded-sm bg-[#F8FAFC] dark:bg-slate-900 hover:bg-[#E2E8F0] dark:hover:bg-slate-800 border border-[#E2E8F0] dark:border-slate-800 px-2 py-1 text-[8px] font-bold text-[#64748B] dark:text-[#94A3B8] transition-all cursor-pointer text-left uppercase"
                  >
                    <HelpCircle className="h-3 w-3 text-slate-400" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>

              {/* Chat Input form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendSimulatorQuery(chatInput);
                }} 
                className="flex space-x-2"
              >
                <input
                  type="text"
                  placeholder="Query compliance weights (e.g. 25% risk weight hike CAR effects)..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isStreamingChat}
                  className="w-full terminal-input"
                />
                <button
                  type="submit"
                  disabled={isStreamingChat}
                  className="rounded-sm bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-800 px-4 text-white flex items-center justify-center cursor-pointer shadow-md"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
