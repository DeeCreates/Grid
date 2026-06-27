// src/features/customer/pages/AccountSettings.tsx
import { useState, useEffect } from 'react';
import { 
  User, Bell, Shield, Key, Globe, Smartphone, Save, 
  Mail, Phone, Building, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2, LogOut,
  UserCog, Fingerprint, Clock, MapPin, Calendar,
  CreditCard, DollarSign, FileText, Settings,
  Moon, Sun, Languages, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/firebase/auth.service';
import { firebaseUtils } from '@/lib/firebase';
import { 
  doc, 
  updateDoc, 
  getDoc, 
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { User as UserType } from '@/types/models';

export function AccountSettings() {
  const { user, userProfile, signOut, updateProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    location: '',
    bio: '',
  });

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: true,
    marketingEmails: false,
    securityAlerts: true,
    incidentAlerts: true,
    paymentAlerts: true,
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    darkMode: false,
    language: 'en',
    timezone: 'Africa/Accra',
    currency: 'GHS',
    dateFormat: 'DD/MM/YYYY',
  });

  // Load user data
  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        name: userProfile.displayName || '',
        email: user?.email || '',
        phone: userProfile.phoneNumber || '',
        company: userProfile.company || '',
        location: userProfile.location || '',
        bio: userProfile.bio || '',
      });
      
      if (userProfile.preferences) {
        setPreferences({
          darkMode: userProfile.preferences.darkMode || false,
          language: userProfile.preferences.language || 'en',
          timezone: userProfile.preferences.timezone || 'Africa/Accra',
          currency: userProfile.preferences.currency || 'GHS',
          dateFormat: userProfile.preferences.dateFormat || 'DD/MM/YYYY',
        });
      }

      if (userProfile.notifications) {
        setNotifications({
          emailAlerts: userProfile.notifications.emailAlerts !== undefined ? userProfile.notifications.emailAlerts : true,
          smsAlerts: userProfile.notifications.smsAlerts || false,
          pushNotifications: userProfile.notifications.pushNotifications !== undefined ? userProfile.notifications.pushNotifications : true,
          marketingEmails: userProfile.notifications.marketingEmails || false,
          securityAlerts: userProfile.notifications.securityAlerts !== undefined ? userProfile.notifications.securityAlerts : true,
          incidentAlerts: userProfile.notifications.incidentAlerts !== undefined ? userProfile.notifications.incidentAlerts : true,
          paymentAlerts: userProfile.notifications.paymentAlerts !== undefined ? userProfile.notifications.paymentAlerts : true,
        });
      }
    }
  }, [user, userProfile]);

  // Save Profile
  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await updateProfile(user.uid, {
        displayName: profileForm.name,
        phoneNumber: profileForm.phone,
        company: profileForm.company,
        location: profileForm.location,
        bio: profileForm.bio,
        preferences: preferences,
        notifications: notifications,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('profile_updated', {
        userId: user.uid,
      });

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async () => {
    if (!user) return;
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await authService.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      
      firebaseUtils.logEvent('password_updated', {
        userId: user.uid,
      });

      setSuccessMessage('Password updated successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update password');
      console.error('Error updating password:', error);
    } finally {
      setSaving(false);
    }
  };

  // Toggle 2FA
  const handleToggle2FA = async () => {
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // In production, this would call a Firebase function to enable/disable 2FA
      const newState = !twoFactorEnabled;
      setTwoFactorEnabled(newState);
      
      firebaseUtils.logEvent('2fa_toggled', {
        userId: user?.uid,
        enabled: newState,
      });

      setSuccessMessage(`Two-factor authentication ${newState ? 'enabled' : 'disabled'} successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to toggle 2FA');
      console.error('Error toggling 2FA:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save Notification Preferences
  const handleSaveNotifications = async () => {
    if (!user) return;
    
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notifications: notifications,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('notification_preferences_updated', {
        userId: user.uid,
      });

      setSuccessMessage('Notification preferences saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save preferences');
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    if (!user) return;
    
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferences: preferences,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('preferences_updated', {
        userId: user.uid,
      });

      setSuccessMessage('Preferences saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save preferences');
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-4 h-4" />,
      content: (
        <div className="space-y-6 p-6">
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-400">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="flex items-center gap-4 pb-4 border-b border-neutral-800">
            <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-lime-400">
                {profileForm.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{profileForm.name || 'User'}</h3>
              <p className="text-sm text-neutral-400">{user?.email}</p>
              <StatusBadge status={userProfile?.isActive ? 'active' : 'inactive'} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              icon={<User className="w-4 h-4 text-neutral-500" />}
            />
            <Input
              label="Email Address"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              icon={<Mail className="w-4 h-4 text-neutral-500" />}
              disabled
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              icon={<Phone className="w-4 h-4 text-neutral-500" />}
            />
            <Input
              label="Company"
              value={profileForm.company}
              onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              icon={<Building className="w-4 h-4 text-neutral-500" />}
            />
          </div>
          <Input
            label="Location"
            value={profileForm.location}
            onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
            icon={<MapPin className="w-4 h-4 text-neutral-500" />}
          />
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Bio</label>
            <textarea
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              rows={3}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Tell us about yourself..."
            />
          </div>

          <Button 
            onClick={handleSaveProfile} 
            loading={saving}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: <Shield className="w-4 h-4" />,
      content: (
        <div className="space-y-6 p-6">
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-400">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Change Password</h4>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
                  icon={<Lock className="w-4 h-4 text-neutral-500" />}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
                  icon={<Lock className="w-4 h-4 text-neutral-500" />}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
                  icon={<Lock className="w-4 h-4 text-neutral-500" />}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button 
                onClick={handleUpdatePassword}
                loading={saving}
                className="bg-lime-400 text-black hover:bg-lime-300"
              >
                <Key className="w-4 h-4 mr-2" />
                Update Password
              </Button>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <h4 className="text-sm font-medium text-white mb-3">Two-Factor Authentication</h4>
            <div className="flex items-center justify-between p-4 bg-neutral-800/30 rounded-lg border border-neutral-700">
              <div>
                <p className="text-white font-medium">2FA Status</p>
                <p className="text-sm text-neutral-400">
                  {twoFactorEnabled ? 'Enabled - Your account is secure' : 'Disabled - Add extra security'}
                </p>
              </div>
              <Button 
                variant={twoFactorEnabled ? 'outline' : 'primary'}
                onClick={handleToggle2FA}
                loading={loading}
                className={twoFactorEnabled ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'bg-lime-400 text-black hover:bg-lime-300'}
              >
                {twoFactorEnabled ? 'Disable' : 'Enable'} 2FA
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Two-factor authentication adds an extra layer of security to your account.
            </p>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <h4 className="text-sm font-medium text-white mb-3">Account Actions</h4>
            <Button 
              variant="ghost" 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4" />,
      content: (
        <div className="space-y-6 p-6">
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-400">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(notifications).map(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').trim();
              const description = {
                emailAlerts: 'Receive email notifications for important updates',
                smsAlerts: 'Get SMS alerts for critical incidents',
                pushNotifications: 'Receive push notifications on your device',
                marketingEmails: 'Receive promotional emails and offers',
                securityAlerts: 'Get alerts for security events',
                incidentAlerts: 'Receive incident notifications',
                paymentAlerts: 'Get notified about payments and invoices',
              }[key] || 'Receive notifications';

              return (
                <label key={key} className="flex items-center justify-between p-4 bg-neutral-800/30 rounded-lg border border-neutral-700 cursor-pointer hover:border-neutral-600 transition">
                  <div>
                    <p className="font-medium text-white capitalize">{label}</p>
                    <p className="text-sm text-neutral-400">{description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                    className="w-4 h-4 bg-neutral-900 border-neutral-700 rounded text-lime-400 focus:ring-lime-400 focus:ring-offset-0 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>

          <Button 
            onClick={handleSaveNotifications}
            loading={saving}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      ),
    },
    {
      id: 'preferences',
      label: 'Preferences',
      icon: <Settings className="w-4 h-4" />,
      content: (
        <div className="space-y-6 p-6">
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-400">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Theme</label>
              <select
                value={preferences.darkMode ? 'dark' : 'light'}
                onChange={(e) => setPreferences({ ...preferences, darkMode: e.target.value === 'dark' })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Language</label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="tw">Twi</option>
                <option value="ga">Ga</option>
                <option value="ha">Hausa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Timezone</label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="Africa/Accra">Africa/Accra</option>
                <option value="Africa/Lagos">Africa/Lagos</option>
                <option value="Africa/Nairobi">Africa/Nairobi</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Currency</label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="GHS">GHS - Ghana Cedis</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="NGN">NGN - Nigerian Naira</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Date Format</label>
              <select
                value={preferences.dateFormat}
                onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={handleSavePreferences}
            loading={saving}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-neutral-400 mt-1">Manage your account preferences and security</p>
      </div>

      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-0">
          <Tabs tabs={tabs} />
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountSettings;