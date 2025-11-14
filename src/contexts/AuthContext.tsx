

import React, { createContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types.ts';
import { login as apiLogin, register as apiRegister, loginWithGoogle as apiLoginWithGoogle, completeUserProfile, logActivity, getUsers, getCurrentUser } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (userData: Partial<User>) => Promise<void>;
  logout: () => void;
  loading: boolean;
  loginWithGoogle: (idToken: string) => Promise<{ user: User, isNew: boolean }>;
  updateUser: (user: User) => Promise<void>;
  switchUserRole: (role: UserRole) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_MOCK_USERS: { [key in UserRole]: User } = {
  [UserRole.ADMIN]: { 
    id: '1', name: 'Admin User', email: 'admin@sims.com', role: UserRole.ADMIN, avatar: 'https://picsum.photos/seed/admin/200',
    firstName: 'Admin', lastName: 'User', studentId: 'ADMIN-001', teamId: 't1', password: 'password'
  },
  [UserRole.OFFICER]: { 
    id: '2', name: 'Officer Jones', email: 'officer@sims.com', role: UserRole.OFFICER, avatar: 'https://picsum.photos/seed/officer/200',
    firstName: 'Jessica', lastName: 'Jones', studentId: 'OFF-002', teamId: 't2', interestedEvents: ['Joker Flag: Chant (Wave 1)'], password: 'password'
  },
  [UserRole.TEAM_LEAD]: { 
    id: '4', name: 'Lead Leo', email: 'lead@sims.com', role: UserRole.TEAM_LEAD, avatar: 'https://picsum.photos/seed/lead/200', teamId: 't1',
    firstName: 'Leo', lastName: 'Leaderson', studentId: '2022-1100', yearLevel: '3rd Year', section: 'International',
    interestedEvents: ['Basketball', 'Debate', 'Larong Lahi: Tug of War'],
    bio: 'Competitive and always aiming for the gold!', password: 'password'
  },
  [UserRole.USER]: { 
    id: '3', name: 'Regular Player', email: 'user@sims.com', role: UserRole.USER, avatar: 'https://picsum.photos/seed/user/200', teamId: 't1',
    firstName: 'John', lastName: 'Doe', studentId: '2023-1005', yearLevel: '2nd Year', section: 'Section 1',
    interestedEvents: ['Hackathon', 'Essay Writing (English)', 'General Quiz'],
    bio: 'Loves coding and chess.', password: 'password'
  }, 
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as User;
        setUser(parsed);

        // Refresh the user from the server (or mock API) so we get up-to-date
        // profile, role, and team membership. This enables cross-device sync
        // when a real backend is configured.
        (async () => {
          try {
            const refreshed = await getCurrentUser();
            if (refreshed) {
              setUser(refreshed);
              localStorage.setItem('user', JSON.stringify(refreshed));
            }
          } catch (err) {
            // fallback to scanning all users if getCurrentUser isn't available or fails
            try {
              const all = await getUsers();
              const fresh = all.find(u => u.id === parsed.id);
              if (fresh) {
                setUser(fresh);
                localStorage.setItem('user', JSON.stringify(fresh));
              }
            } catch (err2) {
              console.warn('Could not refresh user from server:', err2);
            }
          }
        })();
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const userData = await apiLogin(email, pass);
      logActivity(userData.id, 'logged in');
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const register = async (userData: Partial<User>) => {
      setLoading(true);
      try {
          const newUser = await apiRegister(userData);
          setUser(newUser);
          localStorage.setItem('user', JSON.stringify(newUser));
      } catch (error) {
          console.error("Registration failed", error);
          throw error;
      } finally {
          setLoading(false);
      }
  }

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true);
    try {
        const { user: userData, isNew } = await apiLoginWithGoogle({ idToken });
        if (!isNew) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
        }
        return { user: userData, isNew };
    } catch (error) {
        console.error("Google Login failed", error);
        throw error;
    } finally {
        setLoading(false);
    }
  };

  const updateUser = async (updatedUserData: User) => {
      setLoading(true);
      try {
          const finalUser = await completeUserProfile(updatedUserData);
          setUser(finalUser);
          localStorage.setItem('user', JSON.stringify(finalUser));
      } catch (error) {
          console.error("Failed to update user profile", error);
          throw error;
      } finally {
          setLoading(false);
      }
  }

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const switchUserRole = (role: UserRole) => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('switchUserRole is a development-only feature.');
      return;
    }
    
    const mockUser = DEV_MOCK_USERS[role];
    if (mockUser) {
        setUser(mockUser);
        localStorage.setItem('user', JSON.stringify(mockUser));
    } else {
        console.warn(`No mock user found for role: ${role}`);
    }
  };

  const value = { user, login, register, logout, loading, switchUserRole, loginWithGoogle, updateUser };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};