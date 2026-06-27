// src/features/auth/pages/RegisterPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, Mail, Lock, Phone, Building, Shield, ArrowRight, 
  Eye, EyeOff, CheckCircle, XCircle, AlertCircle, 
  Loader2, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/firebase/auth.service';
import { firebaseUtils } from '@/lib/firebase';

// Password strength checker
const checkPasswordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
};

const getPasswordStrengthLabel = (score: number) => {
  if (score <= 1) return { label: 'Weak', color: 'text-red-400', bg: 'bg-red-400/20' };
  if (score <= 2) return { label: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-400/20' };
  if (score <= 3) return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-400/20' };
  if (score <= 4) return { label: 'Strong', color: 'text-green-400', bg: 'bg-green-400/20' };
  return { label: 'Very Strong', color: 'text-emerald-400', bg: 'bg-emerald-400/20' };
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, user, isLoading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    password: '',
    confirmPassword: '',
    role: 'customer' as 'customer' | 'technician' | 'guard' | 'partner' | 'admin' | 'sales',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

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
      default: return '/customer/dashboard';
    }
  };

  // Real-time validation
  useEffect(() => {
    validateForm();
  }, [formData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation (Ghana format - optional)
    if (formData.phone) {
      const phoneRegex = /^(\+233|0)([2-5][0-9]|24|25|26|27|28|29|50|54|55|59|56|57|20|30|33)[0-9]{7}$/;
      if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = 'Enter a valid Ghana phone number (e.g., +233 24 123 4567)';
      }
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[a-z]/.test(formData.password) || !/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase and lowercase letters';
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    }

    // Confirm password
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    } else if (!formData.confirmPassword && formData.password) {
      newErrors.confirmPassword = 'Please confirm your password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    setTouched({ ...touched, [field]: true });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allTouched = Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    setTouched(allTouched);

    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      setGeneralError('Please fix all errors before submitting');
      return;
    }

    if (!agreedToTerms) {
      setGeneralError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);
    setGeneralError('');
    setRegistrationSuccess(false);

    try {
      await signUp(formData.email, formData.password, {
        displayName: formData.name,
        phoneNumber: formData.phone,
        company: formData.company,
        role: formData.role,
      });

      firebaseUtils.logEvent('registration_completed', {
        method: 'email',
        role: formData.role,
      });

      setRegistrationSuccess(true);
      setVerificationSent(true);

      // Try to send verification email (non-blocking)
      try {
        await authService.sendVerificationEmail();
      } catch (verifyError) {
        console.warn('Verification email could not be sent:', verifyError);
      }

      // Redirect after a delay
      setTimeout(() => {
        const redirectPath = getDashboardPath(formData.role);
        navigate(redirectPath);
      }, 3000);

    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle error based on error code
      const errorCode = error.code || '';
      const errorMessage = error.message || '';
      
      if (errorCode === 'auth/email-already-in-use' || 
          errorMessage === 'auth/email-already-in-use' ||
          errorMessage === 'This email is already registered. Please sign in instead.') {
        setGeneralError('This email is already registered. Please sign in or use a different email.');
      } else if (errorCode === 'auth/invalid-email') {
        setGeneralError('Please enter a valid email address.');
      } else if (errorCode === 'auth/weak-password') {
        setGeneralError('Password is too weak. Please use a stronger password.');
      } else if (errorCode === 'auth/network-request-failed') {
        setGeneralError('Network error. Please check your internet connection and try again.');
      } else if (errorCode === 'auth/wrong-password') {
        setGeneralError('An account with this email already exists but the password is incorrect. Please try signing in.');
      } else {
        setGeneralError(errorMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = checkPasswordStrength(formData.password);
  const strengthInfo = getPasswordStrengthLabel(passwordStrength);

  // If user is logged in, redirect
  if (user && !authLoading) {
    const path = getDashboardPath(user.role);
    navigate(path);
    return null;
  }

  // If registration successful, show success screen
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white font-sans antialiased flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-neutral-400 mb-4">
            Welcome to GRID Security Platform
          </p>
          {verificationSent && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-300 font-medium">Verification Email Sent</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Please check your inbox and verify your email address.
                    You can still access your account while verification is pending.
                  </p>
                </div>
              </div>
            </div>
          )}
          <p className="text-sm text-neutral-500">
            Redirecting to dashboard in a moment...
          </p>
          <div className="mt-4 w-full bg-neutral-800 rounded-full h-1 overflow-hidden">
            <div className="bg-lime-400 h-1 rounded-full animate-progress" style={{ width: '100%' }} />
          </div>
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

      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="text-center">
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
          <h2 className="mt-5 sm:mt-6 text-2xl sm:text-3xl font-bold tracking-tighter text-white uppercase">
            Create your account
          </h2>
          <p className="mt-2 text-xs text-neutral-400">
            Or{' '}
            <Link to="/login" className="font-medium text-lime-400 hover:text-lime-300 transition-colors">
              sign in to existing account
            </Link>
          </p>
        </div>

        <Card className="mt-6 sm:mt-8 bg-[#161616] border border-neutral-800 rounded-2xl shadow-2xl shadow-black/50">
          <CardContent className="py-6 sm:py-8 px-4 sm:px-6 lg:px-10">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {/* Personal Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-800/60">
                  <User className="w-4 h-4 text-lime-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Personal Information
                  </span>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    Full Name <span className="text-lime-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className={`w-full bg-neutral-900/50 border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors ${
                        touched.name && errors.name
                          ? 'border-red-500/50 focus:border-red-500'
                          : touched.name && !errors.name && formData.name
                          ? 'border-emerald-500/50 focus:border-emerald-500'
                          : 'border-neutral-800 focus:border-lime-400/50'
                      }`}
                      placeholder="John Doe"
                    />
                    {touched.name && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {errors.name ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : formData.name ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : null}
                      </div>
                    )}
                  </div>
                  {touched.name && errors.name && (
                    <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    Email address <span className="text-lime-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className={`w-full bg-neutral-900/50 border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors ${
                        touched.email && errors.email
                          ? 'border-red-500/50 focus:border-red-500'
                          : touched.email && !errors.email && formData.email
                          ? 'border-emerald-500/50 focus:border-emerald-500'
                          : 'border-neutral-800 focus:border-lime-400/50'
                      }`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {touched.email && errors.email && (
                    <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      className={`w-full bg-neutral-900/50 border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors ${
                        touched.phone && errors.phone
                          ? 'border-red-500/50 focus:border-red-500'
                          : touched.phone && !errors.phone && formData.phone
                          ? 'border-emerald-500/50 focus:border-emerald-500'
                          : 'border-neutral-800 focus:border-lime-400/50'
                      }`}
                      placeholder="+233 24 123 4567"
                    />
                  </div>
                  {touched.phone && errors.phone && (
                    <p className="mt-1 text-xs text-red-400">{errors.phone}</p>
                  )}
                </div>

                {/* Company */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    Company (Optional)
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleFieldChange('company', e.target.value)}
                      className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50 transition-colors"
                      placeholder="Your Company"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    I want to register as
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <select
                      value={formData.role}
                      onChange={(e) => handleFieldChange('role', e.target.value)}
                      className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-8 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-lime-400/50 transition-colors cursor-pointer"
                    >
                      <option value="customer">Customer</option>
                      <option value="partner">Partner / Reseller</option>
                      <option value="technician">Technician</option>
                      <option value="guard">Security Guard</option>
                      <option value="sales">Sales</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-800/60">
                  <Lock className="w-4 h-4 text-lime-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Security
                  </span>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    Password <span className="text-lime-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      className={`w-full bg-neutral-900/50 border rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors ${
                        touched.password && errors.password
                          ? 'border-red-500/50 focus:border-red-500'
                          : touched.password && !errors.password && formData.password
                          ? 'border-emerald-500/50 focus:border-emerald-500'
                          : 'border-neutral-800 focus:border-lime-400/50'
                      }`}
                      placeholder="••••••••"
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
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${strengthInfo.bg} transition-all duration-300`}
                            style={{ width: `${(passwordStrength / 5) * 100}%` }}
                          />
                        </div>
                        <span className={`text-[9px] font-medium ${strengthInfo.color}`}>
                          {strengthInfo.label}
                        </span>
                      </div>
                      <div className="flex gap-1 text-[8px] text-neutral-500">
                        <span>8+ chars</span>
                        <span>•</span>
                        <span>Uppercase & Lowercase</span>
                        <span>•</span>
                        <span>Number</span>
                        <span>•</span>
                        <span>Special char</span>
                      </div>
                    </div>
                  )}
                  {touched.password && errors.password && (
                    <p className="mt-1 text-xs text-red-400">{errors.password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
                    Confirm Password <span className="text-lime-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                      className={`w-full bg-neutral-900/50 border rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-colors ${
                        touched.confirmPassword && errors.confirmPassword
                          ? 'border-red-500/50 focus:border-red-500'
                          : touched.confirmPassword && !errors.confirmPassword && formData.confirmPassword && formData.confirmPassword === formData.password
                          ? 'border-emerald-500/50 focus:border-emerald-500'
                          : 'border-neutral-800 focus:border-lime-400/50'
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-neutral-500 hover:text-neutral-300 transition-colors" />
                      ) : (
                        <Eye className="w-4 h-4 text-neutral-500 hover:text-neutral-300 transition-colors" />
                      )}
                    </button>
                  </div>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>
                  )}
                  {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password && (
                    <p className="mt-1 text-xs text-emerald-400">✓ Passwords match</p>
                  )}
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 bg-neutral-900/50 border-neutral-700 rounded text-lime-400 focus:ring-lime-400/50 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-neutral-400 cursor-pointer leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" className="text-lime-400 hover:text-lime-300 transition-colors">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-lime-400 hover:text-lime-300 transition-colors">Privacy Policy</Link>
                </label>
              </div>

              {/* General Error */}
              {generalError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-400">{generalError}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                loading={loading} 
                fullWidth
                disabled={loading || !agreedToTerms}
                className="bg-lime-400 text-black hover:bg-lime-300 text-xs font-bold uppercase tracking-widest rounded-lg py-2.5 h-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-[9px] text-neutral-500 text-center leading-relaxed pt-2 border-t border-neutral-800/60">
                Already have an account?{' '}
                <Link to="/login" className="text-lime-400 hover:text-lime-300 transition-colors font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}