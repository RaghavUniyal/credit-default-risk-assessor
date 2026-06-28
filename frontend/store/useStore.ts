import { create } from 'zustand';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'analyst' | 'risk_officer' | 'admin';
  created_at: string;
}

interface AppState {
  // Auth state
  user: any | null;
  profile: UserProfile | null;
  authLoading: boolean;
  setAuth: (user: any, profile: UserProfile | null) => void;
  clearAuth: () => void;
  setAuthLoading: (loading: boolean) => void;

  // Search & Navigation state
  selectedCustomerId: string | null;
  searchQuery: string;
  setSelectedCustomerId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;

  // Global settings/notifications
  activeBatchJobId: string | null;
  setActiveBatchJobId: (jobId: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth defaults
  user: null,
  profile: null,
  authLoading: true,
  setAuth: (user, profile) => set({ user, profile, authLoading: false }),
  clearAuth: () => set({ user: null, profile: null, authLoading: false, selectedCustomerId: null }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  // Search defaults
  selectedCustomerId: null,
  searchQuery: '',
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Ingestion tracking
  activeBatchJobId: null,
  setActiveBatchJobId: (jobId) => set({ activeBatchJobId: jobId }),
}));
