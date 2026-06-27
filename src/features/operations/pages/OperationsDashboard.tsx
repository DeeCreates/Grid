// src/features/operations/pages/OperationsDashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Users, Package, Calendar, 
  AlertTriangle, DollarSign, Truck, Activity, RefreshCw,
  BarChart3, PieChart, LineChart, Clock, CheckCircle,
  XCircle, Eye, MoreVertical, Download, Filter,
  ArrowUpRight, ArrowDownRight, Building, UserPlus,
  Zap, Shield, Wifi, Camera, HardDrive, Cpu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable } from '@/components/ui/DataTable';
import { useAuthStore } from '@/stores/authStore';
import { 
  serviceService, 
  equipmentService, 
  incidentService,
  bookingService,
  invoiceService,
  leadService
} from '@/services/firebase/firestore.service';
import { firebaseUtils } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import type { Service, Equipment, Incident, Booking, Invoice, Lead } from '@/types/models';

interface KPI {
  activeProjects: number;
  activeProjectsChange: number;
  deploymentsToday: number;
  deploymentsTodayChange: number;
  availableEquipment: number;
  availableEquipmentChange: number;
  revenue: number;
  revenueChange: number;
  openTickets: number;
  openTicketsChange: number;
  utilizationRate: number;
  utilizationRateChange: number;
  totalCustomers: number;
  totalCustomersChange: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

export function OperationsDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<KPI>({
    activeProjects: 0,
    activeProjectsChange: 0,
    deploymentsToday: 0,
    deploymentsTodayChange: 0,
    availableEquipment: 0,
    availableEquipmentChange: 0,
    revenue: 0,
    revenueChange: 0,
    openTickets: 0,
    openTicketsChange: 0,
    utilizationRate: 0,
    utilizationRateChange: 0,
    totalCustomers: 0,
    totalCustomersChange: 0,
  });

