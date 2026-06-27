// src/features/operations/pages/AdminSettings.tsx
import { useState, useEffect } from 'react';
import { 
  Save, Users, Shield, DollarSign, Key, 
  Building, Mail, Phone, Globe, Lock, Eye, EyeOff,
  Plus, Trash2, Edit, Check, X, RefreshCw,
  AlertCircle, CheckCircle, Loader2, Settings,
  Bell, Moon, Sun, Languages, Database, Server,
  Activity, Zap, ShieldCheck, Fingerprint, MapPin,
  UserCog, Briefcase, Calendar, Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { authService } from '@/services/firebase/auth.service';
import type { User as UserType } from '@/types/models';

interface GeneralSettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyWebsite: string;
  supportEmail: string;
  supportPhone: string;
  timezone: string;
  currency: string;
  language: string;
}

interface UserManagement {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phoneNumber: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function AdminSettings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  
  // General Settings
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    companyWebsite: '',
    supportEmail: '',
    supportPhone: '',
    timezone: 'Africa/Accra',
    currency: 'GHS',
    language: 'en',
  });

  // Users
  const [users, setUsers] = useState<UserManagement[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', displayName: '', role: 'customer', password: '' });
  const [editingUser, setEditingUser] = useState<UserManagement | null>(null);

  // Roles
  const [roles, setRoles] = useState<{id: string; name: string; permissions: string[]}[]>([]);

  // API Keys
  const [apiKeys, setApiKeys] = useState<{id: string; name: string; key: string; created: string; lastUsed: string}[]>([]);

  // Billing Settings
  const [billingSettings, setBillingSettings] = useState({
    taxRate: 12.5,
    currency: 'GHS',
    paymentGateway: 'stripe',
    invoicePrefix: 'GRID',
    autoGenerateInvoices: true,
    paymentTerms: 30,
    lateFee: 5,
  });

  // Load all data
  useEffect(() => {
    loadGeneralSettings();
    loadUsers();
    loadRoles();
    loadApiKeys();
    loadBillingSettings();

    // Real-time user updates
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        lastLoginAt: doc.data().lastLoginAt?.toDate() || null,
      })) as UserManagement[];
      setUsers(usersData);
    });

    return () => unsubscribe();
  }, []);

  // Load General Settings
  const loadGeneralSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setGeneralSettings({
          companyName: data.companyName || '',
          companyEmail: data.companyEmail || '',
          companyPhone: data.companyPhone || '',
          companyAddress: data.companyAddress || '',
          companyWebsite: data.companyWebsite || '',
          supportEmail: data.supportEmail || '',
          supportPhone: data.supportPhone || '',
          timezone: data.timezone || 'Africa/Accra',
          currency: data.currency || 'GHS',
          language: data.language || 'en',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Load Users
  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        lastLoginAt: doc.data().lastLoginAt?.toDate() || null,
      })) as UserManagement[];
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Load Roles
  const loadRoles = async () => {
    try {
      const rolesSnapshot = await getDocs(collection(db, 'roles'));
      if (!rolesSnapshot.empty) {
        const rolesData = rolesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as {id: string; name: string; permissions: string[]}[];
        setRoles(rolesData);
      } else {
        // Default roles if none exist
        const defaultRoles = [
          { id: 'customer', name: 'Customer', permissions: ['view_services', 'view_monitoring', 'view_reports'] },
          { id: 'technician', name: 'Technician', permissions: ['view_jobs', 'manage_equipment', 'complete_jobs'] },
          { id: 'guard', name: 'Guard', permissions: ['view_patrol', 'report_incidents', 'view_checkpoints'] },
          { id: 'partner', name: 'Partner', permissions: ['view_leads', 'manage_referrals', 'view_earnings'] },
          { id: 'admin', name: 'Admin', permissions: ['all'] },
          { id: 'sales', name: 'Sales', permissions: ['view_customers', 'manage_leads', 'create_quotes'] },
        ];
        setRoles(defaultRoles);
        
        // Save default roles to Firestore
        const batch = writeBatch(db);
        defaultRoles.forEach(role => {
          const ref = doc(db, 'roles', role.id);
          batch.set(ref, role);
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  // Load API Keys
  const loadApiKeys = async () => {
    try {
      const apiKeysSnapshot = await getDocs(collection(db, 'apiKeys'));
      const keysData = apiKeysSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as {id: string; name: string; key: string; created: string; lastUsed: string}[];
      setApiKeys(keysData);
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  // Load Billing Settings
  const loadBillingSettings = async () => {
    try {
      const billingDoc = await getDoc(doc(db, 'settings', 'billing'));
      if (billingDoc.exists()) {
        const data = billingDoc.data();
        setBillingSettings({
          taxRate: data.taxRate || 12.5,
          currency: data.currency || 'GHS',
          paymentGateway: data.paymentGateway || 'stripe',
          invoicePrefix: data.invoicePrefix || 'GRID',
          autoGenerateInvoices: data.autoGenerateInvoices !== undefined ? data.autoGenerateInvoices : true,
          paymentTerms: data.paymentTerms || 30,
          lateFee: data.lateFee || 5,
        });
      }
    } catch (error) {
      console.error('Error loading billing settings:', error);
    }
  };

  // Save General Settings
  const saveGeneralSettings = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        ...generalSettings,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      }, { merge: true });
      
      setSuccessMessage('Settings saved successfully!');
      firebaseUtils.logEvent('admin_settings_updated', { type: 'general' });
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save settings');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add User
  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.displayName) {
      setErrorMessage('Please fill in all required fields');
      return;
    }
    
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      await authService.signUp(
        newUser.email,
        newUser.password,
        {
          displayName: newUser.displayName,
          role: newUser.role as any,
          isActive: true,
        }
      );
      
      setSuccessMessage('User created successfully!');
      setShowAddUser(false);
      setNewUser({ email: '', displayName: '', role: 'customer', password: '' });
      await loadUsers();
      
      firebaseUtils.logEvent('user_created', { role: newUser.role });
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create user');
      console.error('Error creating user:', error);
    } finally {
      setSaving(false);
    }
  };

  // Update User Status
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      firebaseUtils.logEvent('user_status_toggled', { userId, newStatus: !currentStatus });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update user status');
      console.error('Error updating user:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      setSuccessMessage('User deleted successfully!');
      await loadUsers();
      firebaseUtils.logEvent('user_deleted', { userId });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete user');
      console.error('Error deleting user:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save Roles
  const saveRoles = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      const batch = writeBatch(db);
      roles.forEach(role => {
        const ref = doc(db, 'roles', role.id);
        batch.set(ref, {
          ...role,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      
      setSuccessMessage('Roles saved successfully!');
      firebaseUtils.logEvent('roles_updated');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save roles');
      console.error('Error saving roles:', error);
    } finally {
      setSaving(false);
    }
  };

  // Generate API Key
  const generateApiKey = async () => {
    setSaving(true);
    try {
      const newKey = {
        name: `API Key ${apiKeys.length + 1}`,
        key: `sk_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`,
        created: new Date().toISOString().split('T')[0],
        lastUsed: 'Never',
        createdAt: serverTimestamp(),
      };
      
      const docRef = await setDoc(doc(collection(db, 'apiKeys')), newKey);
      await loadApiKeys();
      setSuccessMessage('API Key generated successfully!');
      firebaseUtils.logEvent('api_key_generated');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to generate API key');
      console.error('Error generating API key:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete API Key
  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Delete this API key? This action cannot be undone.')) return;
    
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'apiKeys', keyId));
      await loadApiKeys();
      setSuccessMessage('API Key deleted successfully!');
      firebaseUtils.logEvent('api_key_deleted');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete API key');
      console.error('Error deleting API key:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save Billing Settings
  const saveBillingSettings = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
      await setDoc(doc(db, 'settings', 'billing'), {
        ...billingSettings,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      }, { merge: true });
      
      setSuccessMessage('Billing settings saved successfully!');
      firebaseUtils.logEvent('billing_settings_updated');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save billing settings');
      console.error('Error saving billing settings:', error);
    } finally {
      setSaving(false);
    }
  };

  // Tab configurations
  const tabs = [
    { 
      id: 'general', 
      label: 'General', 
      icon: <Settings className="w-4 h-4 text-lime-400" />,
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              value={generalSettings.companyName}
              onChange={(e) => setGeneralSettings({ ...generalSettings, companyName: e.target.value })}
              icon={<Building className="w-4 h-4 text-neutral-500" />}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <Input
              label="Company Email"
              type="email"
              value={generalSettings.companyEmail}
              onChange={(e) => setGeneralSettings({ ...generalSettings, companyEmail: e.target.value })}
              icon={<Mail className="w-4 h-4 text-neutral-500" />}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <Input
              label="Company Phone"
              value={generalSettings.companyPhone}
              onChange={(e) => setGeneralSettings({ ...generalSettings, companyPhone: e.target.value })}
              icon={<Phone className="w-4 h-4 text-neutral-500" />}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <Input
              label="Company Website"
              value={generalSettings.companyWebsite}
              onChange={(e) => setGeneralSettings({ ...generalSettings, companyWebsite: e.target.value })}
              icon={<Globe className="w-4 h-4 text-neutral-500" />}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <div className="md:col-span-2">
              <Input
                label="Company Address"
                value={generalSettings.companyAddress}
                onChange={(e) => setGeneralSettings({ ...generalSettings, companyAddress: e.target.value })}
                icon={<MapPin className="w-4 h-4 text-neutral-500" />}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
              />
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <h3 className="text-sm font-medium text-white mb-4">Support Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Support Email"
                type="email"
                value={generalSettings.supportEmail}
                onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                icon={<Mail className="w-4 h-4 text-neutral-500" />}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
              />
              <Input
                label="Support Phone"
                value={generalSettings.supportPhone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                icon={<Phone className="w-4 h-4 text-neutral-500" />}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
              />
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <h3 className="text-sm font-medium text-white mb-4">Regional Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={generalSettings.timezone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="Africa/Accra">Africa/Accra</option>
                <option value="Africa/Lagos">Africa/Lagos</option>
                <option value="Africa/Nairobi">Africa/Nairobi</option>
                <option value="UTC">UTC</option>
              </select>
              <select
                value={generalSettings.currency}
                onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="GHS">GHS - Ghana Cedis</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="NGN">NGN - Nigerian Naira</option>
              </select>
              <select
                value={generalSettings.language}
                onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="tw">Twi</option>
                <option value="ga">Ga</option>
                <option value="ha">Hausa</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={saveGeneralSettings} 
            loading={saving}
            className="bg-lime-400 text-black hover:bg-lime-300 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      )
    },
    { 
      id: 'users', 
      label: 'Users', 
      icon: <Users className="w-4 h-4 text-lime-400" />,
      content: (
        <div className="space-y-4 p-6">
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
          
          <div className="flex justify-between items-center">
            <p className="text-neutral-400 text-sm">Manage system users and permissions</p>
            <Button 
              onClick={() => setShowAddUser(!showAddUser)}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          {showAddUser && (
            <Card className="bg-neutral-800/50 border-neutral-700">
              <CardContent className="p-4">
                <h4 className="text-white font-medium mb-4">Add New User</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name *"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                    className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
                  />
                  <Input
                    label="Email *"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
                  />
                  <Input
                    label="Password *"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
                  >
                    <option value="customer">Customer</option>
                    <option value="technician">Technician</option>
                    <option value="guard">Guard</option>
                    <option value="partner">Partner</option>
                    <option value="admin">Admin</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={handleAddUser} 
                    loading={saving}
                    className="bg-lime-400 text-black hover:bg-lime-300"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create User
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddUser(false)}
                    className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-800/50 border-b border-neutral-800">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">User</th>
                  <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Email</th>
                  <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Role</th>
                  <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Last Login</th>
                  <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition">
                    <td className="p-3 text-sm text-white">{user.displayName}</td>
                    <td className="p-3 text-sm text-neutral-400">{user.email}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 bg-lime-400/10 text-lime-400 rounded-full capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={user.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td className="p-3 text-sm text-neutral-400">
                      {user.lastLoginAt ? user.lastLoginAt.toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleUserStatus(user.id, user.isActive)}
                          className="text-neutral-400 hover:text-white"
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                          disabled={saving}
                        >
                          {user.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    { 
      id: 'roles', 
      label: 'Roles', 
      icon: <Shield className="w-4 h-4 text-lime-400" />,
      content: (
        <div className="space-y-4 p-6">
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
          
          <p className="text-neutral-400 text-sm">Configure user roles and their permissions</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <Card key={role.id} className="bg-neutral-800/30 border-neutral-700 hover:border-lime-400/30 transition">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-medium capitalize">{role.name}</h4>
                    <span className="text-xs px-2 py-1 bg-lime-400/10 text-lime-400 rounded-full">
                      {role.permissions.includes('all') ? 'Full Access' : `${role.permissions.length} permissions`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((perm, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-neutral-700/50 text-neutral-300 rounded">
                        {perm.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Button 
            onClick={saveRoles} 
            loading={saving}
            className="bg-lime-400 text-black hover:bg-lime-300 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Roles
          </Button>
        </div>
      )
    },
    { 
      id: 'billing', 
      label: 'Billing', 
      icon: <DollarSign className="w-4 h-4 text-lime-400" />,
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tax Rate (%)"
              type="number"
              value={billingSettings.taxRate}
              onChange={(e) => setBillingSettings({ ...billingSettings, taxRate: parseFloat(e.target.value) })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <select
              value={billingSettings.currency}
              onChange={(e) => setBillingSettings({ ...billingSettings, currency: e.target.value })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="GHS">GHS - Ghana Cedis</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
            </select>
            <Input
              label="Invoice Prefix"
              value={billingSettings.invoicePrefix}
              onChange={(e) => setBillingSettings({ ...billingSettings, invoicePrefix: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <Input
              label="Payment Terms (days)"
              type="number"
              value={billingSettings.paymentTerms}
              onChange={(e) => setBillingSettings({ ...billingSettings, paymentTerms: parseInt(e.target.value) })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <Input
              label="Late Fee (%)"
              type="number"
              value={billingSettings.lateFee}
              onChange={(e) => setBillingSettings({ ...billingSettings, lateFee: parseFloat(e.target.value) })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-lime-400/50"
            />
            <select
              value={billingSettings.paymentGateway}
              onChange={(e) => setBillingSettings({ ...billingSettings, paymentGateway: e.target.value })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="stripe">Stripe</option>
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGenerate"
              checked={billingSettings.autoGenerateInvoices}
              onChange={(e) => setBillingSettings({ ...billingSettings, autoGenerateInvoices: e.target.checked })}
              className="w-4 h-4 bg-neutral-900 border-neutral-700 rounded text-lime-400 focus:ring-lime-400 focus:ring-offset-0"
            />
            <label htmlFor="autoGenerate" className="text-sm text-neutral-300">
              Auto-generate invoices for recurring subscriptions
            </label>
          </div>
          
          <Button 
            onClick={saveBillingSettings} 
            loading={saving}
            className="bg-lime-400 text-black hover:bg-lime-300 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Billing Settings
          </Button>
        </div>
      )
    },
    { 
      id: 'api', 
      label: 'API Keys', 
      icon: <Key className="w-4 h-4 text-lime-400" />,
      content: (
        <div className="space-y-4 p-6">
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
          
          <div className="flex justify-between items-center">
            <p className="text-neutral-400 text-sm">Manage API keys for third-party integrations</p>
            <Button 
              onClick={generateApiKey}
              loading={saving}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate Key
            </Button>
          </div>

          <div className="space-y-3">
            {apiKeys.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No API keys found</p>
                <p className="text-xs">Generate your first API key above</p>
              </div>
            ) : (
              apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg hover:border-lime-400/30 transition">
                  <div className="flex-1">
                    <p className="text-white font-medium">{key.name}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <code className="text-xs text-neutral-400 bg-neutral-900/50 px-2 py-1 rounded font-mono">
                        {key.key}
                      </code>
                      <span className="text-xs text-neutral-500">Created: {key.created}</span>
                      <span className="text-xs text-neutral-500">Last used: {key.lastUsed}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-400 hover:text-red-300"
                    onClick={() => deleteApiKey(key.id)}
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-neutral-400 mt-1">Manage system configuration and settings</p>
      </div>
      
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-0">
          <div className="border-b border-neutral-800">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                    activeTab === tab.id
                      ? 'border-lime-400 text-lime-400'
                      : 'border-transparent text-neutral-400 hover:text-white hover:border-neutral-600'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {tabs.find(tab => tab.id === activeTab)?.content}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminSettings;