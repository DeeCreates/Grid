// src/features/customer/pages/ReportsCenter.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Download, Calendar, Filter, 
  Eye, TrendingUp, Users, Camera, AlertTriangle,
  ChevronRight, BarChart3, PieChart, LineChart,
  RefreshCw, Clock, CheckCircle, XCircle,
  AlertCircle, Shield, DollarSign, Activity,
  Printer, Share2, Grid, List, Search,
  Plus, Trash2, Edit, MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  incidentService, 
  serviceService,
  invoiceService,
  bookingService,
  alertService
} from '@/services/firebase/firestore.service';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Incident, Service, Invoice, Booking, Alert } from '@/types/models';

interface Report {
  id: string;
  name: string;
  type: 'security' | 'incident' | 'usage' | 'financial' | 'custom';
  dateRange: { start: Date; end: Date };
  generatedAt: Date;
  size: string;
  status: 'ready' | 'generating' | 'failed';
  fileUrl?: string;
  data?: any;
}

export function ReportsCenter() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('security');
  const [dateRange, setDateRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
    end: new Date() 
  });
  const [reportData, setReportData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const reportTypes = [
    { 
      id: 'security', 
      label: 'Security Summary', 
      icon: Shield, 
      description: 'Overview of security events and alerts',
      color: 'text-blue-400',
      bg: 'bg-blue-400/10'
    },
    { 
      id: 'incident', 
      label: 'Incident Report', 
      icon: AlertTriangle, 
      description: 'Detailed incident logs and analysis',
      color: 'text-red-400',
      bg: 'bg-red-400/10'
    },
    { 
      id: 'usage', 
      label: 'Usage Analytics', 
      icon: BarChart3, 
      description: 'Camera usage and storage metrics',
      color: 'text-purple-400',
      bg: 'bg-purple-400/10'
    },
    { 
      id: 'financial', 
      label: 'Financial Summary', 
      icon: DollarSign, 
      description: 'Billing and usage costs',
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10'
    },
    { 
      id: 'custom', 
      label: 'Custom Report', 
      icon: FileText, 
      description: 'Build your own custom report',
      color: 'text-lime-400',
      bg: 'bg-lime-400/10'
    },
  ];

  // Load reports
  const loadReports = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch data for reports
      const [incidents, services, invoices, bookings, alerts] = await Promise.all([
        incidentService.query([where('customerId', '==', user.uid)]),
        serviceService.query([where('customerId', '==', user.uid)]),
        invoiceService.query([where('customerId', '==', user.uid)]),
        bookingService.query([where('customerId', '==', user.uid)]),
        alertService.query([where('customerId', '==', user.uid)])
      ]);

      // Generate reports from data
      const generatedReports: Report[] = [];

      // Security Summary
      if (alerts.length > 0) {
        generatedReports.push({
          id: `RPT-${Date.now()}-security`,
          name: `Security Summary - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          type: 'security',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          generatedAt: new Date(),
          size: `${(alerts.length * 0.1).toFixed(1)} MB`,
          status: 'ready',
          data: {
            totalAlerts: alerts.length,
            criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
            highAlerts: alerts.filter(a => a.severity === 'high').length,
            mediumAlerts: alerts.filter(a => a.severity === 'medium').length,
            lowAlerts: alerts.filter(a => a.severity === 'low').length,
            alerts,
          }
        });
      }

      // Incident Report
      if (incidents.length > 0) {
        const resolved = incidents.filter(i => i.status === 'resolved');
        const open = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved');
        generatedReports.push({
          id: `RPT-${Date.now()}-incident`,
          name: `Incident Report - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          type: 'incident',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          generatedAt: new Date(),
          size: `${(incidents.length * 0.15).toFixed(1)} MB`,
          status: 'ready',
          data: {
            totalIncidents: incidents.length,
            openIncidents: open.length,
            resolvedIncidents: resolved.length,
            criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
            highIncidents: incidents.filter(i => i.severity === 'high').length,
            avgResolutionTime: resolved.length > 0 
              ? resolved.reduce((sum, i) => {
                  const diff = (i.resolution?.resolvedAt?.toDate().getTime() || 0) - i.timestamp.toDate().getTime();
                  return sum + diff;
                }, 0) / resolved.length / 1000 / 60 / 60
              : 0,
            incidents,
          }
        });
      }

      // Usage Analytics
      if (services.length > 0) {
        generatedReports.push({
          id: `RPT-${Date.now()}-usage`,
          name: `Usage Analytics - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          type: 'usage',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          generatedAt: new Date(),
          size: `${(services.length * 0.12).toFixed(1)} MB`,
          status: 'ready',
          data: {
            totalServices: services.length,
            activeServices: services.filter(s => s.status === 'active').length,
            totalCameras: services.reduce((sum, s) => sum + (s.cameraCount || 0), 0),
            storageUsed: services.reduce((sum, s) => sum + (s.storageDays || 0) * 5, 0),
            services,
          }
        });
      }

      // Financial Summary
      if (invoices.length > 0) {
        const paid = invoices.filter(i => i.status === 'paid');
        const totalRevenue = paid.reduce((sum, i) => sum + i.total, 0);
        const pending = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
        
        generatedReports.push({
          id: `RPT-${Date.now()}-financial`,
          name: `Financial Summary - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          type: 'financial',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          generatedAt: new Date(),
          size: `${(invoices.length * 0.08).toFixed(1)} MB`,
          status: 'ready',
          data: {
            totalRevenue,
            totalInvoices: invoices.length,
            paidInvoices: paid.length,
            pendingInvoices: pending.length,
            overdueInvoices: invoices.filter(i => i.status === 'overdue').length,
            averageInvoice: invoices.length > 0 ? totalRevenue / invoices.length : 0,
            invoices,
          }
        });
      }

      setReports(generatedReports);

      firebaseUtils.logEvent('reports_center_viewed', {
        userId: user.uid,
        totalReports: generatedReports.length,
      });

    } catch (error) {
      console.error('Error loading reports:', error);
      firebaseUtils.logEvent('reports_center_error', {
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
    loadReports();

    // Real-time updates
    const unsubscribers = [
      incidentService.listenAll(() => loadReports()),
      serviceService.listenAll(() => loadReports()),
      invoiceService.listenAll(() => loadReports()),
      bookingService.listenAll(() => loadReports()),
      alertService.listenAll(() => loadReports()),
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [loadReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setGenerateModalOpen(false);

    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      const newReport: Report = {
        id: `RPT-${Date.now()}`,
        name: `${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Report - ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        type: selectedType as any,
        dateRange: { ...dateRange },
        generatedAt: new Date(),
        size: '2.1 MB',
        status: 'ready',
      };

      setReports([newReport, ...reports]);
      
      firebaseUtils.logEvent('report_generated', {
        type: selectedType,
        userId: user?.uid,
      });

    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (report: Report) => {
    if (report.status === 'generating') return;

    firebaseUtils.logEvent('report_downloaded', {
      reportId: report.id,
      type: report.type,
      userId: user?.uid,
    });

    // In production, this would download the actual file
    alert(`Downloading ${report.name}...`);
  };

  const handlePreview = (report: Report) => {
    setSelectedReport(report);
    setReportData(report.data);
    setShowPreview(true);
  };

  const filteredReports = reports.filter(report => 
    report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports Center</h1>
          <p className="text-neutral-400 mt-1">Generate and download detailed security reports</p>
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
            onClick={() => setGenerateModalOpen(true)}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Report Types Preview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {reportTypes.map((type) => (
          <Card 
            key={type.id} 
            className={`bg-[#161616] border-neutral-800 hover:border-lime-400/30 hover:shadow-lg transition-all duration-300 cursor-pointer`}
            onClick={() => {
              setSelectedType(type.id);
              setGenerateModalOpen(true);
            }}
          >
            <CardContent className="p-4 text-center">
              <div className={`${type.bg} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2`}>
                <type.icon className={`w-6 h-6 ${type.color}`} />
              </div>
              <p className="font-medium text-white text-sm">{type.label}</p>
              <p className="text-xs text-neutral-500 mt-1">{type.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-neutral-500" />}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
          />
        </div>
        <div className="flex gap-2">
          <div className="bg-neutral-800/50 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-xs transition ${
                viewMode === 'grid' 
                  ? 'bg-lime-400 text-black' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-xs transition ${
                viewMode === 'list' 
                  ? 'bg-lime-400 text-black' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button 
            variant="outline"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <ReportCard 
                key={report.id}
                report={report}
                onDownload={handleDownload}
                onPreview={handlePreview}
              />
            ))}
          </div>
        ) : (
          <Card className="bg-[#161616] border-neutral-800">
            <CardHeader>
              <CardTitle className="text-white">Generated Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg hover:bg-neutral-800 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-neutral-400" />
                        <p className="font-medium text-white truncate">{report.name}</p>
                        {report.status === 'generating' && (
                          <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" />
                            Generating...
                          </span>
                        )}
                        {report.status === 'failed' && (
                          <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">Failed</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {report.generatedAt.toLocaleDateString()}
                        </span>
                        <span>{report.size}</span>
                        <span className="capitalize">{report.type}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handlePreview(report)}
                        className="text-neutral-400 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDownload(report)}
                        disabled={report.status === 'generating'}
                        className={`${report.status === 'ready' ? 'text-lime-400 hover:text-lime-300' : 'text-neutral-500'}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">No reports found</p>
            <p className="text-sm text-neutral-500">Generate your first report</p>
            <Button 
              onClick={() => setGenerateModalOpen(true)}
              className="mt-4 bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate Report Modal */}
      <Modal isOpen={generateModalOpen} onClose={() => setGenerateModalOpen(false)} title="Generate Report" size="lg">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
          <div>
            <label className="block text-sm font-medium text-white mb-3">Report Type</label>
            <div className="grid grid-cols-2 gap-2">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                    selectedType === type.id 
                      ? 'border-lime-400 bg-lime-400/10' 
                      : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <type.icon className={`w-5 h-5 ${selectedType === type.id ? 'text-lime-400' : 'text-neutral-400'}`} />
                    <div>
                      <p className={`font-medium text-sm ${selectedType === type.id ? 'text-white' : 'text-neutral-300'}`}>
                        {type.label}
                      </p>
                      <p className="text-xs text-neutral-500">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Date Range</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Start Date</label>
                <Input
                  type="date"
                  value={dateRange.start.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                  className="bg-neutral-900/50 border-neutral-800 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">End Date</label>
                <Input
                  type="date"
                  value={dateRange.end.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                  className="bg-neutral-900/50 border-neutral-800 text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setGenerateModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateReport}
              loading={generating}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Report Preview" size="xl">
        {selectedReport && reportData && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedReport.name}</h3>
                <p className="text-sm text-neutral-400">
                  Generated on {selectedReport.generatedAt.toLocaleString()}
                </p>
              </div>
              <Button 
                onClick={() => handleDownload(selectedReport)}
                className="bg-lime-400 text-black hover:bg-lime-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(reportData).map(([key, value]) => {
                if (typeof value === 'number' && !Array.isArray(value)) {
                  return (
                    <div key={key} className="bg-neutral-800/30 rounded-lg p-3">
                      <p className="text-xs text-neutral-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-xl font-bold text-white">
                        {key.includes('Revenue') || key.includes('average') || key.includes('price') 
                          ? <Currency amount={value} />
                          : value
                        }
                      </p>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <p className="text-sm text-neutral-400">Full report data available for download</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Report Card Component
function ReportCard({ report, onDownload, onPreview }: { 
  report: Report; 
  onDownload: (report: Report) => void; 
  onPreview: (report: Report) => void;
}) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'security': return 'text-blue-400';
      case 'incident': return 'text-red-400';
      case 'usage': return 'text-purple-400';
      case 'financial': return 'text-emerald-400';
      default: return 'text-neutral-400';
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'security': return 'bg-blue-400/10';
      case 'incident': return 'bg-red-400/10';
      case 'usage': return 'bg-purple-400/10';
      case 'financial': return 'bg-emerald-400/10';
      default: return 'bg-neutral-400/10';
    }
  };

  return (
    <Card className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
      <CardContent className="p-4">
        <div className={`${getTypeBg(report.type)} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
          <FileText className={`w-5 h-5 ${getTypeColor(report.type)}`} />
        </div>
        <h4 className="font-medium text-white text-sm truncate">{report.name}</h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
          <span className="capitalize">{report.type}</span>
          <span>•</span>
          <span>{report.size}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-500 mt-1">
          <Calendar className="w-3 h-3" />
          {report.generatedAt.toLocaleDateString()}
        </div>
        <div className="flex gap-2 mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onPreview(report)}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 flex-1"
          >
            <Eye className="w-3 h-3 mr-1" />
            Preview
          </Button>
          <Button 
            size="sm" 
            onClick={() => onDownload(report)}
            disabled={report.status === 'generating'}
            className={`flex-1 ${report.status === 'ready' ? 'bg-lime-400 text-black hover:bg-lime-300' : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'}`}
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReportsCenter;