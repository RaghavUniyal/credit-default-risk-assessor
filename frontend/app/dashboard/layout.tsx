'use client';

import { useStore } from '@/store/useStore';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
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
  Lock
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, clearAuth, setSearchQuery, searchQuery } = useStore();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearAuth();
    router.replace('/login');
  };

  const navLinks = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customer 360', href: '/dashboard/customer-360', icon: UsersRound },
    { name: 'Portfolio Upload', href: '/dashboard/portfolio', icon: DatabaseBackup },
    { name: 'Collections & Simulator', href: '/dashboard/collections', icon: BrainCircuit },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 md:flex-col shrink-0 border-r border-slate-900 bg-slate-950/80 backdrop-blur-xl">
        {/* Brand Logo */}
        <div className="flex h-16 items-center px-6 border-b border-slate-900 space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20">
            <span className="text-xs">CR</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider uppercase text-white">Risk Assessor</h1>
            <p className="text-[9px] tracking-widest text-emerald-400 font-semibold uppercase">Command Center</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center space-x-3 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner' 
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Status Profile */}
        <div className="border-t border-slate-900 p-4 bg-slate-950/60">
          <div className="flex items-center space-x-3.5 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-slate-400">
              <UserCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate leading-tight">
                {profile?.full_name || 'Risk Analyst'}
              </p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-emerald-400 border border-emerald-500/15 uppercase tracking-wide mt-0.5">
                {profile?.role === 'risk_officer' ? 'Risk Officer' : 'Analyst'}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900/20 border border-slate-800 py-2 text-xs font-semibold text-slate-400 transition-all uppercase cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/20 via-slate-950 to-slate-950">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-900 px-6 backdrop-blur-md bg-slate-950/30">
          {/* Header Left (Search bar / Title) */}
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Global Search (e.g. Customer ID IND100054)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-slate-900/60 border border-slate-800/80 pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Header Right */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent hover:border-slate-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Compliance Badge */}
            <div className="hidden sm:flex items-center space-x-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              <Lock className="h-3 w-3" />
              <span>RLS Secured</span>
            </div>
          </div>
        </header>

        {/* Content Box */}
        <main className="flex-1 overflow-y-auto p-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
