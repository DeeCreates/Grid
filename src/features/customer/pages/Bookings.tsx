// src/features/customer/pages/Bookings.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, MapPin, CheckCircle, XCircle,
  Plus, RefreshCw, Eye, Edit, Trash2,
  ChevronLeft, ChevronRight, Filter, Search,
  AlertCircle, Check, X, Loader2, CalendarDays,
  Users, Phone, Mail, Building, User,
  Clock as ClockIcon, MessageCircle, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { bookingService, serviceService } from '@/services/firebase/firestore.service';
import { 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  onSnapshot,
  addDoc,
  query,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Booking, Service } from '@/types/models';

interface BookingWithService extends Booking {
  serviceName?: string;
  serviceType?: string;
}

export function Bookings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingWithService[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithService[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithService | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });

  // New booking form
  const [newBooking, setNewBooking] = useState({
    type: 'installation' as 'installation' | 'maintenance' | 'consultation' | 'emergency',
    scheduledDate: '',
    scheduledTime: '',
    address: '',
    notes: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  // Available services for booking
  const [availableServices, setAvailableServices] = useState<Service[]>([]);

  // Load bookings
  const loadBookings = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's bookings
      const userBookings = await bookingService.query([
        where('customerId', '==', user.uid),
        orderBy('scheduledDate', 'desc')
      ]);

      // Get user's services for reference
      const services = await serviceService.query([
        where('customerId', '==', user.uid),
        where('status', 'in', ['active', 'pending'])
      ]);
      setAvailableServices(services);

      // Enrich bookings with service info
      const enrichedBookings = userBookings.map(booking => {
        const service = services.find(s => s.id === booking.serviceId);
        return {
          ...booking,
          serviceName: service?.customerName || 'Unknown Service',
          serviceType: service?.type || 'unknown',
        };
      });

      setBookings(enrichedBookings);

      // Calculate stats
      const pending = enrichedBookings.filter(b => b.status === 'pending').length;
      const confirmed = enrichedBookings.filter(b => b.status === 'confirmed').length;
      const inProgress = enrichedBookings.filter(b => b.status === 'inProgress').length;
      const completed = enrichedBookings.filter(b => b.status === 'completed').length;
      const cancelled = enrichedBookings.filter(b => b.status === 'cancelled').length;

      setStats({
        total: enrichedBookings.length,
        pending,
        confirmed,
        inProgress,
        completed,
        cancelled,
      });

      firebaseUtils.logEvent('bookings_viewed', {
        userId: user?.uid,
        totalBookings: enrichedBookings.length,
      });

    } catch (error) {
      console.error('Error loading bookings:', error);
      firebaseUtils.logEvent('bookings_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter bookings
  useEffect(() => {
    let filtered = [...bookings];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.type?.toLowerCase().includes(query) ||
        b.location?.address?.toLowerCase().includes(query) ||
        b.id?.toLowerCase().includes(query) ||
        b.serviceName?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    // Date range filter
    if (dateRange === 'upcoming') {
      const now = new Date();
      filtered = filtered.filter(b => b.scheduledDate.toDate() >= now);
    } else if (dateRange === 'past') {
      const now = new Date();
      filtered = filtered.filter(b => b.scheduledDate.toDate() < now);
    }

    setFilteredBookings(filtered);
  }, [bookings, searchQuery, statusFilter, dateRange]);

  // Initial load
  useEffect(() => {
    loadBookings();

    // Real-time updates
    const bookingsUnsub = bookingService.listenAll(() => {
      loadBookings();
    });

    return () => bookingsUnsub();
  }, [loadBookings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
  };

  const handleCreateBooking = async () => {
    if (!user || !newBooking.scheduledDate || !newBooking.scheduledTime || !newBooking.address) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      const bookingData = {
        customerId: user.uid,
        customerName: user.displayName || 'Customer',
        customerPhone: user.phoneNumber || '',
        customerEmail: user.email || '',
        type: newBooking.type,
        status: 'pending' as const,
        scheduledDate: Timestamp.fromDate(new Date(`${newBooking.scheduledDate}T${newBooking.scheduledTime}`)),
        scheduledWindow: {
          start: newBooking.scheduledTime,
          end: new Date(new Date(`${newBooking.scheduledDate}T${newBooking.scheduledTime}`).getTime() + 60 * 60000).toTimeString().slice(0, 5),
        },
        duration: 60,
        assignedTo: [],
        location: {
          address: newBooking.address,
        },
        priority: newBooking.priority,
        notes: newBooking.notes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'bookings'), bookingData);

      firebaseUtils.logEvent('booking_created', {
        type: newBooking.type,
        priority: newBooking.priority,
      });

      setSuccessMessage('Booking created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setCreateModalOpen(false);
      setNewBooking({
        type: 'installation',
        scheduledDate: '',
        scheduledTime: '',
        address: '',
        notes: '',
        priority: 'medium',
      });
      await loadBookings();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create booking');
      console.error('Error creating booking:', error);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('booking_cancelled', { bookingId });
      setSuccessMessage('Booking cancelled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadBookings();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to cancel booking');
      console.error('Error cancelling booking:', error);
    }
  };

  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'confirmed',
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('booking_confirmed', { bookingId });
      setSuccessMessage('Booking confirmed!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadBookings();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to confirm booking');
      console.error('Error confirming booking:', error);
    }
  };

  const handleRescheduleBooking = async (bookingId: string) => {
    // In production, this would open a reschedule modal
    alert('Reschedule functionality coming soon!');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'installation': return <User className="w-4 h-4" />;
      case 'maintenance': return <Settings className="w-4 h-4" />;
      case 'consultation': return <MessageCircle className="w-4 h-4" />;
      case 'emergency': return <AlertCircle className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bookings</h1>
          <p className="text-neutral-400 mt-1">View and manage your service appointments</p>
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
            onClick={() => setCreateModalOpen(true)}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Booking
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
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-neutral-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-xs text-neutral-400">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{stats.confirmed}</p>
            <p className="text-xs text-neutral-400">Confirmed</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-orange-400">{stats.inProgress}</p>
            <p className="text-xs text-neutral-400">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
            <p className="text-xs text-neutral-400">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-400">{stats.cancelled}</p>
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
                placeholder="Search bookings..."
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
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="all">All</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => (
            <Card key={booking.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      {getTypeIcon(booking.type)}
                      <h3 className="font-semibold text-white capitalize">{booking.type}</h3>
                      <StatusBadge status={booking.status as any} />
                      {booking.priority === 'urgent' && (
                        <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">Urgent</span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-neutral-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-500" />
                        {booking.scheduledDate.toDate().toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-neutral-500" />
                        {booking.scheduledDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-neutral-500" />
                        {booking.location.address}
                      </div>
                      {booking.serviceName && (
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-neutral-500" />
                          {booking.serviceName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {booking.status === 'pending' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRescheduleBooking(booking.id)}
                          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Reschedule
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleConfirmBooking(booking.id)}
                          className="bg-lime-400 text-black hover:bg-lime-300"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Confirm
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCancelBooking(booking.id)}
                          className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRescheduleBooking(booking.id)}
                          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Reschedule
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCancelBooking(booking.id)}
                          className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </>
                    )}
                    {booking.status === 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setSelectedBooking(booking);
                          setDetailsModalOpen(true);
                        }}
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    )}
                    {booking.status === 'cancelled' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setSelectedBooking(booking);
                          setDetailsModalOpen(true);
                        }}
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
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
              <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No bookings found</p>
              <p className="text-sm text-neutral-500">Schedule your first service appointment</p>
              <Button 
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 bg-lime-400 text-black hover:bg-lime-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Booking
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Booking Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Booking" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Service Type *</label>
              <select
                value={newBooking.type}
                onChange={(e) => setNewBooking({ ...newBooking, type: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="installation">Installation</option>
                <option value="maintenance">Maintenance</option>
                <option value="consultation">Consultation</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Priority</label>
              <select
                value={newBooking.priority}
                onChange={(e) => setNewBooking({ ...newBooking, priority: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date *"
              type="date"
              value={newBooking.scheduledDate}
              onChange={(e) => setNewBooking({ ...newBooking, scheduledDate: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
              icon={<Calendar className="w-4 h-4 text-neutral-500" />}
            />
            <Input
              label="Time *"
              type="time"
              value={newBooking.scheduledTime}
              onChange={(e) => setNewBooking({ ...newBooking, scheduledTime: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
              icon={<Clock className="w-4 h-4 text-neutral-500" />}
            />
          </div>

          <Input
            label="Address *"
            value={newBooking.address}
            onChange={(e) => setNewBooking({ ...newBooking, address: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white"
            icon={<MapPin className="w-4 h-4 text-neutral-500" />}
          />

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Notes</label>
            <textarea
              value={newBooking.notes}
              onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
              rows={3}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Any special instructions..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setCreateModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBooking}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Booking
            </Button>
          </div>
        </div>
      </Modal>

      {/* Booking Details Modal */}
      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Booking Details" size="lg">
        {selectedBooking && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedBooking.type)}
                  <h3 className="text-lg font-bold text-white capitalize">{selectedBooking.type}</h3>
                  <StatusBadge status={selectedBooking.status as any} />
                </div>
                <p className="text-sm text-neutral-400 mt-1">ID: {selectedBooking.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Date & Time</p>
                <p className="text-white">
                  {selectedBooking.scheduledDate.toDate().toLocaleDateString()}
                </p>
                <p className="text-neutral-400">
                  {selectedBooking.scheduledDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Duration</p>
                <p className="text-white">{selectedBooking.duration || 60} minutes</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Location</p>
              <p className="text-white">{selectedBooking.location.address}</p>
            </div>

            {selectedBooking.notes && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Notes</p>
                <p className="text-white bg-neutral-800/30 p-3 rounded-lg">{selectedBooking.notes}</p>
              </div>
            )}

            {selectedBooking.assignedTo && selectedBooking.assignedTo.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Assigned To</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBooking.assignedTo.map((id) => (
                    <span key={id} className="text-sm bg-neutral-800/50 text-white px-3 py-1 rounded">
                      Technician #{id.slice(-4)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedBooking.rating && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-xs text-yellow-400 font-medium">Rating</p>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < selectedBooking.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-600'}`} />
                  ))}
                </div>
                {selectedBooking.feedback && (
                  <p className="text-sm text-white mt-1">{selectedBooking.feedback}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)} className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                Close
              </Button>
              {selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'completed' && (
                <Button 
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Booking
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Bookings;