// src/features/customer/pages/ServiceManagement.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Camera, Wifi, HardDrive, MoreVertical, 
  ArrowUp, ArrowDown, RefreshCw, AlertCircle,
  CheckCircle, Clock, Calendar, DollarSign,
  Shield, Zap, Server, Cpu, Activity,
  Eye, Edit, Trash2, Plus, Filter,
  Search, Download, Printer, Share2,
  TrendingUp, TrendingDown, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { serviceService } from '@/services/firebase/firestore.service';
import { 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Service } from '@/types/models';

interface ServiceWithStats extends Service {
  daysRemaining: number | null;
  usagePercentage: number;
  isExpiring: boolean;
}

export function ServiceManagement() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<ServiceWithStats[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceWithStats[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceWithStats | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    expiring: 0,
    suspended: 0,
    cancelled: 0,
  });

  // Load services
  const loadServices = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const servicesData = await serviceService.query([
        where('customerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      ]);

      const now = new Date();
      const enrichedServices: ServiceWithStats[] = servicesData.map(service => {
        const endDate = service.endDate?.toDate() || null;
        const daysRemaining = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const isExpiring = daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0;
        const usagePercentage = service.storageDays ? Math.min((service.storageDays / 30) * 100, 100) : 0;

        return {
          ...service,
          daysRemaining,
          usagePercentage,
          isExpiring: isExpiring || false,
        };
      });

      setServices(enrichedServices);

      // Calculate stats
      const active = enrichedServices.filter(s => s.status === 'active');
      const pending = enrichedServices.filter(s => s.status === 'pending');
      const expiring = enrichedServices.filter(s => s.isExpiring);
      const suspended = enrichedServices.filter(s => s.status === 'suspended');
      const cancelled = enrichedServices.filter(s => s.status === 'cancelled');

      setStats({
        total: enrichedServices.length,
        active: active.length,
        pending: pending.length,
        expiring: expiring.length,
        suspended: suspended.length,
        cancelled: cancelled.length,
      });

      firebaseUtils.logEvent('service_management_viewed', {
        userId: user.uid,
        totalServices: enrichedServices.length,
        activeServices: active.length,
      });

    } catch (error) {
      console.error('Error loading services:', error);
      firebaseUtils.logEvent('service_management_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter services
  useEffect(() => {
    let filtered = [...services];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.customerName?.toLowerCase().includes(query) ||
        s.id?.toLowerCase().includes(query) ||
        s.type?.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'expiring') {
        filtered = filtered.filter(s => s.isExpiring);
      } else {
        filtered = filtered.filter(s => s.status === statusFilter);
      }
    }

    setFilteredServices(filtered);
  }, [services, searchQuery, statusFilter]);

  // Initial load
  useEffect(() => {
    loadServices();

    // Real-time updates
    const servicesUnsub = serviceService.listenAll(() => {
      loadServices();
    });

    return () => servicesUnsub();
  }, [loadServices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadServices();
  };

  const handleRenew = async (serviceId: string) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'services', serviceId), {
        status: 'active',
        updatedAt: Timestamp.now(),
        // Extend end date by 30 days
        endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      });

      firebaseUtils.logEvent('service_renewed', { serviceId });
      setSuccessMessage('Service renewed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadServices();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to renew service');
      console.error('Error renewing service:', error);
    }
  };

  const handleUpgrade = async (serviceId: string, plan: string) => {
    if (!user) return;

    try {
      // In production, this would upgrade the service plan
      await updateDoc(doc(db, 'services', serviceId), {
        plan: plan,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('service_upgraded', { serviceId, plan });
      setSuccessMessage(`Service upgraded to ${plan}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setUpgradeModalOpen(false);
      await loadServices();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to upgrade service');
      console.error('Error upgrading service:', error);
    }
  };

  const handleCancel = async (serviceId: string) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'services', serviceId), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('service_cancelled', { serviceId });
      setSuccessMessage('Service cancelled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setCancelModalOpen(false);
      await loadServices();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to cancel service');
      console.error('Error cancelling service:', error);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) return;

    try {
      await deleteDoc(doc(db, 'services', serviceId));
      
      firebaseUtils.logEvent('service_deleted', { serviceId });
      setSuccessMessage('Service deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadServices();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete service');
      console.error('Error deleting service:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cctv': return <Camera className="w-5 h-5 text-blue-400" />;
      case 'internet': return <Wifi className="w-5 h-5 text-emerald-400" />;
      case 'both': return (
        <div className="flex gap-1">
          <Camera className="w-4 h-4 text-blue-400" />
          <Wifi className="w-4 h-4 text-emerald-400" />
        </div>
      );
      default: return <Shield className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getStatusColor = (status: string, isExpiring: boolean) => {
    if (isExpiring) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'suspended': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'cancelled': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Services</h1>
          <p className="text-neutral-400 mt-1">Manage your active subscriptions and services</p>
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
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-neutral-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-400">{stats.active}</p>
            <p className="text-xs text-neutral-400">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{stats.pending}</p>
            <p className="text-xs text-neutral-400">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-400">{stats.expiring}</p>
            <p className="text-xs text-neutral-400">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-400">{stats.suspended}</p>
            <p className="text-xs text-neutral-400">Suspended</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-neutral-400">{stats.cancelled}</p>
            <p className="text-xs text-neutral-400">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search services by name or ID..."
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
              <option value="pending">Pending</option>
              <option value="expiring">Expiring Soon</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button 
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <div className="space-y-4">
        {filteredServices.length > 0 ? (
          filteredServices.map((service) => (
            <Card key={service.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  {/* Left Section */}
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      {getTypeIcon(service.type)}
                      <h3 className="text-lg font-semibold text-white">
                        {service.customerName || service.id}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(service.status, service.isExpiring)}`}>
                        {service.isExpiring ? 'Expiring Soon' : service.status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-neutral-500 mb-2">
                      Service ID: {service.id}
                    </p>
                    
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Calendar className="w-4 h-4 text-neutral-500" />
                        Started: {service.startDate.toDate().toLocaleDateString()}
                      </span>
                      {service.endDate && (
                        <span className="flex items-center gap-1 text-neutral-400">
                          <Clock className="w-4 h-4 text-neutral-500" />
                          {service.daysRemaining !== null && service.daysRemaining > 0 
                            ? `${service.daysRemaining} days remaining` 
                            : service.daysRemaining === 0 
                              ? 'Expires today' 
                              : 'Expired'}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-neutral-400">
                        <DollarSign className="w-4 h-4 text-neutral-500" />
                        <Currency amount={service.price} />/month
                      </span>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {service.cameraCount && (
                        <span className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-0.5 rounded">
                          {service.cameraCount} Cameras
                        </span>
                      )}
                      {service.storageDays && (
                        <span className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-0.5 rounded">
                          {service.storageDays} Days Storage
                        </span>
                      )}
                      {service.monitoringType && (
                        <span className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-0.5 rounded">
                          {service.monitoringType} Monitoring
                        </span>
                      )}
                    </div>
                    
                    {/* Usage Stats */}
                    {service.cameraCount && (
                      <div className="mt-4 p-3 bg-neutral-800/30 rounded-lg">
                        <p className="text-sm font-medium text-neutral-300 mb-2">Usage Statistics</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {service.cameraCount && (
                            <div>
                              <span className="text-neutral-500">Cameras:</span>
                              <span className="ml-2 font-medium text-white">{service.cameraCount} active</span>
                            </div>
                          )}
                          {service.storageDays && (
                            <div className="col-span-2">
                              <span className="text-neutral-500">Storage:</span>
                              <span className="ml-2 font-medium text-white">{service.storageDays} days</span>
                              <div className="w-full h-1 bg-neutral-700 rounded-full mt-1">
                                <div 
                                  className="h-1 bg-lime-400 rounded-full transition-all" 
                                  style={{ width: `${Math.min(service.usagePercentage, 100)}%` }} 
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap lg:flex-col gap-2 min-w-[120px]">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedService(service);
                        setDetailsModalOpen(true);
                      }}
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                    
                    {service.status === 'active' && !service.isExpiring && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setSelectedService(service);
                            setUpgradeModalOpen(true);
                          }}
                          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />
                          Upgrade
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRenew(service.id)}
                          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Renew
                        </Button>
                      </>
                    )}
                    
                    {(service.status === 'active' || service.isExpiring) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setSelectedService(service);
                          setCancelModalOpen(true);
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-12 text-center">
              <Shield className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No services found</p>
              <p className="text-sm text-neutral-500">Get started by adding a service</p>
              <Button className="mt-4 bg-lime-400 text-black hover:bg-lime-300">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Service Details Modal */}
      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Service Details" size="lg">
        {selectedService && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedService.type)}
                  <h3 className="text-xl font-bold text-white">{selectedService.customerName || selectedService.id}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedService.status, selectedService.isExpiring)}`}>
                    {selectedService.isExpiring ? 'Expiring Soon' : selectedService.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-400 mt-1">ID: {selectedService.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Type</p>
                <p className="text-white capitalize">{selectedService.type}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Price</p>
                <p className="text-white"><Currency amount={selectedService.price} />/month</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Start Date</p>
                <p className="text-white">{selectedService.startDate.toDate().toLocaleDateString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">End Date</p>
                <p className="text-white">
                  {selectedService.endDate?.toDate().toLocaleDateString() || 'N/A'}
                  {selectedService.daysRemaining !== null && selectedService.daysRemaining > 0 && (
                    <span className="text-sm text-neutral-400 ml-2">({selectedService.daysRemaining} days left)</span>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Address</p>
              <p className="text-white">{selectedService.address || 'N/A'}</p>
            </div>

            {selectedService.notes && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Notes</p>
                <p className="text-white bg-neutral-800/30 p-3 rounded-lg">{selectedService.notes}</p>
              </div>
            )}

            <div className="border-t border-neutral-800 pt-4 flex flex-wrap gap-3">
              {selectedService.status === 'active' && !selectedService.isExpiring && (
                <>
                  <Button 
                    onClick={() => {
                      setDetailsModalOpen(false);
                      setUpgradeModalOpen(true);
                    }}
                    className="bg-lime-400 text-black hover:bg-lime-300"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleRenew(selectedService.id)}
                    className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Renew Service
                  </Button>
                </>
              )}
              {(selectedService.status === 'active' || selectedService.isExpiring) && (
                <Button 
                  variant="outline" 
                  className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setCancelModalOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel Service
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Upgrade Modal */}
      <Modal isOpen={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} title="Upgrade Service Plan">
        <div className="space-y-4">
          <p className="text-neutral-400">Choose a plan that better suits your needs:</p>
          <div className="space-y-3">
            <div className="border border-neutral-700 rounded-lg p-4 cursor-pointer hover:border-lime-400/50 transition bg-neutral-800/30">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Professional Plus</p>
                  <p className="text-sm text-neutral-400">16 cameras, 60 day storage, priority support</p>
                </div>
                <Currency amount={1499} className="font-bold text-lime-400" />
              </div>
            </div>
            <div className="border border-lime-400/50 rounded-lg p-4 cursor-pointer hover:border-lime-400 transition bg-lime-400/5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Enterprise</p>
                  <p className="text-sm text-neutral-400">Unlimited cameras, 90 day storage, dedicated support</p>
                </div>
                <Currency amount={2499} className="font-bold text-lime-400" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setUpgradeModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleUpgrade(selectedService?.id || '', 'Enterprise')}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              Confirm Upgrade
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Service">
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-400">Service will be deactivated</p>
                <p className="text-sm text-yellow-400/70 mt-1">
                  Cancelling this service will stop all monitoring and access. 
                  You will lose access to all recorded footage after 7 days.
                </p>
              </div>
            </div>
          </div>
          <p className="text-neutral-400">Are you sure you want to cancel this service?</p>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setCancelModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Keep Service
            </Button>
            <Button 
              variant="danger" 
              onClick={() => handleCancel(selectedService?.id || '')}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Yes, Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ServiceManagement;