'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setAuthLoading, authLoading } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setAuthLoading(true);
    
    // Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user);
      } else {
        // Fallback: Check local mock session
        const mockSessionStr = localStorage.getItem('mock_session');
        if (mockSessionStr) {
          try {
            const { user, profile } = JSON.parse(mockSessionStr);
            setAuth(user, profile);
            setAuthLoading(false);
            return;
          } catch (e) {
            console.error("Failed to parse mock session", e);
          }
        }

        clearAuth();
        setAuthLoading(false);
        if (pathname.startsWith('/dashboard')) {
          router.replace('/');
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          fetchProfile(session.user);
          if (pathname === '/') {
            router.replace('/dashboard');
          }
        } else {
          // Fallback: Check local mock session
          const mockSessionStr = localStorage.getItem('mock_session');
          if (mockSessionStr) {
            try {
              const { user, profile } = JSON.parse(mockSessionStr);
              setAuth(user, profile);
              setAuthLoading(false);
              return;
            } catch (e) {
              console.error("Failed to parse mock session", e);
            }
          }

          clearAuth();
          setAuthLoading(false);
          if (pathname.startsWith('/dashboard')) {
            router.replace('/');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [pathname, router, setAuth, clearAuth, setAuthLoading]);

  const fetchProfile = async (user: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
        
      if (data) {
        setAuth(user, data);
      } else {
        // Fallback profile if profile trigger not created or delayed
        const fallbackProfile = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || 'Risk Analyst',
          role: (user.user_metadata?.role as any) || 'analyst',
          created_at: new Date().toISOString()
        };
        setAuth(user, fallbackProfile);
      }
    } catch (err) {
      console.error("Failed to fetch user profile", err);
      // Fallback
      setAuth(user, {
        id: user.id,
        email: user.email || '',
        full_name: 'Risk Analyst',
        role: 'analyst',
        created_at: new Date().toISOString()
      });
    }
  };

  // If loading session state, show full screen premium spinner/loader
  if (authLoading && pathname !== '/login') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 font-sans">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-t-emerald-500 border-r-transparent border-b-emerald-600 border-l-transparent"></div>
          <div className="absolute h-12 w-12 animate-pulse rounded-full border border-emerald-950 bg-emerald-900/20"></div>
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">PD</span>
        </div>
        <p className="mt-4 text-xs font-semibold tracking-widest text-slate-400 uppercase animate-pulse">
          Authenticating Session...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
