'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-color)]">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-7 w-7 animate-spin rounded-sm border-2 border-t-[var(--brand-color)] border-r-transparent border-b-[var(--brand-color)] border-l-transparent"></div>
        <span className="text-xs font-semibold tracking-wider text-[var(--text-secondary)]">Redirecting to dashboard...</span>
      </div>
    </div>
  );
}
