// src/features/operations/pages/CustomerManagement.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, Filter, Plus, MoreVertical,
  Mail, Phone, MapPin, Calendar, DollarSign,
  Eye, Edit, Trash2, UserPlus, Download,
  RefreshCw, CheckCircle, XCircle, AlertCircle,
  Building, Clock, Award, TrendingUp, UserCheck,
  UserX, Activity, BarChart3, PieChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  Timestamp,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { authService } from '@/services/firebase/auth.service';
import type { User } from '@/types/models';

interface CustomerWithStats extends User {
  id: string;
  totalSpent: number;
  activeServices: number;
  serviceIds: string[];
  lastActive: Date | null;
}

export function CustomerManagement() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithStats[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    pending: 0,
    totalRevenue: 0,
    avgLifetime: 0,
    newThisMonth: 0,
  });

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    location: '',
    password: '',
    role: 'customer' as 'customer' | 'partner' | 'admin',
  });

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);

      // Get all users with customer role
      const usersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['customer', 'partner']),
        orderBy('createdAt', 'desc')
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      const customersData: CustomerWithStats[] = [];
      let totalRevenue = 0;
      let activeCount = 0;
      let inactiveCount = 0;
      let pendingCount = 0;
      let newThisMonth = 0;

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const userId = doc.id;
        
        // Get services for this customer
        const servicesQuery = query(
          collection(db, 'services'),
          where('customerId', '==', userId)
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        const services = servicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Get invoices for this customer
        const invoicesQuery = query(
          collection(db, 'invoices'),
          where('customerId', '==', userId),
          where('status', '==', 'paid')
        );
        const invoicesSnapshot = await getDocs(invoicesQuery);
        const totalSpent = invoicesSnapshot.docs.reduce((sum, inv) => sum + (inv.data().total || 0), 0);

        const activeServices = services.filter(s => s.status === 'active').length;
        const customerStatus = data.isActive ? 'active' : 'inactive';
        
        if (customerStatus === 'active') activeCount++;
        else if (customerStatus === 'inactive') inactiveCount++;
        else pendingCount++;

        const createdAt = data.createdAt?.toDate() || new Date();
        if (createdAt >= firstDayOfMonth) newThisMonth++;

        totalRevenue += totalSpent;

        customersData.push({
          id: userId,
          ...data,
          totalSpent,
          activeServices,
          serviceIds: services.map(s => s.id),
          lastActive: data.lastLoginAt?.toDate() || null,
        });
      }

      setCustomers(customersData);
      setFilteredCustomers(customersData);
      
      setStats({
        total: customersData.length,
        active: activeCount,
        inactive: inactiveCount,
        pending: pendingCount,
        totalRevenue,
        avgLifetime: customersData.length > 0 ? totalRevenue / customersData.length : 0,
        newThisMonth,
      });

      firebaseUtils.logEvent('customer_management_viewed', {
        userId: user?.uid,
        totalCustomers: customersData.length,
      });

    } catch (error) {
      console.error('Error loading customers:', error);
      firebaseUtils.logEvent('customer_management_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadCustomers();

    // Real-time updates for users
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      // Reload when users change
      loadCustomers();
    });

    return () => unsubscribe();
  }, [loadCustomers]);

  // Filter customers
  useEffect(() => {
    let filtered = [...customers];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.displayName?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.phoneNumber?.includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => {
        if (statusFilter === 'active') return c.isActive;
        if (statusFilter === 'inactive') return !c.isActive;
        return true;
      });
    }

    // Location filter (would need location data)
    if (locationFilter !== 'all') {
      // filtered = filtered.filter(c => c.location === locationFilter);
    }

    setFilteredCustomers(filtered);
  }, [customers, searchQuery, statusFilter, locationFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email || !newCustomer.password) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      await authService.signUp(
        newCustomer.email,
        newCustomer.password,
        {
          displayName: newCustomer.name,
          phoneNumber: newCustomer.phone,
          company: newCustomer.company,
          role: newCustomer.role,
          isActive: true,
        }
      );

      firebaseUtils.logEvent('customer_created', {
        role: newCustomer.role,
      });

      setSuccessMessage('Customer created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setAddModalOpen(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        company: '',
        location: '',
        password: '',
        role: 'customer',
      });
      await loadCustomers();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create customer');
      console.error('Error creating customer:', error);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;

    try {
      await updateDoc(doc(db, 'users', selectedCustomer.id), {
        displayName: selectedCustomer.displayName,
        phoneNumber: selectedCustomer.phoneNumber,
        company: selectedCustomer.company,
        isActive: selectedCustomer.isActive,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('customer_updated', {
        id: selectedCustomer.id,
      });

      setSuccessMessage('Customer updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setEditModalOpen(false);
      await loadCustomers();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update customer');
      console.error('Error updating customer:', error);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;

    try {
      await deleteDoc(doc(db, 'users', id));
      
      firebaseUtils.logEvent('customer_deleted', { id });
      
      setSuccessMessage('Customer deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadCustomers();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete customer');
      console.error('Error deleting customer:', error);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', id), {
        isActive: !currentStatus,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('customer_status_toggled', {
        id,
        newStatus: !currentStatus,
      });

      await loadCustomers();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update status');
      console.error('Error updating status:', error);
    }
  };

  const handleExport = () => {
    const csv = filteredCustomers.map(c => 
      `${c.displayName},${c.email},${c.phoneNumber},${c.company || ''},${c.isActive ? 'Active' : 'Inactive'},${c.totalSpent},${c.activeServices}`
    ).join('\n');
    const blob = new Blob(['Name,Email,Phone,Company,Status,Total Spent,Active Services\n' + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    firebaseUtils.logEvent('customers_exported');
  };

  const columns = [
    { 
      key: 'displayName', 
      header: 'Customer Name', 
      sortable: true,
      render: (value: string, row: CustomerWithStats) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-lime-400/10 rounded-full flex items-center justify-center">
            <span className="text-lime-400 text-sm font-medium">
              {value?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <span className="text-white">{value}</span>
        </div>
      )
    },
    { 
      key: 'company', 
      header: 'Company', 
      sortable: true,
      render: (value: string) => <span className="text-neutral-400">{value || '-'}</span>
    },
    { 
      key: 'email', 
      header: 'Email',
      render: (value: string) => <span className="text-neutral-400">{value}</span>
    },
    { 
      key: 'phoneNumber', 
      header: 'Phone',
      render: (value: string) => <span className="text-neutral-400">{value || '-'}</span>
    },
    { 
      key: 'isActive', 
      header: 'Status',
      render: (value: boolean) => <StatusBadge status={value ? 'active' : 'inactive'} />
    },
    { 
      key: 'totalSpent', 
      header: 'Total Spent',
      render: (value: number) => <Currency amount={value} className="text-lime-400 font-semibold" />
    },
    { 
      key: 'activeServices', 
      header: 'Services',
      render: (value: number) => <span className="text-white font-medium">{value}</span>
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Customer Management</h1>
          <p className="text-neutral-400 mt-1">Manage all customer accounts and relationships</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExport}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={() => setAddModalOpen(true)}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Total</p>
            <p className="text-xl font-bold text-white">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Active</p>
            <p className="text-xl font-bold text-emerald-400">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Inactive</p>
            <p className="text-xl font-bold text-red-400">{stats.inactive}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Pending</p>
            <p className="text-xl font-bold text-yellow-400">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800 col-span-2">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Total Revenue</p>
            <p className="text-xl font-bold text-lime-400">
              <Currency amount={stats.totalRevenue} />
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Avg. LTV</p>
            <p className="text-xl font-bold text-purple-400">
              <Currency amount={stats.avgLifetime} compact />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search customers by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-neutral-500" />}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="all">All Locations</option>
              <option value="accra">Accra</option>
              <option value="kumasi">Kumasi</option>
              <option value="tema">Tema</option>
            </select>
            <Button 
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-0 overflow-x-auto">
          <DataTable
            data={filteredCustomers}
            columns={columns}
            searchable={false}
            onRowClick={(customer) => {
              setSelectedCustomer(customer);
              setDetailsModalOpen(true);
            }}
          />
          <div className="p-4 text-sm text-neutral-500 border-t border-neutral-800">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add New Customer" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <Input
              label="Email *"
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <Input
              label="Company"
              value={newCustomer.company}
              onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location"
              value={newCustomer.location}
              onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <Input
              label="Password *"
              type="password"
              value={newCustomer.password}
              onChange={(e) => setNewCustomer({ ...newCustomer, password: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Role</label>
            <select
              value={newCustomer.role}
              onChange={(e) => setNewCustomer({ ...newCustomer, role: e.target.value as any })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="customer">Customer</option>
              <option value="partner">Partner</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setAddModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddCustomer}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Customer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Customer Details Modal */}
      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Customer Details" size="lg">
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-lime-400/10 rounded-full flex items-center justify-center">
                    <span className="text-lime-400 text-xl font-bold">
                      {selectedCustomer.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedCustomer.displayName}</h3>
                    <p className="text-neutral-400">{selectedCustomer.company || 'Individual'}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setEditModalOpen(true);
                  }}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                  onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3 bg-neutral-800/30 p-4 rounded-lg">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Contact Information</p>
                <div className="flex items-center gap-2 text-neutral-300">
                  <Mail className="w-4 h-4 text-neutral-500" />
                  {selectedCustomer.email}
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <Phone className="w-4 h-4 text-neutral-500" />
                  {selectedCustomer.phoneNumber || 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <MapPin className="w-4 h-4 text-neutral-500" />
                  {selectedCustomer.location || 'N/A'}
                </div>
              </div>
              <div className="space-y-3 bg-neutral-800/30 p-4 rounded-lg">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Account Information</p>
                <div className="flex items-center gap-2 text-neutral-300">
                  <Calendar className="w-4 h-4 text-neutral-500" />
                  Joined: {selectedCustomer.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <DollarSign className="w-4 h-4 text-neutral-500" />
                  Total Spent: <Currency amount={selectedCustomer.totalSpent} className="text-lime-400 font-semibold" />
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <Users className="w-4 h-4 text-neutral-500" />
                  Active Services: <span className="text-white font-medium">{selectedCustomer.activeServices}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <h4 className="font-medium text-white mb-3">Recent Activity</h4>
              <div className="space-y-2 bg-neutral-800/30 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Status</span>
                  <StatusBadge status={selectedCustomer.isActive ? 'active' : 'inactive'} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Last Login</span>
                  <span className="text-white">{selectedCustomer.lastActive?.toLocaleString() || 'Never'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Services</span>
                  <span className="text-white">{selectedCustomer.serviceIds?.length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Role</span>
                  <span className="text-white capitalize">{selectedCustomer.role}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)} className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                Close
              </Button>
              <Button className="bg-lime-400 text-black hover:bg-lime-300">
                <Mail className="w-4 h-4 mr-2" />
                Contact Customer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Customer Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Customer" size="lg">
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={selectedCustomer.displayName || ''}
                onChange={(e) => setSelectedCustomer({ ...selectedCustomer, displayName: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white"
              />
              <Input
                label="Email"
                type="email"
                value={selectedCustomer.email || ''}
                onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone"
                value={selectedCustomer.phoneNumber || ''}
                onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phoneNumber: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white"
              />
              <Input
                label="Company"
                value={selectedCustomer.company || ''}
                onChange={(e) => setSelectedCustomer({ ...selectedCustomer, company: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Status</label>
              <select
                value={selectedCustomer.isActive ? 'active' : 'inactive'}
                onChange={(e) => setSelectedCustomer({ ...selectedCustomer, isActive: e.target.value === 'active' })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Role</label>
              <select
                value={selectedCustomer.role || 'customer'}
                onChange={(e) => setSelectedCustomer({ ...selectedCustomer, role: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="customer">Customer</option>
                <option value="partner">Partner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <Button 
                variant="outline" 
                onClick={() => setEditModalOpen(false)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateCustomer}
                className="bg-lime-400 text-black hover:bg-lime-300"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CustomerManagement;