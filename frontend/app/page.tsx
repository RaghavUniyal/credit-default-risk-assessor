'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';

export default function HomePage() {
  const router = useRouter();
  const { user, authLoading } = useStore();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, authLoading, router]);

  // Loading skeleton while redirects resolve
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 font-sans">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-t-emerald-500 border-r-transparent border-b-emerald-600 border-l-transparent"></div>
        <div className="absolute h-12 w-12 animate-pulse rounded-full border border-emerald-950 bg-emerald-900/20"></div>
        <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">PD</span>
      </div>
    </div>
  );
}