  const [recentOrders, setRecentOrders] = useState<Invoice[]>([]);
  const [pendingDeployments, setPendingDeployments] = useState<Booking[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [lowStockEquipment, setLowStockEquipment] = useState<Equipment[]>([]);
  const [newLeads, setNewLeads] = useState<Lead[]>([]);
  const [revenueData, setRevenueData] = useState<ChartData>({ labels: [], datasets: [] });
  const [serviceDistribution, setServiceDistribution] = useState<ChartData>({ labels: [], datasets: [] });

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [
        services,
        equipment,
        incidents,
        bookings,
        invoices,
        leads,
      ] = await Promise.all([
        serviceService.getAll(),
        equipmentService.getAll(),
        incidentService.getAll(),
        bookingService.getAll(),
        invoiceService.getAll(),
        leadService.getAll(),
      ]);

      const activeServices = services.filter(s => s.status === 'active');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBookings = bookings.filter(b => 
        b.scheduledDate.toDate() >= today && 
        b.scheduledDate.toDate() < new Date(today.getTime() + 24 * 60 * 60 * 1000)
      );
      const availableEquip = equipment.filter(e => e.status === 'available');
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
      const openTickets = 0;
      const totalCustomers = new Set(services.map(s => s.customerId)).size;
      const utilizationRate = services.length > 0 ? (activeServices.length / services.length) * 100 : 0;

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthInvoices = invoices.filter(i => 
        i.createdAt.toDate() >= lastMonth && i.status === 'paid'
      );
      const previousRevenue = lastMonthInvoices.reduce((sum, i) => sum + i.total, 0);

      setKpis({
        activeProjects: activeServices.length,
        activeProjectsChange: 12.5,
        deploymentsToday: todayBookings.length,
        deploymentsTodayChange: 3,
        availableEquipment: availableEquip.length,
        availableEquipmentChange: -5,
        revenue: totalRevenue,
        revenueChange: previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        openTickets: openTickets,
        openTicketsChange: 2,
        utilizationRate: Math.round(utilizationRate),
        utilizationRateChange: 5.2,
        totalCustomers: totalCustomers,
        totalCustomersChange: 8.3,
      });

      setRecentOrders(invoices.slice(0, 5));
      setPendingDeployments(bookings.filter(b => b.status === 'pending').slice(0, 5));
      setRecentIncidents(incidents.filter(i => i.status !== 'closed').slice(0, 5));
      setLowStockEquipment(equipment.filter(e => e.status === 'maintenance').slice(0, 5));
      setNewLeads(leads.filter(l => l.status === 'new').slice(0, 5));
      generateChartData(invoices, services);

      firebaseUtils.logEvent('operations_dashboard_viewed', {
        userId: user?.uid,
        activeProjects: activeServices.length,
        totalRevenue,
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      firebaseUtils.logEvent('operations_dashboard_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const generateChartData = (invoices: Invoice[], services: Service[]) => {
    const months = [];
    const revenueDataPoints = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleString('default', { month: 'short' });
      months.push(monthName);
      
      const monthInvoices = invoices.filter(inv => {
        const invDate = inv.createdAt.toDate();
        return invDate.getMonth() === month.getMonth() && 
               invDate.getFullYear() === month.getFullYear() &&
               inv.status === 'paid';
      });
      revenueDataPoints.push(monthInvoices.reduce((sum, inv) => sum + inv.total, 0));
    }

    setRevenueData({
      labels: months,
      datasets: [
        {
          label: 'Revenue',
          data: revenueDataPoints,
          color: '#a3e635',
        },
      ],
    });

    const typeCount: Record<string, number> = {};
    services.forEach(s => {
      typeCount[s.type] = (typeCount[s.type] || 0) + 1;
    });

    setServiceDistribution({
      labels: Object.keys(typeCount).map(t => t.charAt(0).toUpperCase() + t.slice(1)),
      datasets: [
        {
          label: 'Services',
          data: Object.values(typeCount),
          color: '#a3e635',
        },
      ],
    });
  };

  useEffect(() => {
    loadDashboardData();

    const servicesUnsub = serviceService.listenAll((services) => {
      const active = services.filter(s => s.status === 'active');
      setKpis(prev => ({
        ...prev,
        activeProjects: active.length,
        utilizationRate: services.length > 0 ? Math.round((active.length / services.length) * 100) : 0,
      }));
    });

    const bookingsUnsub = bookingService.listenAll((bookings) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBookings = bookings.filter(b => 
        b.scheduledDate.toDate() >= today && 
        b.scheduledDate.toDate() < new Date(today.getTime() + 24 * 60 * 60 * 1000)
      );
      setKpis(prev => ({
        ...prev,
        deploymentsToday: todayBookings.length,
      }));
      setPendingDeployments(bookings.filter(b => b.status === 'pending').slice(0, 5));
    });

    const invoicesUnsub = invoiceService.listenAll((invoices) => {
      const paid = invoices.filter(i => i.status === 'paid');
      const totalRevenue = paid.reduce((sum, i) => sum + i.total, 0);
      setKpis(prev => ({
        ...prev,
        revenue: totalRevenue,
      }));
      setRecentOrders(invoices.slice(0, 5));
    });

    const incidentsUnsub = incidentService.listenAll((incidents) => {
      setRecentIncidents(incidents.filter(i => i.status !== 'closed').slice(0, 5));
    });

    const leadsUnsub = leadService.listenAll((leads) => {
      setNewLeads(leads.filter(l => l.status === 'new').slice(0, 5));
    });

    return () => {
      servicesUnsub();
      bookingsUnsub();
      invoicesUnsub();
      incidentsUnsub();
      leadsUnsub();
    };
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const kpiCards = [
    { 
      title: 'Active Projects', 
      value: kpis.activeProjects, 
      change: kpis.activeProjectsChange, 
      trend: kpis.activeProjectsChange >= 0 ? 'up' : 'down',
      icon: Activity, 
      color: 'text-lime-400', 
      bg: 'bg-lime-400/10',
      detail: `${kpis.utilizationRate}% utilization`
    },
    { 
      title: 'Deployments Today', 
      value: kpis.deploymentsToday, 
      change: kpis.deploymentsTodayChange, 
      trend: kpis.deploymentsTodayChange >= 0 ? 'up' : 'down',
      icon: Truck, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-400/10',
      detail: 'Scheduled for today'
    },
    { 
      title: 'Available Equipment', 
      value: kpis.availableEquipment, 
      change: kpis.availableEquipmentChange, 
      trend: kpis.availableEquipmentChange >= 0 ? 'up' : 'down',
      icon: Package, 
      color: 'text-amber-400', 
      bg: 'bg-amber-400/10',
      detail: 'Ready for deployment'
    },
    { 
      title: 'Revenue (MTD)', 
      value: <Currency amount={kpis.revenue} />, 
      change: kpis.revenueChange, 
      trend: kpis.revenueChange >= 0 ? 'up' : 'down',
      icon: DollarSign, 
      color: 'text-lime-400', 
      bg: 'bg-lime-400/10',
      detail: `${kpis.totalCustomers} customers`
    },
    { 
      title: 'Open Tickets', 
      value: kpis.openTickets, 
      change: kpis.openTicketsChange, 
      trend: kpis.openTicketsChange >= 0 ? 'up' : 'down',
      icon: AlertTriangle, 
      color: 'text-red-400', 
      bg: 'bg-red-400/10',
      detail: 'Needs attention'
    },
    { 
      title: 'Utilization Rate', 
      value: `${kpis.utilizationRate}%`, 
      change: kpis.utilizationRateChange, 
      trend: kpis.utilizationRateChange >= 0 ? 'up' : 'down',
      icon: BarChart3, 
      color: 'text-purple-400', 
      bg: 'bg-purple-400/10',
      detail: 'Of total capacity'
    },
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-neutral-400 mt-1">Real-time overview of business operations</p>
        </div>
        <div className="flex gap-2">
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
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="bg-[#161616] border-neutral-800 hover:border-lime-400/50 transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`${kpi.bg} p-2 rounded-lg`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <span className={`text-sm font-medium flex items-center ${
                  kpi.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {kpi.trend === 'up' ? '+' : ''}{kpi.change}%
                  {kpi.trend === 'up' ? 
                    <TrendingUp className="w-3 h-3 inline ml-1" /> : 
                    <TrendingDown className="w-3 h-3 inline ml-1" />
                  }
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-sm text-neutral-400 mt-1">{kpi.title}</p>
              {kpi.detail && (
                <p className="text-xs text-neutral-500 mt-1">{kpi.detail}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Revenue Trend</CardTitle>
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
              <Filter className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {revenueData.labels.length > 0 ? (
              <div className="h-64">
                <div className="w-full h-full flex items-end gap-2">
                  {revenueData.datasets[0]?.data.map((value, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-to-t from-lime-400/50 to-lime-400 rounded-t transition-all duration-500"
                        style={{ 
                          height: `${(value / Math.max(...revenueData.datasets[0].data)) * 100}%`,
                          minHeight: '4px'
                        }}
                      />
                      <span className="text-xs text-neutral-500 mt-1">{revenueData.labels[i]}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm text-neutral-400 mt-2">
                  Total: <Currency amount={revenueData.datasets[0]?.data.reduce((a, b) => a + b, 0) || 0} />
                </p>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Service Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {serviceDistribution.labels.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-48 h-48 relative">
                  <div className="w-full h-full rounded-full border-8 border-lime-400/30 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">
                        {serviceDistribution.datasets[0]?.data.reduce((a, b) => a + b, 0) || 0}
                      </p>
                      <p className="text-xs text-neutral-500">Total Services</p>
                    </div>
                  </div>
                </div>
                <div className="ml-4 space-y-2">
                  {serviceDistribution.labels.map((label, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ 
                        backgroundColor: ['#a3e635', '#34d399', '#fbbf24', '#a78bfa', '#f87171'][i % 5] 
                      }} />
                      <span className="text-sm text-neutral-400">{label}</span>
                      <span className="text-sm font-medium text-white">
                        {serviceDistribution.datasets[0]?.data[i] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                No service data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.length > 0 ? (
                recentOrders.map((order, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition">
                    <div>
                      <p className="font-medium text-white">{order.number}</p>
                      <p className="text-sm text-neutral-400">
                        {order.createdAt.toDate().toLocaleDateString()} • {order.customerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Currency amount={order.total} className="font-semibold text-lime-400" />
                      <StatusBadge status={order.status as any} />
                      <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">No recent orders</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Pending Deployments</CardTitle>
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingDeployments.length > 0 ? (
                pendingDeployments.map((deployment, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition">
                    <div>
                      <p className="font-medium text-white">{deployment.type}</p>
                      <p className="text-sm text-neutral-400">
                        {deployment.scheduledDate.toDate().toLocaleDateString()} • {deployment.location.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-lime-400 text-black hover:bg-lime-300">Assign</Button>
                      <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">No pending deployments</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentIncidents.length > 0 ? (
                recentIncidents.map((incident, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border-b border-neutral-800">
                    <div>
                      <p className="text-sm font-medium text-white">{incident.type}</p>
                      <p className="text-xs text-neutral-500">
                        {incident.timestamp.toDate().toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={incident.severity as any} />
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">No incidents</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Equipment Needing Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockEquipment.length > 0 ? (
                lowStockEquipment.map((equipment, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border-b border-neutral-800">
                    <div>
                      <p className="text-sm font-medium text-white">{equipment.model}</p>
                      <p className="text-xs text-neutral-500">SN: {equipment.serialNumber}</p>
                    </div>
                    <StatusBadge status={equipment.status as any} />
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">All equipment is healthy</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">New Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {newLeads.length > 0 ? (
                newLeads.map((lead, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border-b border-neutral-800">
                    <div>
                      <p className="text-sm font-medium text-white">{lead.customerData.name}</p>
                      <p className="text-xs text-neutral-500">{lead.source} • {lead.createdAt.toDate().toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" variant="outline" className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                      Contact
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">No new leads</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default OperationsDashboard;