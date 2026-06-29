'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  UsersRound, 
  DatabaseBackup, 
  BrainCircuit, 
  LogOut, 
  Sun, 
  Moon, 
  Search, 
  UserCircle2,
  Lock,
  X,
  Sparkles,
  Cpu
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, clearAuth, setSelectedCustomerId } = useStore();
  const { theme, toggleTheme } = useTheme();

  // Command Palette State
  const [isOpen, setIsOpen] = useState(false);
  const [cmdInput, setCmdInput] = useState('');

  // Handle Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    localStorage.removeItem('mock_session');
    await supabase.auth.signOut();
    clearAuth();
    router.replace('/');
  };

  // Auto session listener redirection
  useEffect(() => {
    const checkSession = async () => {
      const mockSession = localStorage.getItem('mock_session');
      if (mockSession) {
        const parsed = JSON.parse(mockSession);
        useStore.getState().setAuth(parsed.user, parsed.profile);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      }
    };
    checkSession();
  }, [router]);

  const handleCommandRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (cmdInput.trim()) {
      const targetId = cmdInput.trim().toUpperCase();
      setSelectedCustomerId(targetId);
      setIsOpen(false);
      setCmdInput('');
      router.push('/dashboard/customer-360');
    }
  };

  const navLinks = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customer 360', href: '/dashboard/customer-360', icon: UsersRound },
    { name: 'Portfolio Upload', href: '/dashboard/portfolio', icon: DatabaseBackup },
    { name: 'Collections & Simulator', href: '/dashboard/collections', icon: BrainCircuit },
  ];

  return (
    <div className="flex h-screen bg-white dark:bg-black text-[#0F172A] dark:text-[#F8FAFC] overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex md:w-60 md:flex-col shrink-0 border-r border-[#E2E8F0] dark:border-[#334155] bg-[#F4F6FA] dark:bg-[#0D0D0D]">
        {/* Brand Logo */}
        <div className="flex h-14 items-center px-4 border-b border-[#E2E8F0] dark:border-[#334155] space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#0066FF] dark:bg-[#3B82F6] text-white font-black shadow-md shadow-blue-500/10">
            <span className="text-xs tracking-tighter">CD</span>
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider uppercase text-[#0F172A] dark:text-white">Risk Assessor</h1>
            <p className="text-[10.5px] tracking-widest text-[#0066FF] dark:text-[#3B82F6] font-bold uppercase">B2B Command Center</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navLinks.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3.5 border px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 rounded-sm ${
                  active
                    ? 'bg-[#0066FF]/10 dark:bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border-[#0066FF]/20 dark:border-[#0066FF]/20'
                    : 'text-[#64748B] dark:text-[#94A3B8] border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Account Info Footer */}
        <div className="border-t border-[#E2E8F0] dark:border-[#334155] p-3 space-y-2 bg-[#E2E8F0]/30 dark:bg-[#0B0F19]/40">
          <div className="flex items-center space-x-2">
            <UserCircle2 className="h-7 w-7 text-[#64748B] dark:text-[#94A3B8]" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold truncate text-[#0F172A] dark:text-white">
                {profile?.full_name || 'Risk Manager'}
              </p>
              <p className="text-[10px] truncate text-[#64748B] dark:text-[#94A3B8] uppercase font-bold tracking-wider">
                {profile?.role?.replace('_', ' ') || 'analyst'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center space-x-1.5 rounded-sm border border-[#E2E8F0] dark:border-[#334155] hover:border-[#EF4444]/30 bg-white dark:bg-[#1E293B] hover:bg-rose-500/10 hover:text-rose-400 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] transition-all cursor-pointer"
          >
            <LogOut className="h-3 w-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-14 items-center justify-between px-6 border-b border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-black backdrop-blur-md z-10 shrink-0">
          {/* Cmd+K Search trigger input */}
          <div 
            onClick={() => setIsOpen(true)}
            className="flex items-center space-x-2.5 w-64 rounded-sm border border-[#E2E8F0] dark:border-[#334155] bg-[#F4F6FA] dark:bg-[#0D0D0D] px-3 py-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] cursor-pointer hover:border-[#0066FF] dark:hover:border-[#3B82F6] transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-xs font-semibold">Search Cardholder ID...</span>
            <kbd className="hidden sm:inline-block rounded bg-[#E2E8F0] dark:bg-[#1E293B] px-1.5 py-0.5 font-mono text-[9px] font-bold border border-slate-300 dark:border-slate-800 uppercase tracking-widest text-[#0F172A] dark:text-slate-400">
              Ctrl+K
            </kbd>
          </div>

          {/* Right Header items */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-sm border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A] p-4 lg:p-6 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Cmd+K Command Palette Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-[#0F172A]/70 backdrop-blur-xs"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative w-full max-w-lg rounded-sm border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] shadow-2xl p-4 mx-4"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E8F0] dark:border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0066FF] dark:text-[#3B82F6]">
                  Global Command Search
                </span>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#0F172A] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <form onSubmit={handleCommandRun} className="relative mt-3">
                <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-[#64748B] dark:text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Type Cardholder ID (e.g. IND100002) and hit Enter..."
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  className="w-full rounded-sm border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] pl-10 pr-4 py-2.5 text-xs text-[#0F172A] dark:text-white placeholder-[#64748B] dark:placeholder-[#64748B] focus:outline-none focus:border-[#0066FF] dark:focus:border-[#3B82F6]"
                  autoFocus
                />
              </form>

              <div className="mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center space-x-1 font-semibold uppercase">
                <Sparkles className="h-3.5 w-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                <span>Quick Tip: Enter customer ID sequence to jump directly to their 360 Risk timeline.</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
