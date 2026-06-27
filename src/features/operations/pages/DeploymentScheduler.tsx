// src/features/operations/pages/DeploymentScheduler.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon, MapPin, User, Clock, CheckCircle,
  XCircle, Truck, Navigation, Phone, Mail, Plus, Filter,
  UserPlus, AlertCircle, RefreshCw, Eye, Edit, Trash2,
  ArrowLeft, ArrowRight, Calendar, List, Grid, Package,
  Play, Save, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  bookingService, 
  serviceService,
  equipmentService 
} from '@/services/firebase/firestore.service';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  Timestamp,
  onSnapshot,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Booking, Service, Equipment } from '@/types/models';

interface Technician {
  id: string;
  name: string;
  phone: string;
  email: string;
  skills: string[];
  isAvailable: boolean;
  currentJobId?: string;
  rating: number;
}

export function DeploymentScheduler() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deployments, setDeployments] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Booking | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });

  // New Deployment Modal State
  const [newDeploymentModalOpen, setNewDeploymentModalOpen] = useState(false);
  const [newDeployment, setNewDeployment] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    address: '',
    serviceType: 'installation' as 'installation' | 'maintenance' | 'repair' | 'retrieval',
    scheduledDate: '',
    scheduledTime: '',
    duration: 60,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    notes: '',
    items: [] as string[],
    newItem: '',
  });
  const [customers, setCustomers] = useState<{id: string; name: string; phone: string; email: string}[]>([]);

  // Load customers for dropdown
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const usersSnapshot = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'customer')
        ));
        const customersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().displayName || 'Unknown',
          phone: doc.data().phoneNumber || '',
          email: doc.data().email || '',
        }));
        setCustomers(customersData);
      } catch (error) {
        console.error('Error loading customers:', error);
      }
    };
    loadCustomers();
  }, []);

  // Load deployments
  const loadDeployments = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all bookings
      const bookings = await bookingService.getAll();
      
      // Get technicians (users with role 'technician')
      const usersSnapshot = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'technician')
      ));
      const techs = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isAvailable: true,
        rating: 4.5,
      })) as Technician[];
      setTechnicians(techs);

      // Filter deployments for selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dayDeployments = bookings.filter(b => {
        const date = b.scheduledDate.toDate();
        return date >= startOfDay && date <= endOfDay;
      });

      setDeployments(dayDeployments);

      // Calculate stats for the day
      setStats({
        total: dayDeployments.length,
        scheduled: dayDeployments.filter(d => d.status === 'pending' || d.status === 'confirmed').length,
        inProgress: dayDeployments.filter(d => d.status === 'inProgress').length,
        completed: dayDeployments.filter(d => d.status === 'completed').length,
        cancelled: dayDeployments.filter(d => d.status === 'cancelled').length,
      });

      // Log analytics
      firebaseUtils.logEvent('deployment_scheduler_viewed', {
        userId: user?.uid,
        date: selectedDate.toISOString(),
        deployments: dayDeployments.length,
      });

    } catch (error) {
      console.error('Error loading deployments:', error);
      firebaseUtils.logEvent('deployment_scheduler_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedDate]);

  // Initial load
  useEffect(() => {
    loadDeployments();

    // Real-time updates for bookings
    const bookingsUnsub = bookingService.listenAll(() => {
      loadDeployments();
    });

    return () => {
      bookingsUnsub();
    };
  }, [loadDeployments]);

  // Handle creating a new deployment
  const handleCreateDeployment = async () => {
    // Validate form
    if (!newDeployment.customerName || !newDeployment.address || !newDeployment.scheduledDate || !newDeployment.scheduledTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Find customer ID from selected customer
      const selectedCustomer = customers.find(c => c.name === newDeployment.customerName);
      
      // Create booking in Firestore
      const bookingData = {
        customerId: selectedCustomer?.id || 'unknown',
        customerName: newDeployment.customerName,
        customerPhone: newDeployment.customerPhone || selectedCustomer?.phone || '',
        customerEmail: newDeployment.customerEmail || selectedCustomer?.email || '',
        type: newDeployment.serviceType,
        status: 'pending' as const,
        scheduledDate: Timestamp.fromDate(new Date(`${newDeployment.scheduledDate}T${newDeployment.scheduledTime}`)),
        scheduledWindow: {
          start: newDeployment.scheduledTime,
          end: new Date(new Date(`${newDeployment.scheduledDate}T${newDeployment.scheduledTime}`).getTime() + newDeployment.duration * 60000).toTimeString().slice(0, 5),
        },
        duration: newDeployment.duration,
        assignedTo: [],
        location: {
          address: newDeployment.address,
        },
        priority: newDeployment.priority,
        notes: newDeployment.notes,
        checklist: newDeployment.items.map(item => ({
          item,
          completed: false,
        })),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'bookings'), bookingData);

      firebaseUtils.logEvent('deployment_created', {
        type: newDeployment.serviceType,
        priority: newDeployment.priority,
      });

      // Reset form and close modal
      setNewDeployment({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        address: '',
        serviceType: 'installation',
        scheduledDate: '',
        scheduledTime: '',
        duration: 60,
        priority: 'medium',
        notes: '',
        items: [],
        newItem: '',
      });
      setNewDeploymentModalOpen(false);
      
      // Reload deployments
      await loadDeployments();

      // Show success message
      alert('Deployment created successfully!');

    } catch (error) {
      console.error('Error creating deployment:', error);
      alert('Failed to create deployment. Please try again.');
    }
  };

  const addItem = () => {
    if (newDeployment.newItem.trim()) {
      setNewDeployment({
        ...newDeployment,
        items: [...newDeployment.items, newDeployment.newItem.trim()],
        newItem: '',
      });
    }
  };

  const removeItem = (index: number) => {
    setNewDeployment({
      ...newDeployment,
      items: newDeployment.items.filter((_, i) => i !== index),
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeployments();
  };

  const handleAssignTechnician = async (deploymentId: string, technicianId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', deploymentId), {
        assignedTo: [technicianId],
        status: 'confirmed',
        updatedAt: Timestamp.now(),
      });

      // Update technician availability
      await updateDoc(doc(db, 'users', technicianId), {
        isAvailable: false,
        currentJobId: deploymentId,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('technician_assigned', {
        deploymentId,
        technicianId,
      });

      await loadDeployments();
      setAssignModalOpen(false);
      
      // Show success message
      // toast.success('Technician assigned successfully');
    } catch (error) {
      console.error('Error assigning technician:', error);
      // toast.error('Failed to assign technician');
    }
  };

  const handleStartJob = async (deploymentId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', deploymentId), {
        status: 'inProgress',
        updatedAt: Timestamp.now(),
      });
      
      firebaseUtils.logEvent('job_started', { deploymentId });
      await loadDeployments();
    } catch (error) {
      console.error('Error starting job:', error);
    }
  };

  const handleCompleteJob = async (deploymentId: string) => {
    try {
      const deployment = deployments.find(d => d.id === deploymentId);
      
      await updateDoc(doc(db, 'bookings', deploymentId), {
        status: 'completed',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Free up the technician
      if (deployment?.assignedTo && deployment.assignedTo.length > 0) {
        await updateDoc(doc(db, 'users', deployment.assignedTo[0]), {
          isAvailable: true,
          currentJobId: null,
          updatedAt: Timestamp.now(),
        });
      }

      firebaseUtils.logEvent('job_completed', { deploymentId });
      await loadDeployments();
    } catch (error) {
      console.error('Error completing job:', error);
    }
  };

  const handleCancelJob = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to cancel this deployment?')) return;
    
    try {
      const deployment = deployments.find(d => d.id === deploymentId);
      
      await updateDoc(doc(db, 'bookings', deploymentId), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });

      // Free up the technician
      if (deployment?.assignedTo && deployment.assignedTo.length > 0) {
        await updateDoc(doc(db, 'users', deployment.assignedTo[0]), {
          isAvailable: true,
          currentJobId: null,
          updatedAt: Timestamp.now(),
        });
      }

      firebaseUtils.logEvent('job_cancelled', { deploymentId });
      await loadDeployments();
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  const handleOptimizeRoutes = async () => {
    firebaseUtils.logEvent('routes_optimized', {
      deployments: deployments.length,
    });
    alert('Optimizing routes... (This would use Google Maps API)');
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'installation': return <Truck className="w-5 h-5 text-lime-400" />;
      case 'maintenance': return <Clock className="w-5 h-5 text-emerald-400" />;
      case 'repair': return <CheckCircle className="w-5 h-5 text-amber-400" />;
      case 'retrieval': return <Package className="w-5 h-5 text-blue-400" />;
      default: return <Truck className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading deployments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Deployment Scheduler</h1>
          <p className="text-neutral-400 mt-1">Schedule and manage field service deployments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="bg-neutral-800/50 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm transition ${
                viewMode === 'list' 
                  ? 'bg-lime-400 text-black' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              <List className="w-4 h-4 inline mr-1" />
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded-md text-sm transition ${
                viewMode === 'calendar' 
                  ? 'bg-lime-400 text-black' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              <Grid className="w-4 h-4 inline mr-1" />
              Calendar
            </button>
          </div>
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
            onClick={handleOptimizeRoutes}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Optimize Routes
          </Button>
          <Button 
            onClick={() => setNewDeploymentModalOpen(true)}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Total</p>
            <p className="text-xl font-bold text-white">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Scheduled</p>
            <p className="text-xl font-bold text-blue-400">{stats.scheduled}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">In Progress</p>
            <p className="text-xl font-bold text-yellow-400">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Completed</p>
            <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Cancelled</p>
            <p className="text-xl font-bold text-red-400">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigator */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => changeDate(-1)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold text-white">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-neutral-400">
                {deployments.length} deployments scheduled
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => changeDate(1)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deployments List */}
      <div className="space-y-4">
        {deployments.length > 0 ? (
          deployments.map((deployment) => (
            <Card key={deployment.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                  {/* Left Section */}
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      {getServiceIcon(deployment.type)}
                      <h3 className="text-lg font-semibold text-white capitalize">
                        {deployment.type} - {deployment.customerName}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(deployment.priority || 'medium')}`}>
                        {(deployment.priority || 'medium').toUpperCase()}
                      </span>
                      <StatusBadge status={deployment.status as any} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <MapPin className="w-4 h-4 text-neutral-500" />
                        {deployment.location.address}
                      </div>
                      <div className="flex items-center gap-2 text-neutral-400">
                        <Clock className="w-4 h-4 text-neutral-500" />
                        {deployment.scheduledDate.toDate().toLocaleTimeString()} ({deployment.duration || 60} min)
                      </div>
                      <div className="flex items-center gap-2 text-neutral-400">
                        <Phone className="w-4 h-4 text-neutral-500" />
                        {deployment.customerPhone || 'N/A'}
                      </div>
                    </div>

                    {deployment.checklist && deployment.checklist.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {deployment.checklist.map((item, i) => (
                          <span key={i} className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-1 rounded">
                            {item.completed ? '✓' : '○'} {item.item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Section - Actions */}
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    {deployment.assignedTo && deployment.assignedTo.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 text-sm bg-neutral-800/50 p-2 rounded">
                          <User className="w-4 h-4 text-lime-400" />
                          <span className="text-white">
                            {technicians.find(t => t.id === deployment.assignedTo?.[0])?.name || 'Assigned'}
                          </span>
                        </div>
                        {deployment.status === 'pending' || deployment.status === 'confirmed' && (
                          <Button 
                            onClick={() => handleStartJob(deployment.id)}
                            className="bg-lime-400 text-black hover:bg-lime-300"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Start Job
                          </Button>
                        )}
                        {deployment.status === 'inProgress' && (
                          <>
                            <Button 
                              variant="outline"
                              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                            >
                              <Navigation className="w-4 h-4 mr-1" />
                              View Route
                            </Button>
                            <Button 
                              onClick={() => handleCompleteJob(deployment.id)}
                              className="bg-emerald-500 text-white hover:bg-emerald-600"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      <Button 
                        onClick={() => {
                          setSelectedDeployment(deployment);
                          setAssignModalOpen(true);
                        }}
                        className="bg-lime-400 text-black hover:bg-lime-300"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Assign Technician
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedDeployment(deployment)}
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {deployment.status !== 'completed' && deployment.status !== 'cancelled' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCancelJob(deployment.id)}
                          className="border-red-700/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-12 text-center">
              <CalendarIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No deployments scheduled for this day</p>
              <Button 
                variant="outline" 
                className="mt-4 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                onClick={() => setNewDeploymentModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Deployment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Deployment Modal */}
      <Modal 
        isOpen={newDeploymentModalOpen} 
        onClose={() => setNewDeploymentModalOpen(false)} 
        title="Schedule New Deployment"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          {/* Customer Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white border-b border-neutral-800 pb-2">Customer Information</h4>
            
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Customer *</label>
              <select
                value={newDeployment.customerName}
                onChange={(e) => {
                  const customer = customers.find(c => c.name === e.target.value);
                  setNewDeployment({
                    ...newDeployment,
                    customerName: e.target.value,
                    customerPhone: customer?.phone || '',
                    customerEmail: customer?.email || '',
                  });
                }}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.name}>
                    {customer.name} - {customer.email}
                  </option>
                ))}
                <option value="new">+ Add New Customer</option>
              </select>
            </div>

            {newDeployment.customerName === 'new' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-800/30 rounded-lg border border-neutral-700">
                <Input
                  label="Customer Name *"
                  value={newDeployment.customerName === 'new' ? '' : newDeployment.customerName}
                  onChange={(e) => setNewDeployment({ ...newDeployment, customerName: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white"
                />
                <Input
                  label="Phone"
                  value={newDeployment.customerPhone}
                  onChange={(e) => setNewDeployment({ ...newDeployment, customerPhone: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white"
                />
                <Input
                  label="Email"
                  type="email"
                  value={newDeployment.customerEmail}
                  onChange={(e) => setNewDeployment({ ...newDeployment, customerEmail: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white col-span-2"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Address *</label>
              <Input
                value={newDeployment.address}
                onChange={(e) => setNewDeployment({ ...newDeployment, address: e.target.value })}
                placeholder="Enter full address"
                className="bg-neutral-900/50 border-neutral-800 text-white"
                icon={<MapPin className="w-4 h-4 text-neutral-500" />}
              />
            </div>
          </div>

          {/* Service Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white border-b border-neutral-800 pb-2">Service Details</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Service Type *</label>
                <select
                  value={newDeployment.serviceType}
                  onChange={(e) => setNewDeployment({ ...newDeployment, serviceType: e.target.value as any })}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
                >
                  <option value="installation">Installation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="repair">Repair</option>
                  <option value="retrieval">Retrieval</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Priority</label>
                <select
                  value={newDeployment.priority}
                  onChange={(e) => setNewDeployment({ ...newDeployment, priority: e.target.value as any })}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Date *</label>
                <Input
                  type="date"
                  value={newDeployment.scheduledDate}
                  onChange={(e) => setNewDeployment({ ...newDeployment, scheduledDate: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white"
                  icon={<CalendarIcon className="w-4 h-4 text-neutral-500" />}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Time *</label>
                <Input
                  type="time"
                  value={newDeployment.scheduledTime}
                  onChange={(e) => setNewDeployment({ ...newDeployment, scheduledTime: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white"
                  icon={<Clock className="w-4 h-4 text-neutral-500" />}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Estimated Duration (minutes)</label>
              <Input
                type="number"
                value={newDeployment.duration}
                onChange={(e) => setNewDeployment({ ...newDeployment, duration: parseInt(e.target.value) || 60 })}
                className="bg-neutral-900/50 border-neutral-800 text-white"
                min="15"
                step="15"
              />
            </div>
          </div>

          {/* Items/Checklist */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white border-b border-neutral-800 pb-2">Checklist Items</h4>
            
            <div className="flex gap-2">
              <Input
                value={newDeployment.newItem}
                onChange={(e) => setNewDeployment({ ...newDeployment, newItem: e.target.value })}
                placeholder="Add item (e.g., 4x Cameras)"
                className="bg-neutral-900/50 border-neutral-800 text-white flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button 
                onClick={addItem}
                className="bg-lime-400 text-black hover:bg-lime-300"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {newDeployment.items.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {newDeployment.items.map((item, index) => (
                  <span 
                    key={index}
                    className="flex items-center gap-1 text-xs bg-neutral-800/50 text-neutral-300 px-2 py-1 rounded"
                  >
                    {item}
                    <button 
                      onClick={() => removeItem(index)}
                      className="text-neutral-500 hover:text-red-400 transition"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Notes</label>
            <textarea
              value={newDeployment.notes}
              onChange={(e) => setNewDeployment({ ...newDeployment, notes: e.target.value })}
              rows={3}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Any special instructions or notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setNewDeploymentModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleCreateDeployment}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Schedule Deployment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Technician Modal */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Technician">
        {selectedDeployment && (
          <div className="space-y-4">
            <div className="bg-neutral-800/50 p-3 rounded-lg">
              <p className="font-medium text-white">{selectedDeployment.customerName}</p>
              <p className="text-sm text-neutral-400">{selectedDeployment.location.address}</p>
              <p className="text-sm text-neutral-400 mt-1">
                Service: {selectedDeployment.type} • Duration: {selectedDeployment.duration || 60} min
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-white">Available Technicians</p>
              {technicians.filter(t => t.isAvailable).length > 0 ? (
                technicians.filter(t => t.isAvailable).map((tech) => (
                  <div key={tech.id} className="flex items-center justify-between p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg hover:border-lime-400/30 transition">
                    <div>
                      <p className="font-medium text-white">{tech.name}</p>
                      <p className="text-sm text-neutral-400">{tech.skills.join(', ')}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-yellow-400">★</span>
                        <span className="text-xs text-neutral-400">{tech.rating || 4.5}</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleAssignTechnician(selectedDeployment.id, tech.id)}
                      className="bg-lime-400 text-black hover:bg-lime-300"
                    >
                      Assign
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-neutral-400 text-center py-4">No available technicians</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-800">
              <Button 
                variant="outline" 
                onClick={() => setAssignModalOpen(false)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DeploymentScheduler;