// src/features/mobile/technician/TechnicianJobs.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, MapPin, CheckCircle, Navigation, Phone,
  RefreshCw, Search, Filter, Calendar,
  User, Building, AlertTriangle, Eye,
  ChevronRight, MoreVertical, MessageCircle,
  Star, Award, ClipboardList, 
  Wrench, Camera, Package, Truck,
  XCircle, Check, Play, Pause, Settings
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
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
import type { Booking } from '@/types/models';

interface TechnicianJob extends Booking {
  items: string[];
  estimatedDuration: number;
  customerPhone: string;
  customerEmail: string;
  distance?: number;
  travelTime?: number;
}

export function TechnicianJobs() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<TechnicianJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<TechnicianJob[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<TechnicianJob | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });

  // Load jobs
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
          distance: Math.floor(Math.random() * 20) + 1, // Simulated distance
          travelTime: Math.floor(Math.random() * 30) + 5, // Simulated travel time
        } as TechnicianJob;
      });

      setJobs(jobsData);

      // Calculate stats
      const pending = jobsData.filter(j => j.status === 'pending' || j.status === 'confirmed').length;
      const inProgress = jobsData.filter(j => j.status === 'inProgress').length;
      const completed = jobsData.filter(j => j.status === 'completed').length;
      const cancelled = jobsData.filter(j => j.status === 'cancelled').length;

      setStats({
        total: jobsData.length,
        pending,
        inProgress,
        completed,
        cancelled,
      });

      firebaseUtils.logEvent('technician_jobs_viewed', {
        userId: user.uid,
        totalJobs: jobsData.length,
        pendingJobs: pending,
      });

    } catch (error) {
      console.error('Error loading jobs:', error);
      firebaseUtils.logEvent('technician_jobs_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter jobs
  useEffect(() => {
    let filtered = [...jobs];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(j => 
        j.customerName?.toLowerCase().includes(query) ||
        j.id?.toLowerCase().includes(query) ||
        j.type?.toLowerCase().includes(query) ||
        j.location?.address?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(j => j.status === statusFilter);
    }

    setFilteredJobs(filtered);
  }, [jobs, searchQuery, statusFilter]);

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
      default: return <ClipboardList className="w-5 h-5 text-neutral-400" />;
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
    <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">My Jobs</h1>
          <p className="text-sm text-neutral-400">Manage your assigned jobs</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-neutral-800 p-2 rounded-full hover:bg-neutral-700 transition"
          >
            <RefreshCw className={`w-4 h-4 text-neutral-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
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
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-white">{stats.total}</p>
            <p className="text-[10px] text-neutral-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-[10px] text-neutral-400">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-blue-400">{stats.inProgress}</p>
            <p className="text-[10px] text-neutral-400">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{stats.completed}</p>
            <p className="text-[10px] text-neutral-400">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-neutral-500" />}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="inProgress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Jobs List */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <Card key={job.id} className={`bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition ${job.status === 'completed' ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(job.type)}
                    <h3 className="font-semibold text-white">{job.customerName}</h3>
                    <StatusBadge status={job.status as any} />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-400">
                    <Clock className="w-3 h-3" />
                    {job.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-neutral-400 mb-1">
                  <MapPin className="w-4 h-4" />
                  {job.location?.address || 'Address not provided'}
                </div>

                <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
                  <Clock className="w-4 h-4" />
                  {job.estimatedDuration} min • {job.distance}km away
                  {job.travelTime && ` • ${job.travelTime} min travel`}
                </div>

                {job.items && job.items.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-neutral-500 mb-1">Items:</p>
                    <div className="flex flex-wrap gap-1">
                      {job.items.slice(0, 3).map((item, i) => (
                        <span key={i} className="text-xs bg-neutral-800/50 text-neutral-300 px-2 py-0.5 rounded">{item}</span>
                      ))}
                      {job.items.length > 3 && (
                        <span className="text-xs text-neutral-500">+{job.items.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {job.status === 'pending' || job.status === 'confirmed' ? (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        onClick={() => {
                          window.open(`tel:${job.customerPhone}`, '_blank');
                        }}
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        onClick={() => {
                          window.open(`https://maps.google.com/?q=${encodeURIComponent(job.location?.address || '')}`, '_blank');
                        }}
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        Directions
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => startJob(job.id)}
                        className="bg-lime-400 text-black hover:bg-lime-300"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start Job
                      </Button>
                    </>
                  ) : job.status === 'inProgress' ? (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        onClick={() => {
                          window.open(`https://maps.google.com/?q=${encodeURIComponent(job.location?.address || '')}`, '_blank');
                        }}
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        Directions
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => completeJob(job.id)}
                        className="bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    </>
                  ) : job.status === 'completed' ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                      onClick={() => {
                        setSelectedJob(job);
                        setDetailModalOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                  ) : null}
                  
                  {job.status !== 'completed' && job.status !== 'cancelled' && (
                    <Button 
                      size="sm" 
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
          ))}
        </div>
      ) : (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">No jobs found</p>
            <p className="text-sm text-neutral-500">Your assigned jobs will appear here</p>
          </CardContent>
        </Card>
      )}

      {/* Job Detail Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Job Details" size="lg">
        {selectedJob && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedJob.type)}
                  <h3 className="text-lg font-bold text-white">{selectedJob.customerName}</h3>
                  <StatusBadge status={selectedJob.status as any} />
                </div>
                <p className="text-sm text-neutral-400 mt-1">ID: {selectedJob.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500">Type</p>
                <p className="text-white capitalize">{selectedJob.type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500">Scheduled</p>
                <p className="text-white">{selectedJob.scheduledDate.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500">Duration</p>
                <p className="text-white">{selectedJob.estimatedDuration} minutes</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500">Location</p>
                <p className="text-white">{selectedJob.location?.address || 'N/A'}</p>
              </div>
              {selectedJob.distance && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-neutral-500">Distance</p>
                  <p className="text-white">{selectedJob.distance} km away</p>
                </div>
              )}
              {selectedJob.travelTime && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-neutral-500">Travel Time</p>
                  <p className="text-white">{selectedJob.travelTime} minutes</p>
                </div>
              )}
              {selectedJob.customerPhone && (
                <div className="space-y-1 col-span-2">
                  <p className="text-xs font-medium text-neutral-500">Contact</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white">{selectedJob.customerPhone}</p>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                      onClick={() => window.open(`tel:${selectedJob.customerPhone}`, '_blank')}
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      Call
                    </Button>
                    {selectedJob.customerEmail && (
                      <Button 
                        size="sm"
                        variant="outline"
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        onClick={() => window.open(`mailto:${selectedJob.customerEmail}`, '_blank')}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Email
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedJob.items && selectedJob.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-neutral-500">Items/Checklist</p>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.items.map((item, i) => (
                    <span key={i} className="text-sm bg-neutral-800/50 text-white px-3 py-1.5 rounded-lg">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedJob.notes && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-neutral-500">Notes</p>
                <div className="bg-neutral-800/30 p-3 rounded-lg border border-neutral-700/50">
                  <p className="text-white text-sm whitespace-pre-wrap">{selectedJob.notes}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-neutral-800">
              {selectedJob.status === 'pending' || selectedJob.status === 'confirmed' ? (
                <Button 
                  onClick={() => {
                    startJob(selectedJob.id);
                    setDetailModalOpen(false);
                  }}
                  className="bg-lime-400 text-black hover:bg-lime-300"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Job
                </Button>
              ) : selectedJob.status === 'inProgress' ? (
                <Button 
                  onClick={() => {
                    completeJob(selectedJob.id);
                    setDetailModalOpen(false);
                  }}
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Complete Job
                </Button>
              ) : null}
              {selectedJob.status !== 'completed' && selectedJob.status !== 'cancelled' && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    cancelJob(selectedJob.id);
                    setDetailModalOpen(false);
                  }}
                  className="border-red-700/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Job
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => setDetailModalOpen(false)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 ml-auto"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
    </div>
  );
}

export default TechnicianJobs;