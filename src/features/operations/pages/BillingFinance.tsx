// src/features/operations/pages/BillingFinance.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Card, CardContent, CardHeader, CardTitle 
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable } from '@/components/ui/DataTable';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  invoiceService, 
  serviceService 
} from '@/services/firebase/firestore.service';
import { 
  RefreshCw, Download, Filter, Eye, 
  TrendingUp, TrendingDown, DollarSign, 
  Clock, CheckCircle, XCircle, AlertCircle,
  Calendar, Printer, FileText, Wallet,
  ArrowUpRight, ArrowDownRight, PlusCircle
} from 'lucide-react';
import type { Invoice } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

interface FinanceStats {
  monthlyRevenue: number;
  monthlyRevenueChange: number;
  outstanding: number;
  outstandingChange: number;
  paidThisMonth: number;
  paidThisMonthChange: number;
  avgPaymentTime: number;
  avgPaymentTimeChange: number;
  totalInvoices: number;
  overdueInvoices: number;
}

export function BillingFinance() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<FinanceStats>({
    monthlyRevenue: 0,
    monthlyRevenueChange: 0,
    outstanding: 0,
    outstandingChange: 0,
    paidThisMonth: 0,
    paidThisMonthChange: 0,
    avgPaymentTime: 0,
    avgPaymentTimeChange: 0,
    totalInvoices: 0,
    overdueInvoices: 0,
  });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load billing data
  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [invoicesData, services] = await Promise.all([
        invoiceService.getAll(),
        serviceService.getAll(),
      ]);

      setInvoices(invoicesData);

      // Calculate stats
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Monthly revenue (paid invoices this month)
      const monthlyPaid = invoicesData.filter(inv => 
        inv.status === 'paid' &&
        inv.paidAt &&
        inv.paidAt.toDate() >= firstDayOfMonth &&
        inv.paidAt.toDate() <= lastDayOfMonth
      );
      const monthlyRevenue = monthlyPaid.reduce((sum, inv) => sum + inv.total, 0);

      // Previous month revenue
      const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const prevMonthPaid = invoicesData.filter(inv => 
        inv.status === 'paid' &&
        inv.paidAt &&
        inv.paidAt.toDate() >= firstDayOfPrevMonth &&
        inv.paidAt.toDate() <= lastDayOfPrevMonth
      );
      const prevMonthRevenue = prevMonthPaid.reduce((sum, inv) => sum + inv.total, 0);
      const monthlyRevenueChange = prevMonthRevenue > 0 
        ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 
        : 0;

      // Outstanding (unpaid invoices)
      const outstandingInvoices = invoicesData.filter(inv => 
        inv.status === 'sent' || inv.status === 'overdue'
      );
      const outstandingTotal = outstandingInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const prevOutstanding = invoicesData.filter(inv => 
        (inv.status === 'sent' || inv.status === 'overdue') &&
        inv.createdAt.toDate() < firstDayOfMonth
      ).reduce((sum, inv) => sum + inv.total, 0);
      const outstandingChange = prevOutstanding > 0 
        ? ((outstandingTotal - prevOutstanding) / prevOutstanding) * 100 
        : 0;

      // Paid this month
      const paidThisMonth = monthlyPaid.reduce((sum, inv) => sum + inv.total, 0);
      const paidThisMonthChange = prevMonthRevenue > 0 
        ? ((paidThisMonth - prevMonthRevenue) / prevMonthRevenue) * 100 
        : 0;

      // Average payment time (days between invoice date and paid date)
      const paidInvoices = invoicesData.filter(inv => 
        inv.status === 'paid' && inv.paidAt
      );
      const avgPaymentTime = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum, inv) => {
            const days = (inv.paidAt!.toDate().getTime() - inv.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / paidInvoices.length
        : 0;
      
      // Previous avg payment time
      const prevPaidInvoices = invoicesData.filter(inv => 
        inv.status === 'paid' && 
        inv.paidAt &&
        inv.paidAt.toDate() < firstDayOfMonth
      );
      const prevAvgPaymentTime = prevPaidInvoices.length > 0
        ? prevPaidInvoices.reduce((sum, inv) => {
            const days = (inv.paidAt!.toDate().getTime() - inv.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / prevPaidInvoices.length
        : 0;
      const avgPaymentTimeChange = prevAvgPaymentTime > 0 
        ? ((avgPaymentTime - prevAvgPaymentTime) / prevAvgPaymentTime) * 100 
        : 0;

      // Overdue invoices
      const overdue = invoicesData.filter(inv => inv.status === 'overdue');

      setStats({
        monthlyRevenue,
        monthlyRevenueChange,
        outstanding: outstandingTotal,
        outstandingChange,
        paidThisMonth,
        paidThisMonthChange,
        avgPaymentTime,
        avgPaymentTimeChange,
        totalInvoices: invoicesData.length,
        overdueInvoices: overdue.length,
      });

      // Log analytics
      firebaseUtils.logEvent('billing_finance_viewed', {
        userId: user?.uid,
        totalInvoices: invoicesData.length,
        monthlyRevenue,
        outstanding: outstandingTotal,
      });

    } catch (error) {
      console.error('Error loading billing data:', error);
      firebaseUtils.logEvent('billing_finance_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadBillingData();

    // Real-time updates
    const invoicesUnsub = invoiceService.listenAll(() => {
      loadBillingData();
    });

    return () => {
      invoicesUnsub();
    };
  }, [loadBillingData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBillingData();
  };

  const handleGenerateReport = () => {
    firebaseUtils.logEvent('billing_report_generated');
    alert('Generating billing report...');
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetails(true);
    firebaseUtils.logEvent('invoice_viewed', { invoiceId: invoice.id });
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    firebaseUtils.logEvent('invoice_downloaded', { invoiceId: invoice.id });
    alert(`Downloading invoice ${invoice.number}...`);
  };

  const columns = [
    { 
      key: 'number', 
      header: 'Invoice #',
      render: (value: string, row: Invoice) => (
        <button 
          onClick={() => handleViewInvoice(row)}
          className="text-lime-400 hover:text-lime-300 font-medium transition"
        >
          {value}
        </button>
      )
    },
    { key: 'customerName', header: 'Customer' },
    { 
      key: 'total', 
      header: 'Amount', 
      render: (v: number) => <Currency amount={v} className="font-semibold" />
    },
    { 
      key: 'createdAt', 
      header: 'Date',
      render: (v: Timestamp) => v.toDate().toLocaleDateString()
    },
    { 
      key: 'dueDate', 
      header: 'Due Date',
      render: (v: Timestamp) => v.toDate().toLocaleDateString()
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (v: string) => <StatusBadge status={v as any} />
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, row: Invoice) => (
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleViewInvoice(row)}
            className="text-neutral-400 hover:text-white"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleDownloadInvoice(row)}
            className="text-neutral-400 hover:text-white"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  const statsCards = [
    {
      title: 'Monthly Revenue',
      value: <Currency amount={stats.monthlyRevenue} />,
      change: stats.monthlyRevenueChange,
      icon: DollarSign,
      color: 'text-lime-400',
      bg: 'bg-lime-400/10',
      trend: stats.monthlyRevenueChange >= 0 ? 'up' : 'down',
    },
    {
      title: 'Outstanding',
      value: <Currency amount={stats.outstanding} />,
      change: stats.outstandingChange,
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-400/10',
      trend: stats.outstandingChange >= 0 ? 'up' : 'down',
    },
    {
      title: 'Paid This Month',
      value: <Currency amount={stats.paidThisMonth} />,
      change: stats.paidThisMonthChange,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      trend: stats.paidThisMonthChange >= 0 ? 'up' : 'down',
    },
    {
      title: 'Avg. Payment Time',
      value: `${stats.avgPaymentTime.toFixed(1)} days`,
      change: stats.avgPaymentTimeChange,
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      trend: stats.avgPaymentTimeChange >= 0 ? 'down' : 'up',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Finance</h1>
          <p className="text-neutral-400 mt-1">Manage invoices, payments, and financial reports</p>
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
            onClick={handleGenerateReport}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
          <Button 
            variant="outline"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className={`text-sm font-medium flex items-center ${
                  stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {stat.trend === 'up' ? '+' : ''}{stat.change.toFixed(1)}%
                  {stat.trend === 'up' ? 
                    <TrendingUp className="w-3 h-3 inline ml-1" /> : 
                    <TrendingDown className="w-3 h-3 inline ml-1" />
                  }
                </span>
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-neutral-500 mt-1">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Total Invoices</p>
              <p className="text-2xl font-bold text-white">{stats.totalInvoices}</p>
            </div>
            <FileText className="w-8 h-8 text-neutral-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Overdue Invoices</p>
              <p className="text-2xl font-bold text-red-400">{stats.overdueInvoices}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400/50" />
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Collection Rate</p>
              <p className="text-2xl font-bold text-emerald-400">
                {stats.totalInvoices > 0 
                  ? ((stats.totalInvoices - stats.overdueInvoices) / stats.totalInvoices * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <Wallet className="w-8 h-8 text-emerald-400/50" />
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Recent Invoices</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
              <Filter className="w-4 h-4 mr-1" />
              Filter
            </Button>
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
              <Printer className="w-4 h-4 mr-1" />
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={invoices.slice(0, 10)} 
            columns={columns} 
            searchable
            searchKey="customerName"
          />
        </CardContent>
      </Card>

      {/* Invoice Detail Modal */}
      {showDetails && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161616] border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Invoice Details</h2>
                <p className="text-neutral-400 text-sm">{selectedInvoice.number}</p>
              </div>
              <button 
                onClick={() => setShowDetails(false)}
                className="text-neutral-400 hover:text-white transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500">Customer</p>
                  <p className="text-white font-medium">{selectedInvoice.customerName}</p>
                  <p className="text-sm text-neutral-400">{selectedInvoice.customerEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Status</p>
                  <StatusBadge status={selectedInvoice.status as any} />
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Date</p>
                  <p className="text-white">{selectedInvoice.createdAt.toDate().toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Due Date</p>
                  <p className="text-white">{selectedInvoice.dueDate.toDate().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-4">
                <h4 className="text-sm font-medium text-white mb-3">Items</h4>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-neutral-300">{item.description}</span>
                      <span className="text-white">
                        {item.quantity} × <Currency amount={item.unitPrice} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Subtotal</span>
                  <span className="text-white"><Currency amount={selectedInvoice.subtotal} /></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Tax ({selectedInvoice.taxRate}%)</span>
                  <span className="text-white"><Currency amount={selectedInvoice.tax} /></span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Discount</span>
                    <span className="text-red-400">-<Currency amount={selectedInvoice.discount} /></span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-neutral-800">
                  <span className="text-white">Total</span>
                  <span className="text-lime-400"><Currency amount={selectedInvoice.total} /></span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-neutral-800">
                <Button 
                  onClick={() => handleDownloadInvoice(selectedInvoice)}
                  className="bg-lime-400 text-black hover:bg-lime-300 flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button 
                  variant="outline"
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BillingFinance;