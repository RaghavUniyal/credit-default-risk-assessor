'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { 
  BrainCircuit, 
  Send, 
  HelpCircle, 
  RefreshCw, 
  TrendingUp, 
  ShieldAlert,
  ShieldCheck,
  User,
  ArrowRight,
  Bot
} from 'lucide-react';

export default function CollectionsPage() {
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
      content: "Welcome to the **Regulatory Simulation Console**. I am pre-injected with the latest **Reserve Bank of India (RBI)** risk weight guidelines and your aggregated portfolio statistics. Ask me compliance or capital impact questions."
    }
  ]);
  const [isStreamingChat, setIsStreamingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat window
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreamingChat]);

  // Sync selectedCustomerId from store
  useEffect(() => {
    if (selectedCustomerId) {
      setSelectedId(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // Fetch list of high-risk customers for selection dropdown
  const { data: highRiskCustomers } = useQuery({
    queryKey: ['highRiskList', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Fetch high risk customers from predictions
      const { data: predData } = await supabase
        .from('predictions')
        .select('customer_id, risk_score, verdict')
        .eq('user_id', user.id)
        .eq('verdict', 'High Risk')
        .order('risk_score', { ascending: false })
        .limit(20);

      if (!predData || predData.length === 0) return [];
      
      const ids = predData.map(p => p.customer_id);
      
      // Fetch names from customers
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

  // 1. Run AI Collections Strategist Fetch Stream
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

  // 2. Run Regulatory Simulator Chat Fetch Stream
  const handleSendSimulatorQuery = async (queryText: string) => {
    const textToSend = queryText || chatInput;
    if (!textToSend.trim() || isStreamingChat) return;

    setChatInput('');
    // Append user message
    setMessages(prev => [...prev, { role: 'user', content: textToSend }]);
    setIsStreamingChat(true);

    // Placeholder for stream response
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
            // Update the last message in state
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
    <div className="space-y-6 text-slate-100 h-[calc(100vh-8rem)] flex flex-col">
      {/* Title */}
      <div className="shrink-0">
        <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Collections & Compliance Command</h2>
        <p className="text-xs text-slate-400">Stream dynamic collections advice and run capital weight "What-If" regulatory simulation chats.</p>
      </div>

      {/* Tabs Menu */}
      <div className="shrink-0 flex space-x-2 border-b border-slate-900 pb-2">
        <button
          onClick={() => setActiveTab('strategist')}
          className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
            activeTab === 'strategist'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-inner'
              : 'text-slate-400 border-transparent hover:bg-slate-900/60'
          }`}
        >
          Collections Strategist
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-inner'
              : 'text-slate-400 border-transparent hover:bg-slate-900/60'
          }`}
        >
          Regulatory Simulator Chat
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        
        {/* Tab 1: Collections Strategist */}
        {activeTab === 'strategist' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
            {/* Left: Input Selection */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel flex flex-col space-y-4 overflow-y-auto max-h-full">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select High-Risk Debtor</h3>
              
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Cardholder ID</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:outline-none"
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
                <div className="rounded-lg bg-slate-950 border border-slate-900 p-4 space-y-3.5 text-xs">
                  <div className="flex items-center space-x-2 pb-2 border-b border-slate-900">
                    <User className="h-4 w-4 text-emerald-400" />
                    <span className="font-bold text-slate-200">{selectedCustomerDetails.customer_name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">CIBIL</span>
                      <span className="text-slate-300 font-semibold">{selectedCustomerDetails.cibil_score}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Utilization</span>
                      <span className="text-slate-300 font-semibold">{selectedCustomerDetails.current_utilization_pct}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Credit Limit</span>
                      <span className="text-slate-300 font-semibold">INR {selectedCustomerDetails.total_credit_limit.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Spend Avg</span>
                      <span className="text-slate-300 font-semibold">INR {selectedCustomerDetails.avg_monthly_spend.toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRunStrategy}
                    disabled={isStreamingStrategy}
                    className="mt-3 flex w-full items-center justify-between rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 px-4 py-2.5 text-xs font-bold text-slate-950 uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    <span>Run Strategist</span>
                    <ArrowRight className="h-4 w-4 text-slate-950" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-slate-900 text-slate-500 text-xs">
                  <ShieldAlert className="h-8 w-8 text-slate-700 mb-2" />
                  <span>Choose a customer to analyze risk and construct action strategies.</span>
                </div>
              )}
            </div>

            {/* Right: Output Strategy text stream */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-900 p-5 glass-panel lg:col-span-2 flex flex-col overflow-hidden max-h-full">
              <h3 className="shrink-0 text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <BrainCircuit className="h-4.5 w-4.5 text-emerald-400" />
                <span>Actionable Strategy Output</span>
              </h3>
              
              <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-900 rounded-lg p-5 font-mono text-xs text-slate-300 leading-relaxed max-h-full">
                {isStreamingStrategy && !strategyText && (
                  <div className="flex space-x-2 items-center text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                    <span>Connecting GenAI collections console...</span>
                  </div>
                )}
                {strategyText ? (
                  <div className="space-y-4 whitespace-pre-wrap">
                    {strategyText}
                  </div>
                ) : (
                  !isStreamingStrategy && <span className="text-slate-600 italic">Strategy report is empty. Select a customer and click Run.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Regulatory Simulator Chat */}
        {activeTab === 'simulator' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages box */}
            <div className="flex-1 overflow-y-auto bg-slate-900/10 border border-slate-900 rounded-t-xl p-5 space-y-4 min-h-0">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start space-x-3.5 max-w-3xl ${
                    msg.role === 'user' ? 'ml-auto justify-end' : ''
                  }`}
                >
                  {msg.role !== 'user' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold shrink-0 shadow shadow-emerald-500/10">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`rounded-xl border p-4 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 border-slate-800 text-slate-200 shadow-md'
                      : 'bg-slate-950/60 border-slate-900 text-slate-300'
                  }`}>
                    {/* Render markdown helpers simply */}
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content || (
                        <div className="flex items-center space-x-2 text-slate-500">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                          <span>Generating compliance report...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input & Presets Section */}
            <div className="shrink-0 bg-slate-950/80 border border-t-0 border-slate-900 p-4 rounded-b-xl space-y-3.5">
              {/* Presets suggestions */}
              <div className="hidden sm:flex flex-wrap gap-2">
                {presetQueries.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendSimulatorQuery(q)}
                    disabled={isStreamingChat}
                    className="flex items-center space-x-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer text-left"
                  >
                    <HelpCircle className="h-3 w-3 text-slate-500" />
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
                className="flex space-x-3"
              >
                <input
                  type="text"
                  placeholder="Ask compliance simulator (e.g. capital weight ratios or stress exposures)..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isStreamingChat}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isStreamingChat}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 px-5 text-slate-950 flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/10"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
