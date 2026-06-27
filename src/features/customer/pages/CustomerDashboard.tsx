// src/features/customer/pages/CustomerDashboard.tsx
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Camera, HardDrive, AlertTriangle, Wifi, DollarSign, 
  Activity, Eye, Download, Shield, Bell, Calendar,
  CheckCircle, Clock, TrendingUp, TrendingDown,
  Users, MapPin, Phone, Mail, Building, RefreshCw,
  ArrowRight, ChevronRight, Play, Pause, Zap,
  Home, Settings, User, Package, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { 
  serviceService, 
  incidentService,
  bookingService,
  invoiceService,
  alertService
} from '@/services/firebase/firestore.service';
import type { Service, Incident, Booking, Invoice, Alert } from '@/types/models';

interface DashboardStats {
  activeServices: number;
  totalServices: number;
  camerasOnline: number;
  totalCameras: number;
  storageUsed: number;
  storageLimit: number;
  monthlySpend: number;
  openIncidents: number;
  pendingBookings: number;
  unreadAlerts: number;
  uptime: number;
  lastIncident: Date | null;
}

export function CustomerDashboard() {
  const { user, userProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    activeServices: 0,
    totalServices: 0,
    camerasOnline: 0,
    totalCameras: 0,
    storageUsed: 0,
    storageLimit: 50000, // 50GB default
    monthlySpend: 0,
    openIncidents: 0,
    pendingBookings: 0,
    unreadAlerts: 0,
    uptime: 99.9,
    lastIncident: null,
  });
  
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all data in parallel
      const [servicesData, incidentsData, bookingsData, invoicesData, alertsData] = await Promise.all([
        serviceService.query([where('customerId', '==', user.uid)]),
        incidentService.query([where('customerId', '==', user.uid), orderBy('timestamp', 'desc')]),
        bookingService.query([where('customerId', '==', user.uid), orderBy('scheduledDate', 'desc')]),
        invoiceService.query([where('customerId', '==', user.uid), orderBy('createdAt', 'desc')]),
        alertService.query([where('customerId', '==', user.uid), orderBy('timestamp', 'desc')])
      ]);

      setServices(servicesData);
      setIncidents(incidentsData);
      setBookings(bookingsData);
      setInvoices(invoicesData);
      setAlerts(alertsData);

      // Calculate stats
      const activeServices = servicesData.filter(s => s.status === 'active');
      const totalCameras = servicesData.reduce((sum, s) => sum + (s.cameraCount || 0), 0);
      const camerasOnline = totalCameras; // Would come from device health data
      const openIncidents = incidentsData.filter(i => i.status !== 'closed' && i.status !== 'resolved');
      const pendingBookings = bookingsData.filter(b => b.status === 'pending');
      const unreadAlerts = alertsData.filter(a => !a.acknowledgedAt);
      const paidInvoices = invoicesData.filter(i => i.status === 'paid');
      const monthlySpend = paidInvoices
        .filter(i => i.createdAt.toDate() > new Date(new Date().setDate(1)))
        .reduce((sum, i) => sum + i.total, 0);

      const storageUsed = servicesData.reduce((sum, s) => sum + (s.storageDays || 0) * 5, 0);
      const lastIncident = incidentsData.filter(i => i.status !== 'closed').length > 0 
        ? incidentsData[0]?.timestamp.toDate() || null 
        : null;

      setStats({
        activeServices: activeServices.length,
        totalServices: servicesData.length,
        camerasOnline,
        totalCameras,
        storageUsed,
        storageLimit: 50000,
        monthlySpend,
        openIncidents: openIncidents.length,
        pendingBookings: pendingBookings.length,
        unreadAlerts: unreadAlerts.length,
        uptime: 99.9,
        lastIncident,
      });

      // Generate recent activity
      const activity = [
        ...incidentsData.slice(0, 3).map(i => ({ 
          id: i.id, 
          type: 'incident', 
          title: i.type, 
          description: i.description, 
          time: i.timestamp.toDate(),
          status: i.status,
          severity: i.severity,
        })),
        ...bookingsData.slice(0, 2).map(b => ({
          id: b.id,
          type: 'booking',
          title: b.type,
          description: b.location.address,
          time: b.scheduledDate.toDate(),
          status: b.status,
        })),
        ...alertsData.slice(0, 2).map(a => ({
          id: a.id,
          type: 'alert',
          title: a.type,
          description: a.message,
          time: a.timestamp.toDate(),
          severity: a.severity,
        })),
      ].sort((a, b) => b.time.getTime() - a.time.getTime());

      setRecentActivity(activity);

      firebaseUtils.logEvent('customer_dashboard_viewed', {
        userId: user.uid,
        activeServices: activeServices.length,
        openIncidents: openIncidents.length,
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      firebaseUtils.logEvent('customer_dashboard_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadDashboardData();

    // Real-time subscriptions
    if (!user) return;

    const servicesUnsub = serviceService.listenAll(() => {
      loadDashboardData();
    });

    const incidentsUnsub = incidentService.listenAll(() => {
      loadDashboardData();
    });

    const bookingsUnsub = bookingService.listenAll(() => {
      loadDashboardData();
    });

    const invoicesUnsub = invoiceService.listenAll(() => {
      loadDashboardData();
    });

    const alertsUnsub = alertService.listenAll(() => {
      loadDashboardData();
    });

    return () => {
      servicesUnsub();
      incidentsUnsub();
      bookingsUnsub();
      invoicesUnsub();
      alertsUnsub();
    };
  }, [loadDashboardData, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const statCards = [
    { 
      title: 'Active Services', 
      value: stats.activeServices, 
      icon: Wifi, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-400/10',
      detail: `${stats.totalServices} total services`
    },
    { 
      title: 'Cameras Online', 
      value: stats.camerasOnline, 
      icon: Camera, 
      color: 'text-blue-400', 
      bg: 'bg-blue-400/10',
      detail: `${stats.totalCameras} total cameras`
    },
    { 
      title: 'Storage Used', 
      value: `${Math.round((stats.storageUsed / stats.storageLimit) * 100)}%`, 
      icon: HardDrive, 
      color: 'text-purple-400', 
      bg: 'bg-purple-400/10',
      detail: `${stats.storageUsed}GB / ${stats.storageLimit}GB`
    },
    { 
      title: 'Monthly Spend', 
      value: <Currency amount={stats.monthlySpend} className="text-white" />, 
      icon: DollarSign, 
      color: 'text-yellow-400', 
      bg: 'bg-yellow-400/10',
      detail: 'Current month'
    },
  ];

  const quickActions = [
    { label: 'Live View', icon: Eye, href: '/customer/monitoring', color: 'bg-blue-600' },
    { label: 'Recordings', icon: Download, href: '/customer/recordings', color: 'bg-emerald-600' },
    { label: 'Report Issue', icon: AlertTriangle, href: '/customer/support', color: 'bg-red-600' },
    { label: 'Upgrade Plan', icon: TrendingUp, href: '/customer/subscription', color: 'bg-purple-600' },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.displayName || 'Valued Customer'}
          </h1>
          <p className="text-neutral-400 mt-1">Here's what's happening with your security systems</p>
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
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-neutral-400 mt-1">{stat.title}</p>
              {stat.detail && (
                <p className="text-xs text-neutral-500 mt-1">{stat.detail}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Alerts</p>
              <p className="text-lg font-bold text-white">{stats.unreadAlerts}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Pending</p>
              <p className="text-lg font-bold text-white">{stats.pendingBookings}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-red-400/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Incidents</p>
              <p className="text-lg font-bold text-white">{stats.openIncidents}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Uptime</p>
              <p className="text-lg font-bold text-white">{stats.uptime}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <Link key={index} to={action.href}>
            <Card className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 hover:shadow-lg transition-all duration-300 cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className={`${action.color} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-white">{action.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <Link to="/customer/reports" className="text-sm text-lime-400 hover:text-lime-300 transition flex items-center">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400">No recent activity</p>
                <p className="text-xs text-neutral-500">Your activity will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((item, index) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-neutral-800/30 rounded-lg hover:bg-neutral-800 transition">
                    <div className={`mt-0.5 w-2 h-2 rounded-full ${item.type === 'incident' ? 'bg-red-400' : item.type === 'alert' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white capitalize">{item.title}</p>
                        {item.severity && (
                          <StatusBadge status={item.severity as any} />
                        )}
                        {item.status && (
                          <StatusBadge status={item.status as any} />
                        )}
                      </div>
                      <p className="text-sm text-neutral-400">{item.description}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {item.time.toLocaleDateString()} at {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Active Services</CardTitle>
            <Link to="/customer/services" className="text-sm text-lime-400 hover:text-lime-300 transition flex items-center">
              Manage
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {services.filter(s => s.status === 'active').length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400">No active services</p>
                <p className="text-xs text-neutral-500">Get started by adding a service</p>
                <Link to="/services">
                  <Button className="mt-4 bg-lime-400 text-black hover:bg-lime-300">
                    Browse Services
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {services.filter(s => s.status === 'active').slice(0, 4).map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg hover:bg-neutral-800 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white capitalize">{service.type} Service</p>
                        <StatusBadge status="active" />
                      </div>
                      <p className="text-sm text-neutral-400">
                        Active since {new Date(service.startDate.seconds * 1000).toLocaleDateString()}
                      </p>
                      {service.cameraCount && (
                        <p className="text-xs text-neutral-500">{service.cameraCount} cameras</p>
                      )}
                    </div>
                    <Link to={`/customer/services/${service.id}`}>
                      <Button variant="outline" size="sm" className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                        Manage
                      </Button>
                    </Link>
                  </div>
                ))}
                {services.filter(s => s.status === 'active').length > 4 && (
                  <Link to="/customer/services" className="block text-center text-sm text-lime-400 hover:text-lime-300 transition">
                    View all {services.filter(s => s.status === 'active').length} services
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      {incidents.filter(i => i.status !== 'closed').length > 0 && (
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Open Incidents
            </CardTitle>
            <Link to="/customer/support" className="text-sm text-lime-400 hover:text-lime-300 transition flex items-center">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incidents.filter(i => i.status !== 'closed').slice(0, 3).map((incident) => (
                <div key={incident.id} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg">
                  <div>
                    <p className="font-medium text-white capitalize">{incident.type}</p>
                    <p className="text-sm text-neutral-400">{incident.timestamp.toDate().toLocaleString()}</p>
                  </div>
                  <StatusBadge status={incident.severity as any} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CustomerDashboard;