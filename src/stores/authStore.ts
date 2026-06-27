// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/firebase/auth.service';
import { firebaseUtils } from '@/lib/firebase';
import type { User } from '@/types/models';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;
  errorCode: string | null;
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<User>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  updateEmail: (newEmail: string, password: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  getDashboardPath: () => string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      initialized: false,
      error: null,
      errorCode: null,
      isAuthenticated: false,

      initialize: async () => {
        // Prevent multiple initializations
        if (get().initialized) {
          console.log('Auth already initialized');
          return;
        }
        
        set({ isLoading: true, error: null, errorCode: null });
        
        try {
          // Listen to auth state changes
          const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
            try {
              if (firebaseUser) {
                console.log('Auth state changed: user logged in', firebaseUser.uid);
                
                // Try to get user from Firestore
                let userData = await authService.getUser(firebaseUser.uid);
                
                // If user exists in Auth but not in Firestore, create Firestore document
                if (!userData) {
                  console.log('User exists in Auth but not in Firestore, creating document...');
                  userData = await authService.ensureUserDocument(firebaseUser.uid);
                }
                
                if (userData) {
                  // Set user in store
                  set({ 
                    user: userData, 
                    isLoading: false, 
                    initialized: true,
                    isAuthenticated: true,
                    error: null,
                    errorCode: null,
                  });
                  
                  // Set user ID for analytics
                  firebaseUtils.setUserId(firebaseUser.uid);
                  
                  console.log('User authenticated:', userData.email, 'Role:', userData.role);
                } else {
                  // Something went wrong, sign out
                  console.warn('Could not get user data, signing out...');
                  await authService.signOut();
                  set({ 
                    user: null, 
                    isLoading: false, 
                    initialized: true,
                    isAuthenticated: false,
                    error: 'Could not load user profile',
                    errorCode: 'auth/user-data-error',
                  });
                }
              } else {
                console.log('Auth state changed: user logged out');
                set({ 
                  user: null, 
                  isLoading: false, 
                  initialized: true,
                  isAuthenticated: false,
                  error: null,
                  errorCode: null,
                });
              }
            } catch (error: any) {
              console.error('Error handling auth state change:', error);
              set({ 
                error: error.message || 'Failed to handle auth state change',
                errorCode: error.code || 'auth/state-change-error',
                isLoading: false,
                initialized: true,
                isAuthenticated: false,
              });
            }
          });

          // Store unsubscribe function for cleanup
          (window as any).__AUTH_UNSUBSCRIBE = unsubscribe;
          
        } catch (error: any) {
          console.error('Auth initialization error:', error);
          set({ 
            error: error.message || 'Failed to initialize auth',
            errorCode: error.code || 'auth/init-error',
            isLoading: false,
            initialized: true,
            isAuthenticated: false,
          });
        }
      },

      signIn: async (email: string, password: string): Promise<User> => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          const user = await authService.signIn(email, password);
          set({ 
            user, 
            isLoading: false, 
            isAuthenticated: true,
            error: null,
            errorCode: null,
          });
          
          // Set user ID for analytics
          firebaseUtils.setUserId(user.uid);
          
          // Log successful login
          firebaseUtils.logEvent('login_success', {
            role: user.role,
            method: 'email',
          });
          
          console.log('User signed in:', user.email);
          return user;
        } catch (error: any) {
          console.error('Sign in error:', error);
          
          // Preserve the error code and message from the service
          const errorCode = error.code || 'auth/unknown';
          let errorMessage = error.message || 'Failed to sign in';
          
          // Map error codes to user-friendly messages if not already mapped
          if (errorCode === 'auth/user-not-found') {
            errorMessage = 'No account found with this email address';
          } else if (errorCode === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
          } else if (errorCode === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
          } else if (errorCode === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address';
          } else if (errorCode === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled. Please contact support.';
          } else if (errorCode === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
          }
          
          set({ 
            error: errorMessage,
            errorCode: errorCode,
            isLoading: false,
            isAuthenticated: false,
          });
          
          // Throw with both code and message for the UI to handle
          throw { code: errorCode, message: errorMessage };
        }
      },

      signUp: async (email: string, password: string, userData: Partial<User>): Promise<User> => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          const user = await authService.signUp(email, password, userData);
          set({ 
            user, 
            isLoading: false,
            isAuthenticated: true,
            error: null,
            errorCode: null,
          });
          
          // Set user ID for analytics
          firebaseUtils.setUserId(user.uid);
          
          // Log successful registration
          firebaseUtils.logEvent('sign_up_success', {
            role: user.role,
            method: 'email',
          });
          
          console.log('User signed up:', user.email);
          return user;
        } catch (error: any) {
          console.error('Sign up error:', error);
          
          // Preserve the error code and message
          const errorCode = error.code || 'auth/unknown';
          let errorMessage = error.message || 'Failed to create account';
          
          // Map error codes to user-friendly messages if not already mapped
          if (errorCode === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please sign in instead.';
          } else if (errorCode === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address';
          } else if (errorCode === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use a stronger password.';
          } else if (errorCode === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
          }
          
          set({ 
            error: errorMessage,
            errorCode: errorCode,
            isLoading: false,
            isAuthenticated: false,
          });
          
          // Throw with both code and message
          throw { code: errorCode, message: errorMessage };
        }
      },

      signOut: async () => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          await authService.signOut();
          
          // Clear any persisted data
          localStorage.removeItem('auth-storage');
          
          set({ 
            user: null, 
            isLoading: false,
            isAuthenticated: false,
            error: null,
            errorCode: null,
          });
          
          // Clear analytics user
          firebaseUtils.setUserId('');
          
          console.log('User signed out');
        } catch (error: any) {
          console.error('Sign out error:', error);
          set({ 
            error: error.message || 'Failed to sign out',
            errorCode: error.code || 'auth/signout-error',
            isLoading: false,
          });
          throw error;
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          await authService.resetPassword(email);
          set({ isLoading: false });
          firebaseUtils.logEvent('password_reset_requested', { email });
        } catch (error: any) {
          console.error('Reset password error:', error);
          const errorCode = error.code || 'auth/unknown';
          const errorMessage = errorCode === 'auth/user-not-found' 
            ? 'No account found with this email address' 
            : error.message || 'Failed to send reset email';
          set({ 
            error: errorMessage,
            errorCode: errorCode,
            isLoading: false 
          });
          throw { code: errorCode, message: errorMessage };
        }
      },

      updateProfile: async (data: Partial<User>) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');
        
        set({ isLoading: true, error: null, errorCode: null });
        try {
          await authService.updateProfile(user.uid, data);
          set({ 
            user: { ...user, ...data },
            isLoading: false,
          });
          firebaseUtils.logEvent('profile_updated');
        } catch (error: any) {
          console.error('Update profile error:', error);
          set({ 
            error: error.message || 'Failed to update profile',
            errorCode: error.code || 'auth/profile-update-error',
            isLoading: false 
          });
          throw error;
        }
      },

      updateEmail: async (newEmail: string, password: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          await authService.updateEmail(newEmail, password);
          const { user } = get();
          if (user) {
            set({ 
              user: { ...user, email: newEmail },
              isLoading: false,
            });
            firebaseUtils.logEvent('email_updated');
          }
        } catch (error: any) {
          console.error('Update email error:', error);
          set({ 
            error: error.message || 'Failed to update email',
            errorCode: error.code || 'auth/email-update-error',
            isLoading: false 
          });
          throw error;
        }
      },

      updatePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          await authService.updatePassword(currentPassword, newPassword);
          set({ isLoading: false });
          firebaseUtils.logEvent('password_updated');
        } catch (error: any) {
          console.error('Update password error:', error);
          set({ 
            error: error.message || 'Failed to update password',
            errorCode: error.code || 'auth/password-update-error',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteAccount: async (password: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        try {
          await authService.deleteAccount(password);
          set({ 
            user: null, 
            isLoading: false,
            isAuthenticated: false,
            error: null,
            errorCode: null,
          });
          firebaseUtils.logEvent('account_deleted');
        } catch (error: any) {
          console.error('Delete account error:', error);
          set({ 
            error: error.message || 'Failed to delete account',
            errorCode: error.code || 'auth/account-delete-error',
            isLoading: false 
          });
          throw error;
        }
      },

      refreshUser: async () => {
        const { user } = get();
        if (!user) return;
        
        try {
          const freshUser = await authService.getUser(user.uid);
          if (freshUser) {
            set({ user: freshUser, error: null, errorCode: null });
          }
        } catch (error: any) {
          console.error('Refresh user error:', error);
          set({ 
            error: error.message || 'Failed to refresh user data',
            errorCode: error.code || 'auth/refresh-error',
          });
        }
      },

      clearError: () => {
        set({ error: null, errorCode: null });
      },

      getDashboardPath: () => {
        const { user } = get();
        if (!user) return '/login';
        
        switch (user.role) {
          case 'customer': return '/customer/dashboard';
          case 'technician': return '/technician/dashboard';
          case 'guard': return '/guard/dashboard';
          case 'partner': return '/partner/dashboard';
          case 'admin': return '/operations/dashboard';
          case 'sales': return '/customer/dashboard';
          default: return '/customer/dashboard';
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        initialized: state.initialized,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        console.log('Auth store rehydrated');
        return (state) => {
          if (state?.user) {
            console.log('User from storage:', state.user.email);
          }
        };
      },
    }
  )
);

// Helper hooks - exported as named exports
export const useCurrentUser = () => {
  return useAuthStore((state) => state.user);
};

export const useIsAuthenticated = () => {
  return useAuthStore((state) => state.isAuthenticated);
};

export const useUserRole = () => {
  return useAuthStore((state) => state.user?.role || null);
};

export const useAuthError = () => {
  return useAuthStore((state) => state.error);
};

export const useAuthErrorCode = () => {
  return useAuthStore((state) => state.errorCode);
};

// Also export as default for convenience
export default useAuthStore;