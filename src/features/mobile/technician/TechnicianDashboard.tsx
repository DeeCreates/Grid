// src/features/mobile/technician/TechnicianDashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, MapPin, CheckCircle, Clock, 
  Camera, Package, Navigation, Phone, MessageCircle,
  RefreshCw, AlertTriangle, Wifi, HardDrive,
  User, Building, ChevronRight, Star,
  Battery, Signal, Wrench, Settings,
  ClipboardList, Truck, Shield, Zap,
  MoreVertical, Eye, Edit, Trash2, XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Booking, Equipment } from '@/types/models';

interface Job extends Booking {
  items: string[];
  estimatedDuration: number;
  customerPhone: string;
  customerEmail: string;
}

export function TechnicianDashboard() {
  const { user, userProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    total: 0,
  });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetailsModalOpen, setJobDetailsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Location error:', error);
        }
      );
    }
  }, []);

  // Load technician jobs
  const loadJobs = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get bookings assigned to this technician
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('assignedTo', 'array-contains', user.uid),
        orderBy('scheduledDate', 'asc')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
      const jobsData = bookingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          scheduledDate: data.scheduledDate?.toDate() || new Date(),
          items: data.checklist?.map((c: any) => c.item) || [],
          estimatedDuration: data.duration || 60,
          customerPhone: data.customerPhone || '',
          customerEmail: data.customerEmail || '',
        } as Job;
      });

      setJobs(jobsData);
      setFilteredJobs(jobsData);

      // Calculate stats
      const pending = jobsData.filter(j => j.status === 'pending' || j.status === 'confirmed').length;
      const inProgress = jobsData.filter(j => j.status === 'inProgress').length;
      const completed = jobsData.filter(j => j.status === 'completed').length;

      setStats({
        pending,
        inProgress,
        completed,
        total: jobsData.length,
      });

      // Update technician status
      if (userProfile) {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: serverTimestamp(),
          currentLocation: currentLocation ? {
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            updatedAt: serverTimestamp(),
          } : null,
        });
      }

      firebaseUtils.logEvent('technician_dashboard_viewed', {
        userId: user.uid,
        totalJobs: jobsData.length,
        pendingJobs: pending,
      });

    } catch (error) {
      console.error('Error loading jobs:', error);
      firebaseUtils.logEvent('technician_dashboard_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userProfile, currentLocation]);

  // Filter jobs
  useEffect(() => {
    if (filter === 'all') {
      setFilteredJobs(jobs);
    } else {
      setFilteredJobs(jobs.filter(j => j.status === filter));
    }
  }, [jobs, filter]);

  // Initial load and real-time updates
  useEffect(() => {
    loadJobs();

    const bookingsUnsub = onSnapshot(
      query(collection(db, 'bookings'), where('assignedTo', 'array-contains', user?.uid)),
      () => loadJobs()
    );

    return () => bookingsUnsub();
  }, [loadJobs, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
  };

  const startJob = async (jobId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', jobId), {
        status: 'inProgress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('job_started', {
        jobId,
        technicianId: user?.uid,
      });

      setSuccessMessage('Job started successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadJobs();

    } catch (error: any) {
      setErrorMessage('Failed to start job');
      console.error('Error starting job:', error);
    }
  };

  const completeJob = async (jobId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', jobId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('job_completed', {
        jobId,
        technicianId: user?.uid,
      });

      setSuccessMessage('Job completed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadJobs();

    } catch (error: any) {
      setErrorMessage('Failed to complete job');
      console.error('Error completing job:', error);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;

    try {
      await updateDoc(doc(db, 'bookings', jobId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('job_cancelled', {
        jobId,
        technicianId: user?.uid,
      });

      setSuccessMessage('Job cancelled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadJobs();

    } catch (error: any) {
      setErrorMessage('Failed to cancel job');
      console.error('Error cancelling job:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'installation': return <Camera className="w-5 h-5 text-blue-400" />;
      case 'maintenance': return <Wrench className="w-5 h-5 text-emerald-400" />;
      case 'repair': return <Wrench className="w-5 h-5 text-yellow-400" />;
      case 'retrieval': return <Truck className="w-5 h-5 text-purple-400" />;
      default: return <Package className="w-5 h-5 text-neutral-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-lime-400 to-emerald-400 text-black p-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl font-bold">Technician Portal</h1>
            <p className="text-black/80">Welcome back, {userProfile?.displayName || 'Technician'}</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-black/20 p-2 rounded-full hover:bg-black/30 transition">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="bg-black/20 p-2 rounded-full hover:bg-black/30 transition">
              <Phone className="w-5 h-5" />
            </button>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-black/20 p-2 rounded-full hover:bg-black/30 transition"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {currentLocation && (
          <div className="flex items-center gap-1 text-xs text-black/80 mt-2">
            <MapPin className="w-3 h-3" />
            <span>Live location tracking active</span>
            <span className="ml-2 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mx-4 mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-400">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-xs text-neutral-400">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
              <p className="text-xs text-neutral-400">In Progress</p>
            </CardContent>
          </Card>
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
              <p className="text-xs text-neutral-400">Completed</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-1">
          {(['all', 'pending', 'in-progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                filter === f 
                  ? 'bg-lime-400 text-black' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Today's Jobs */}
      <div className="px-4">
        <h2 className="font-semibold text-white mb-3">Today's Schedule</h2>
        <div className="space-y-3">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <Card key={job.id} className={`bg-[#161616] border-neutral-800 transition hover:border-lime-400/30 ${job.status === 'completed' ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(job.type)}
                      <span className="font-semibold text-white capitalize">{job.type}</span>
                      <StatusBadge status={job.status as any} />
                    </div>
                    <div className="flex items-center gap-1 text-sm text-neutral-400">
                      <Clock className="w-4 h-4" />
                      {job.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <p className="font-medium text-white">{job.customerName}</p>
                  <div className="flex items-center gap-1 text-sm text-neutral-400 mt-1">
                    <MapPin className="w-4 h-4" />
                    {job.location?.address || 'Address not provided'}
                  </div>

                  {job.items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-neutral-400 mb-1">Items:</p>
                      <div className="flex flex-wrap gap-1">
                        {job.items.slice(0, 4).map((item, i) => (
                          <span key={i} className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-1 rounded">{item}</span>
                        ))}
                        {job.items.length > 4 && (
                          <span className="text-xs text-neutral-500">+{job.items.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    {job.status === 'pending' || job.status === 'confirmed' ? (
                      <Button 
                        onClick={() => startJob(job.id)}
                        className="flex-1 bg-lime-400 text-black hover:bg-lime-300"
                      >
                        Start Job
                      </Button>
                    ) : job.status === 'inProgress' ? (
                      <>
                        <Button 
                          variant="outline" 
                          className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                          onClick={() => {
                            // Open map directions
                            window.open(`https://maps.google.com/?q=${encodeURIComponent(job.location?.address || '')}`, '_blank');
                          }}
                        >
                          <Navigation className="w-4 h-4 mr-1" />
                          Directions
                        </Button>
                        <Button 
                          onClick={() => completeJob(job.id)}
                          className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      </>
                    ) : job.status === 'completed' ? (
                      <Button 
                        variant="outline" 
                        className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        onClick={() => {
                          setSelectedJob(job);
                          setJobDetailsModalOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    ) : null}
                    {job.status !== 'completed' && job.status !== 'cancelled' && (
                      <Button 
                        variant="ghost" 
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => cancelJob(job.id)}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-[#161616] border-neutral-800">
              <CardContent className="p-8 text-center">
                <ClipboardList className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400">No jobs scheduled</p>
                <p className="text-sm text-neutral-500">Check back later for assignments</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161616] border-t border-neutral-800 flex justify-around py-3">
        <button className="text-lime-400">
          <Calendar className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Jobs</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <Package className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Equipment</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <MapPin className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Route</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <Camera className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Scan</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <Settings className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Settings</span>
        </button>
      </div>

      {/* Job Details Modal (Add this if needed) */}
      {jobDetailsModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161616] border border-neutral-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-white">Job Details</h3>
                <button 
                  onClick={() => setJobDetailsModalOpen(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-neutral-400">Customer</p>
                  <p className="text-white font-medium">{selectedJob.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Address</p>
                  <p className="text-white">{selectedJob.location?.address}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Type</p>
                  <p className="text-white capitalize">{selectedJob.type}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Status</p>
                  <StatusBadge status={selectedJob.status as any} />
                </div>
                {selectedJob.items.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-400">Items</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedJob.items.map((item, i) => (
                        <span key={i} className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-1 rounded">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  onClick={() => setJobDetailsModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicianDashboard;