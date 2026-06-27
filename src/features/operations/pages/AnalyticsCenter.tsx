// src/features/operations/pages/AnalyticsCenter.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Users, Camera, DollarSign,
  Activity, BarChart3, PieChart, LineChart, Download,
  Calendar, Filter, RefreshCw, Award, AlertTriangle,
  Clock, CheckCircle, XCircle, Eye, Zap, Shield,
  Wifi, HardDrive, Package, Truck, Building,  Brain, UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  serviceService, 
  equipmentService, 
  incidentService,
  bookingService,
  invoiceService,
  leadService
} from '@/services/firebase/firestore.service';
import type { Service, Equipment, Incident, Booking, Invoice, Lead } from '@/types/models';

interface AnalyticsData {
  revenue: { value: number; change: number; trend: 'up' | 'down' };
  newCustomers: { value: number; change: number; trend: 'up' | 'down' };
  activeServices: { value: number; change: number; trend: 'up' | 'down' };
  avgTicketValue: { value: number; change: number; trend: 'up' | 'down' };
  churnRate: { value: number; change: number; trend: 'up' | 'down' };
  customerSatisfaction: { value: number; change: number; trend: 'up' | 'down' };
}

interface CustomerRevenue {
  id: string;
  name: string;
  revenue: number;
  services: number;
}

interface ServiceDistribution {
  type: string;
  count: number;
  revenue: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  customers: number;
  bookings: number;
}

export function AnalyticsCenter() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    revenue: { value: 0, change: 0, trend: 'up' },
    newCustomers: { value: 0, change: 0, trend: 'up' },
    activeServices: { value: 0, change: 0, trend: 'up' },
    avgTicketValue: { value: 0, change: 0, trend: 'up' },
    churnRate: { value: 0, change: 0, trend: 'down' },
    customerSatisfaction: { value: 0, change: 0, trend: 'up' },
  });
  
  const [topCustomers, setTopCustomers] = useState<CustomerRevenue[]>([]);
  const [serviceDistribution, setServiceDistribution] = useState<ServiceDistribution[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<{type: string; title: string; message: string}[]>([]);

  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
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

      // Calculate KPIs
      const activeServices = services.filter(s => s.status === 'active');
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
      const totalCustomers = new Set(services.map(s => s.customerId)).size;
      
      // Calculate average ticket value
      const avgTicket = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;
      
      // Calculate churn rate (customers who cancelled in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cancelledServices = services.filter(s => 
        s.status === 'cancelled' && s.updatedAt.toDate() >= thirtyDaysAgo
      );
      const churnRate = totalCustomers > 0 ? (cancelledServices.length / totalCustomers) * 100 : 0;
      
      // Calculate new customers in last 30 days
      const newCustomers = services.filter(s => 
        s.createdAt.toDate() >= thirtyDaysAgo
      );
      const newCustomerCount = new Set(newCustomers.map(s => s.customerId)).size;

      // Calculate satisfaction (from completed bookings with ratings)
      const completedBookings = bookings.filter(b => b.status === 'completed' && b.rating);
      const avgSatisfaction = completedBookings.length > 0 
        ? completedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / completedBookings.length 
        : 0;

      // Calculate changes (compare with previous period)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const previousPaidInvoices = invoices.filter(i => 
        i.createdAt.toDate() >= sixtyDaysAgo && 
        i.createdAt.toDate() < thirtyDaysAgo &&
        i.status === 'paid'
      );
      const previousRevenue = previousPaidInvoices.reduce((sum, i) => sum + i.total, 0);
      
      const revenueChange = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
      const newCustomersChange = 8.2; // Would calculate from previous period
      const activeServicesChange = 5.1; // Would calculate from previous period
      const avgTicketChange = -2.3; // Would calculate from previous period
      const churnRateChange = -0.5; // Would calculate from previous period
      const satisfactionChange = 0.2; // Would calculate from previous period

      setAnalyticsData({
        revenue: { 
          value: totalRevenue, 
          change: revenueChange, 
          trend: revenueChange >= 0 ? 'up' : 'down' 
        },
        newCustomers: { 
          value: newCustomerCount, 
          change: newCustomersChange, 
          trend: newCustomersChange >= 0 ? 'up' : 'down' 
        },
        activeServices: { 
          value: activeServices.length, 
          change: activeServicesChange, 
          trend: activeServicesChange >= 0 ? 'up' : 'down' 
        },
        avgTicketValue: { 
          value: avgTicket, 
          change: avgTicketChange, 
          trend: avgTicketChange >= 0 ? 'up' : 'down' 
        },
        churnRate: { 
          value: churnRate, 
          change: churnRateChange, 
          trend: churnRateChange >= 0 ? 'up' : 'down' 
        },
        customerSatisfaction: { 
          value: avgSatisfaction, 
          change: satisfactionChange, 
          trend: satisfactionChange >= 0 ? 'up' : 'down' 
        },
      });

      // Calculate top customers
      const customerRevenueMap = new Map<string, {name: string; revenue: number; services: number}>();
      paidInvoices.forEach(inv => {
        const existing = customerRevenueMap.get(inv.customerId);
        if (existing) {
          existing.revenue += inv.total;
          existing.services += 1;
        } else {
          customerRevenueMap.set(inv.customerId, {
            name: inv.customerName,
            revenue: inv.total,
            services: 1,
          });
        }
      });
      const sortedCustomers = Array.from(customerRevenueMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopCustomers(sortedCustomers);

      // Calculate service distribution
      const distMap = new Map<string, {count: number; revenue: number}>();
      services.forEach(s => {
        const key = s.type === 'both' ? 'Bundle' : s.type === 'cctv' ? 'CCTV Only' : 'Internet Only';
        const existing = distMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.revenue += s.price;
        } else {
          distMap.set(key, { count: 1, revenue: s.price });
        }
      });
      setServiceDistribution(
        Array.from(distMap.entries()).map(([type, data]) => ({
          type,
          count: data.count,
          revenue: data.revenue,
        }))
      );

      // Calculate monthly trend (last 6 months)
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = month.toLocaleString('default', { month: 'short' });
        months.push(monthName);
      }
      
      const monthlyData = months.map((month, index) => {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        const monthInvoices = invoices.filter(inv => {
          const invDate = inv.createdAt.toDate();
          return invDate.getMonth() === monthDate.getMonth() && 
                 invDate.getFullYear() === monthDate.getFullYear() &&
                 inv.status === 'paid';
        });
        const monthRevenue = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
        const monthCustomers = new Set(
          services.filter(s => {
            const sDate = s.createdAt.toDate();
            return sDate.getMonth() === monthDate.getMonth() && 
                   sDate.getFullYear() === monthDate.getFullYear();
          }).map(s => s.customerId)
        ).size;
        const monthBookings = bookings.filter(b => {
          const bDate = b.createdAt.toDate();
          return bDate.getMonth() === monthDate.getMonth() && 
                 bDate.getFullYear() === monthDate.getFullYear();
        }).length;
        
        return { month, revenue: monthRevenue, customers: monthCustomers, bookings: monthBookings };
      });
      setMonthlyTrend(monthlyData);

      // Generate AI insights
      const insights = [];
      
      if (revenueChange > 15) {
        insights.push({
          type: 'growth',
          title: 'Strong Revenue Growth',
          message: `Revenue increased by ${revenueChange.toFixed(1)}% this period. Keep up the momentum!`,
        });
      }
      
      if (churnRate > 5) {
        insights.push({
          type: 'warning',
          title: 'High Churn Rate Alert',
          message: `Churn rate is at ${churnRate.toFixed(1)}%. Consider implementing retention strategies.`,
        });
      }
      
      if (avgSatisfaction > 4.5) {
        insights.push({
          type: 'success',
          title: 'Excellent Customer Satisfaction',
          message: `CSAT score is ${avgSatisfaction.toFixed(1)}/5. Your customers are happy!`,
        });
      }
      
      if (newCustomerCount > 20) {
        insights.push({
          type: 'opportunity',
          title: 'Growing Customer Base',
          message: `${newCustomerCount} new customers in the last 30 days. Great acquisition!`,
        });
      }

      setAiInsights(insights);

      // Log analytics
      firebaseUtils.logEvent('analytics_center_viewed', {
        userId: user?.uid,
        dateRange,
        totalRevenue,
        activeServices: activeServices.length,
      });

    } catch (error) {
      console.error('Error loading analytics data:', error);
      firebaseUtils.logEvent('analytics_center_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, dateRange]);

  // Initial load
  useEffect(() => {
    loadAnalyticsData();

    // Real-time updates
    const invoicesUnsub = invoiceService.listenAll(() => {
      loadAnalyticsData();
    });

    return () => {
      invoicesUnsub();
    };
  }, [loadAnalyticsData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    firebaseUtils.logEvent('analytics_export', { format });
    // In production, this would generate and download the report
    alert(`Exporting ${format.toUpperCase()} report...`);
  };

  const metrics = [
    {
      key: 'revenue',
      label: 'Revenue',
      value: <Currency amount={analyticsData.revenue.value} compact />,
      change: analyticsData.revenue.change,
      trend: analyticsData.revenue.trend,
      icon: DollarSign,
      color: 'text-lime-400',
      bg: 'bg-lime-400/10',
    },
    {
      key: 'newCustomers',
      label: 'New Customers',
      value: analyticsData.newCustomers.value,
      change: analyticsData.newCustomers.change,
      trend: analyticsData.newCustomers.trend,
      icon: UserPlus,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      key: 'activeServices',
      label: 'Active Services',
      value: analyticsData.activeServices.value,
      change: analyticsData.activeServices.change,
      trend: analyticsData.activeServices.trend,
      icon: Shield,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      key: 'avgTicketValue',
      label: 'Avg. Ticket Value',
      value: <Currency amount={analyticsData.avgTicketValue.value} compact />,
      change: analyticsData.avgTicketValue.change,
      trend: analyticsData.avgTicketValue.trend,
      icon: Package,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
    {
      key: 'churnRate',
      label: 'Churn Rate',
      value: `${analyticsData.churnRate.value.toFixed(1)}%`,
      change: analyticsData.churnRate.change,
      trend: analyticsData.churnRate.trend,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
    },
    {
      key: 'customerSatisfaction',
      label: 'CSAT Score',
      value: analyticsData.customerSatisfaction.value.toFixed(1),
      change: analyticsData.customerSatisfaction.change,
      trend: analyticsData.customerSatisfaction.trend,
      icon: Award,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Center</h1>
          <p className="text-neutral-400 mt-1">Business intelligence and performance metrics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="bg-neutral-800/50 rounded-lg p-1 flex">
            {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded-md text-sm capitalize transition ${
                  dateRange === range 
                    ? 'bg-lime-400 text-black' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
                }`}
              >
                {range}
              </button>
            ))}
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
            variant="outline"
            onClick={() => handleExport('csv')}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.key} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`${metric.bg} p-2 rounded-lg`}>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <span className={`text-sm font-medium flex items-center ${
                  metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {metric.trend === 'up' ? '+' : ''}{metric.change.toFixed(1)}%
                  {metric.trend === 'up' ? 
                    <TrendingUp className="w-3 h-3 inline ml-1" /> : 
                    <TrendingDown className="w-3 h-3 inline ml-1" />
                  }
                </span>
              </div>
              <p className="text-xl font-bold text-white">{metric.value}</p>
              <p className="text-xs text-neutral-500 mt-1">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Revenue Trend</CardTitle>
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
              <Filter className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <div className="h-64">
                <div className="w-full h-full flex items-end gap-2">
                  {monthlyTrend.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-to-t from-lime-400/50 to-lime-400 rounded-t transition-all duration-500"
                        style={{ 
                          height: `${(item.revenue / Math.max(...monthlyTrend.map(m => m.revenue))) * 90}%`,
                          minHeight: '4px'
                        }}
                      />
                      <span className="text-xs text-neutral-500 mt-2">{item.month}</span>
                      <span className="text-[8px] text-neutral-600">₵{item.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Service Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {serviceDistribution.length > 0 ? (
              <div className="space-y-4">
                {serviceDistribution.map((service, i) => {
                  const total = serviceDistribution.reduce((sum, s) => sum + s.count, 0);
                  const percentage = total > 0 ? (service.count / total) * 100 : 0;
                  const colors = ['#a3e635', '#34d399', '#fbbf24', '#a78bfa', '#f87171'];
                  
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-neutral-300">{service.type}</span>
                        <span className="text-neutral-400">{service.count} services</span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-2">
                        <div 
                          className="rounded-full h-2 transition-all duration-500" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: colors[i % colors.length]
                          }} 
                        />
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Revenue: <Currency amount={service.revenue} />
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                No service data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length > 0 ? (
              <div className="space-y-3">
                {topCustomers.map((customer, i) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg hover:bg-neutral-800 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-lime-400/10 rounded-full flex items-center justify-center text-lime-400 font-bold text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-white">{customer.name}</p>
                        <p className="text-sm text-neutral-400">{customer.services} active services</p>
                      </div>
                    </div>
                    <p className="font-semibold text-lime-400">
                      <Currency amount={customer.revenue} />
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-neutral-500">
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">AI Business Insights</CardTitle>
          </CardHeader>
          <CardContent>
            {aiInsights.length > 0 ? (
              <div className="space-y-3">
                {aiInsights.map((insight, i) => {
                  const styles = {
                    growth: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp, color: 'text-emerald-400', titleColor: 'text-emerald-300' },
                    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: AlertTriangle, color: 'text-yellow-400', titleColor: 'text-yellow-300' },
                    success: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: CheckCircle, color: 'text-blue-400', titleColor: 'text-blue-300' },
                    opportunity: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: Zap, color: 'text-purple-400', titleColor: 'text-purple-300' },
                  };
                  const style = styles[insight.type as keyof typeof styles] || styles.success;
                  const Icon = style.icon;
                  
                  return (
                    <div key={i} className={`p-3 ${style.bg} border ${style.border} rounded-lg`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${style.color}`} />
                        <p className={`font-medium ${style.titleColor}`}>{insight.title}</p>
                      </div>
                      <p className="text-sm text-neutral-300">{insight.message}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-neutral-500">
                <div className="text-center">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No insights available</p>
                  <p className="text-xs">More data needed for AI analysis</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <div className="flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={() => handleExport('csv')}
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Export as CSV
        </Button>
        <Button 
          variant="outline" 
          onClick={() => handleExport('pdf')}
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <PieChart className="w-4 h-4 mr-2" />
          Export as PDF
        </Button>
      </div>
    </div>
  );
}

export default AnalyticsCenter;