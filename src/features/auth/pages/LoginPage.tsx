// src/features/auth/pages/LoginPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Mail, Lock, Eye, EyeOff, Shield, ArrowRight, 
  AlertCircle, CheckCircle, Loader2, Fingerprint,
  Users, User, Briefcase, ShieldCheck, Building, UserCog
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { authService } from '@/services/firebase/auth.service';

// Demo user accounts configuration
const DEMO_ACCOUNTS = [
  {
    role: 'Customer',
    email: 'demo.customer@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'John Mensah',
    icon: User,
    color: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
    borderColor: 'border-blue-500/30',
  },
  {
    role: 'Technician',
    email: 'demo.technician@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Kwame Ansah',
    icon: UserCog,
    color: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
    borderColor: 'border-green-500/30',
  },
  {
    role: 'Guard',
    email: 'demo.guard@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Ama Boateng',
    icon: ShieldCheck,
    color: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-600',
    borderColor: 'border-orange-500/30',
  },
  {
    role: 'Partner',
    email: 'demo.partner@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Kofi Asare',
    icon: Building,
    color: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
    borderColor: 'border-purple-500/30',
  },
  {
    role: 'Admin',
    email: 'demo.admin@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Admin User',
    icon: Shield,
    color: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
    borderColor: 'border-red-500/30',
  },
  {
    role: 'Sales',
    email: 'demo.sales@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Esi Mensah',
    icon: Briefcase,
    color: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
    borderColor: 'border-yellow-500/30',
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user, isLoading: authLoading } = useAuthStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Check for redirect message from registration
  useEffect(() => {
    const state = location.state as { message?: string };
    if (state?.message) {
      setSuccessMessage(state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      const redirectPath = getDashboardPath(user.role);
      navigate(redirectPath);
    }
  }, [user, authLoading, navigate]);

  const getDashboardPath = (role: string) => {
    switch (role) {
      case 'customer': return '/customer/dashboard';
      case 'technician': return '/technician/dashboard';
      case 'guard': return '/guard/dashboard';
      case 'partner': return '/partner/dashboard';
      case 'admin': return '/operations/dashboard';
      case 'sales': return '/customer/dashboard';
      default: return '/dashboard';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const userData = await signIn(formData.email, formData.password);
      
      firebaseUtils.logEvent('login', {
        method: 'email',
        role: userData.role,
        remember: rememberMe,
      });

      setSuccessMessage('Welcome back! Redirecting...');

      setTimeout(() => {
        const redirectPath = getDashboardPath(userData.role);
        navigate(redirectPath);
      }, 1500);

    } catch (err: any) {
      console.error('Login error:', err);
      
      // Handle error based on error code
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      if (errorCode === 'auth/user-not-found' || errorMessage === 'No account found with this email address') {
        setError('No account found with this email address');
      } else if (errorCode === 'auth/wrong-password' || errorMessage === 'Incorrect password. Please try again.') {
        setError('Incorrect password. Please try again.');
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else if (errorCode === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else if (errorCode === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(errorMessage || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (email: string, password: string, role: string) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      // Try to sign in first
      const userData = await signIn(email, password);
      
      firebaseUtils.logEvent('demo_login', { role });
      
      setSuccessMessage(`Logged in as ${role}! Redirecting...`);
      
      setTimeout(() => {
        const redirectPath = getDashboardPath(role);
        navigate(redirectPath);
      }, 1000);
      
    } catch (err: any) {
      console.error('Demo login error:', err);
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      // If user doesn't exist, try to create them
      if (errorCode === 'auth/user-not-found' || 
          errorMessage === 'No account found with this email address') {
        try {
          // Find the demo account details
          const demoAccount = DEMO_ACCOUNTS.find(a => a.email === email);
          
          // Create the demo user
          await signUp(email, password, {
            displayName: demoAccount?.displayName || role,
            phoneNumber: '+233 24 123 4567',
            role: role as any,
            company: `${role} Demo Company`,
          });
          
          // Wait a moment for Firestore to propagate
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Now sign in - use a fresh sign-in attempt
          try {
            const userData = await signIn(email, password);
            
            firebaseUtils.logEvent('demo_account_created', { role });
            
            setSuccessMessage(`Demo ${role} account created! Redirecting...`);
            
            setTimeout(() => {
              const redirectPath = getDashboardPath(role);
              navigate(redirectPath);
            }, 1000);
          } catch (signInError: any) {
            console.error('Sign in after creation error:', signInError);
            
            // If still not found, try one more time with a delay
            if (signInError.code === 'auth/user-not-found') {
              await new Promise(resolve => setTimeout(resolve, 2000));
              const userData = await signIn(email, password);
              setSuccessMessage(`Logged in as ${role}! Redirecting...`);
              setTimeout(() => {
                const redirectPath = getDashboardPath(role);
                navigate(redirectPath);
              }, 1000);
            } else {
              throw signInError;
            }
          }
          
        } catch (createError: any) {
          console.error('Demo account creation error:', createError);
          
          const createErrorCode = createError.code || '';
          const createErrorMessage = createError.message || '';
          
          // If user already exists in Auth but not Firestore, try to sign in again
          if (createErrorCode === 'auth/email-already-in-use' || 
              createErrorMessage === 'auth/email-already-in-use' ||
              createErrorMessage === 'This email is already registered. Please sign in instead.') {
            try {
              // Wait a moment and try to sign in one more time
              await new Promise(resolve => setTimeout(resolve, 1500));
              const userData = await signIn(email, password);
              setSuccessMessage(`Logged in as ${role}! Redirecting...`);
              
              setTimeout(() => {
                const redirectPath = getDashboardPath(role);
                navigate(redirectPath);
              }, 1000);
            } catch (finalError: any) {
              console.error('Final sign in attempt failed:', finalError);
              setError('Account exists but there was an issue. Please try again.');
            }
          } else {
            setError(createErrorMessage || 'Failed to create demo account. Please try again.');
          }
        }
      } else {
        setError(errorMessage || 'Demo login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await authService.resetPassword(formData.email);
      setResetEmailSent(true);
      setSuccessMessage('Password reset email sent! Check your inbox.');
      firebaseUtils.logEvent('password_reset_requested', { email: formData.email });
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      if (errorCode === 'auth/user-not-found' || 
          errorMessage === 'No account found with this email address' ||
          errorMessage === 'auth/user-not-found') {
        setError('No account found with this email address');
      } else {
        setError(errorMessage || 'Failed to send reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if user is logged in - redirect to dashboard
  if (user && !authLoading) {
    const path = getDashboardPath(user.role);
    navigate(path);
    return null;
  }

  if (resetPasswordMode) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white font-sans antialiased selection:bg-lime-400 selection:text-black overflow-x-hidden flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-lime-400/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-emerald-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md w-full">
          <div className="flex justify-center">
            <Link to="/" className="group">
              <div className="relative">
                <img 
                  src="/favicon.svg" 
                  alt="GRID Security Logo" 
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-lg shadow-lime-400/20 group-hover:shadow-lime-400/30 transition-all duration-300"
                />
                <div className="absolute -inset-1 bg-lime-400/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </Link>
          </div>
          <h2 className="mt-5 sm:mt-6 text-center text-2xl sm:text-3xl font-bold tracking-tighter text-white uppercase">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-xs text-neutral-400">
            Enter your email to receive a password reset link
          </p>
        </div>

        <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md w-full relative z-10">
          <Card className="bg-[#161616] border border-neutral-800 rounded-2xl shadow-2xl shadow-black/50">
            <CardContent className="py-6 sm:py-8 px-4 sm:px-6 lg:px-10">
              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-400/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Check Your Email</h3>
                  <p className="text-sm text-neutral-400">
                    We've sent a password reset link to <br />
                    <span className="text-lime-400 font-medium">{formData.email}</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Didn't receive the email? Check your spam folder or{' '}
                    <button
                      onClick={() => {
                        setResetEmailSent(false);
                      }}
                      className="text-lime-400 hover:text-lime-300 transition-colors"
                    >
                      try again
                    </button>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setResetPasswordMode(false)}
                    className="w-full bg-transparent border-neutral-700 text-white hover:bg-neutral-800"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50 transition-colors"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  {successMessage && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-emerald-400">{successMessage}</p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    loading={loading} 
                    fullWidth
                    className="bg-lime-400 text-black hover:bg-lime-300 text-xs font-bold uppercase tracking-widest rounded-lg py-2.5 h-auto"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setResetPasswordMode(false)}
                    className="w-full text-center text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white font-sans antialiased selection:bg-lime-400 selection:text-black overflow-x-hidden flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-lime-400/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-emerald-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md w-full">
        <div className="flex justify-center">
          <Link to="/" className="group">
            <div className="relative">
              <img 
                src="/favicon.svg" 
                alt="GRID Security Logo" 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-lg shadow-lime-400/20 group-hover:shadow-lime-400/30 transition-all duration-300"
              />
              <div className="absolute -inset-1 bg-lime-400/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </Link>
        </div>
        <h2 className="mt-5 sm:mt-6 text-center text-2xl sm:text-3xl font-bold tracking-tighter text-white uppercase">
          Sign in to GRID Security
        </h2>
        <p className="mt-2 text-center text-xs text-neutral-400">
          Secure access to your security dashboard
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md w-full relative z-10">
        <Card className="bg-[#161616] border border-neutral-800 rounded-2xl shadow-2xl shadow-black/50">
          <CardContent className="py-6 sm:py-8 px-4 sm:px-6 lg:px-10">
            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-400">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50 transition-colors"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50 transition-colors"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-neutral-500 hover:text-neutral-300 transition-colors" />
                    ) : (
                      <Eye className="w-4 h-4 text-neutral-500 hover:text-neutral-300 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 bg-neutral-900 border-neutral-700 rounded focus:ring-lime-400 focus:ring-offset-0 text-lime-400 cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-[10px] text-neutral-400 cursor-pointer">
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setResetPasswordMode(true)}
                  className="text-[10px] font-medium text-lime-400 hover:text-lime-300 transition-colors text-left"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Button */}
              <Button 
                type="submit" 
                loading={loading} 
                fullWidth
                disabled={loading}
                className="bg-lime-400 text-black hover:bg-lime-300 text-xs font-bold uppercase tracking-widest rounded-lg py-2.5 h-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Demo Accounts Section */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800/60" />
                </div>
                <div className="relative flex justify-center">
                  <button
                    onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                    className="px-3 py-1 bg-[#161616] text-[10px] text-neutral-400 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Users className="w-3 h-3" />
                    {showDemoAccounts ? 'Hide Demo Accounts' : 'Show Demo Accounts'}
                  </button>
                </div>
              </div>
              
              {showDemoAccounts && (
                <div className="mt-4 space-y-3">
                  <p className="text-[10px] text-neutral-500 text-center">
                    Click any role to instantly log in as a demo user
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_ACCOUNTS.map((account) => {
                      const Icon = account.icon;
                      return (
                        <button
                          key={account.role}
                          onClick={() => handleDemoLogin(account.email, account.password, account.role.toLowerCase())}
                          disabled={loading}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${account.borderColor} bg-neutral-900/30 hover:bg-neutral-800 transition-all text-left text-xs ${account.hoverColor} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <div className={`w-6 h-6 rounded-full ${account.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{account.role}</p>
                            <p className="text-[8px] text-neutral-400 truncate">{account.email}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[8px] text-neutral-500 text-center">
                    All demo accounts use password: <span className="text-lime-400 font-mono">Demo@123</span>
                  </p>
                </div>
              )}
            </div>

            {/* Register Link */}
            <div className="mt-6 text-center">
              <p className="text-[10px] text-neutral-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-lime-400 hover:text-lime-300 transition-colors font-medium">
                  Create one now
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}