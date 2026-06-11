import { create } from 'zustand';

export type UserRole = 'user' | 'trainer' | 'admin';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  gender?: string;
  age?: number;
  height?: number;
  current_weight?: number;
  goal_weight?: number;
  goal?: string;
  activity_level?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user: User) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
  updateProfile: (data: Partial<User>) => set((state) => ({
    user: state.user ? { ...state.user, ...data } : null,
  })),
}));