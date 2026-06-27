// src/App.tsx
import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from '@/app/layouts/MainLayout';
import { DashboardLayout } from '@/app/layouts/DashboardLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { NotificationProvider } from '@/contexts/NotificationContext';

// Public Pages
import { HomePage } from '@/features/public/pages/HomePage';
import { ServicesPage } from '@/features/public/pages/ServicesPage';
import { SolutionsPage } from '@/features/public/pages/SolutionsPage';
import { IndustriesPage } from '@/features/public/pages/IndustriesPage';
import { AboutPage } from '@/features/public/pages/AboutPage';
import { ResourcesPage } from '@/features/public/pages/ResourcesPage';
import { MarketplacePage } from '@/features/public/pages/MarketplacePage';
import { InstantQuotePage } from '@/features/public/pages/InstantQuotePage';
import { SecurityAssessmentPage } from '@/features/public/pages/SecurityAssessmentPage';
import { ContactPage } from '@/features/public/pages/ContactPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';

// Customer Portal
import { CustomerDashboard } from '@/features/customer/pages/CustomerDashboard';
import { LiveMonitoring } from '@/features/customer/pages/LiveMonitoring';
import { VideoArchive } from '@/features/customer/pages/VideoArchive';
import { ServiceManagement } from '@/features/customer/pages/ServiceManagement';
import { SubscriptionManagement } from '@/features/customer/pages/SubscriptionManagement';
import { ReportsCenter } from '@/features/customer/pages/ReportsCenter';
import { SupportCenter } from '@/features/customer/pages/SupportCenter';
import { AccountSettings } from '@/features/customer/pages/AccountSettings';
import { Bookings } from '@/features/customer/pages/Bookings';

// Operations Portal
import { OperationsDashboard } from '@/features/operations/pages/OperationsDashboard';
import { CustomerManagement } from '@/features/operations/pages/CustomerManagement';
import { DeploymentScheduler } from '@/features/operations/pages/DeploymentScheduler';
import { InventoryManagement } from '@/features/operations/pages/InventoryManagement';
import { AnalyticsCenter } from '@/features/operations/pages/AnalyticsCenter';
import { BillingFinance } from '@/features/operations/pages/BillingFinance';
import { AdminSettings } from '@/features/operations/pages/AdminSettings';
import NotificationsPage from '@/features/operations/pages/NotificationsPage';

// Command Center
import { CommandCenter } from '@/features/command-center/pages/CommandCenter';
import { IncidentManagement } from '@/features/command-center/pages/IncidentManagement';
import { AIControlRoom } from '@/features/command-center/pages/AIControlRoom';

// Partner Portal
import { PartnerDashboard } from '@/features/partner/pages/PartnerDashboard';
import { PartnerLeads } from '@/features/partner/pages/PartnerLeads';
import { PartnerEarnings } from '@/features/partner/pages/PartnerEarnings';

// Mobile Apps
import { TechnicianDashboard } from '@/features/mobile/technician/TechnicianDashboard';
import { TechnicianJobs } from '@/features/mobile/technician/TechnicianJobs';
import { TechnicianEquipment } from '@/features/mobile/technician/TechnicianEquipment';
import { GuardDashboard } from '@/features/mobile/guard/GuardDashboard';
import { GuardPatrol } from '@/features/mobile/guard/GuardPatrol';
import { GuardIncidents } from '@/features/mobile/guard/GuardIncidents';

// Loading component
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// ==================== 404 NOT FOUND PAGE ====================
const NotFoundPage = () => (
  <div className="min-h-[70vh] flex items-center justify-center px-4">
    <div className="text-center max-w-md">
      <div className="w-24 h-24 bg-neutral-800/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-5xl font-bold text-neutral-600">404</span>
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">Page Not Found</h1>
      <p className="text-neutral-400 mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-2 bg-lime-400 text-black rounded-lg hover:bg-lime-300 transition-colors font-medium"
        >
          Go Home
        </button>
      </div>
    </div>
  </div>
);

// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to analytics if available
    try {
      const { firebaseUtils } = require('@/lib/firebase');
      firebaseUtils.logEvent('app_error', {
        error_message: error.message,
        error_stack: error.stack,
      });
    } catch (e) {
      // Ignore analytics errors
    }
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D0D0D]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h1>
            <p className="text-neutral-400 mb-2">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-2 bg-lime-400 text-black rounded-lg hover:bg-lime-300 transition-colors font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==================== APP CONTENT ====================
function AppContent() {
  const { initialize, user, userProfile, isLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">GRID Security Platform</h2>
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  const getDashboardPath = () => {
    switch (userProfile?.role) {
      case 'customer': return '/customer/dashboard';
      case 'technician': return '/technician/dashboard';
      case 'guard': return '/guard/dashboard';
      case 'partner': return '/partner/dashboard';
      case 'admin': return '/operations/dashboard';
      case 'sales': return '/customer/dashboard';
      default: return '/';
    }
  };

  // If user is logged in and trying to access root, redirect to their dashboard
  if (user && location.pathname === '/') {
    return <Navigate to={getDashboardPath()} replace />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ==================== PUBLIC WEBSITE ROUTES ==================== */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/industries" element={<IndustriesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/instant-quote" element={<InstantQuotePage />} />
            <Route path="/security-assessment" element={<SecurityAssessmentPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Route>

          {/* ==================== AUTH ROUTES ==================== */}
          <Route element={<AuthLayout />}>
            <Route 
              path="/login" 
              element={!user ? <LoginPage /> : <Navigate to={getDashboardPath()} replace />} 
            />
            <Route 
              path="/register" 
              element={!user ? <RegisterPage /> : <Navigate to={getDashboardPath()} replace />} 
            />
          </Route>

          {/* ==================== CUSTOMER PORTAL ==================== */}
          <Route 
            path="/customer/*" 
            element={
              <DashboardLayout userRole="customer">
                <Routes>
                  <Route path="dashboard" element={<CustomerDashboard />} />
                  <Route path="monitoring" element={<LiveMonitoring />} />
                  <Route path="recordings" element={<VideoArchive />} />
                  <Route path="services" element={<ServiceManagement />} />
                  <Route path="subscription" element={<SubscriptionManagement />} />
                  <Route path="reports" element={<ReportsCenter />} />
                  <Route path="support" element={<SupportCenter />} />
                  <Route path="settings" element={<AccountSettings />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            } 
          />

          {/* ==================== OPERATIONS PORTAL ==================== */}
          <Route 
            path="/operations/*" 
            element={
              <DashboardLayout userRole="admin">
                <Routes>
                  <Route path="dashboard" element={<OperationsDashboard />} />
                  <Route path="customers" element={<CustomerManagement />} />
                  <Route path="deployments" element={<DeploymentScheduler />} />
                  <Route path="inventory" element={<InventoryManagement />} />
                  <Route path="analytics" element={<AnalyticsCenter />} />
                  <Route path="billing" element={<BillingFinance />} />
                  <Route path="admin" element={<AdminSettings />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            } 
          />

          {/* ==================== COMMAND CENTER ==================== */}
          <Route 
            path="/command-center/*" 
            element={
              <DashboardLayout userRole="admin">
                <Routes>
                  <Route path="" element={<CommandCenter />} />
                  <Route path="incidents" element={<IncidentManagement />} />
                  <Route path="ai-analytics" element={<AIControlRoom />} />
                </Routes>
              </DashboardLayout>
            } 
          />

          {/* ==================== PARTNER PORTAL ==================== */}
          <Route 
            path="/partner/*" 
            element={
              <DashboardLayout userRole="partner">
                <Routes>
                  <Route path="dashboard" element={<PartnerDashboard />} />
                  <Route path="leads" element={<PartnerLeads />} />
                  <Route path="earnings" element={<PartnerEarnings />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            } 
          />

          {/* ==================== TECHNICIAN PORTAL ==================== */}
          <Route 
            path="/technician/*" 
            element={
              <DashboardLayout userRole="technician">
                <Routes>
                  <Route path="dashboard" element={<TechnicianDashboard />} />
                  <Route path="jobs" element={<TechnicianJobs />} />
                  <Route path="equipment" element={<TechnicianEquipment />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            } 
          />

          {/* ==================== GUARD PORTAL ==================== */}
          <Route 
            path="/guard/*" 
            element={
              <DashboardLayout userRole="guard">
                <Routes>
                  <Route path="dashboard" element={<GuardDashboard />} />
                  <Route path="patrol" element={<GuardPatrol />} />
                  <Route path="incidents" element={<GuardIncidents />} />
                  <Route path="" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            } 
          />

          {/* ==================== SETTINGS ==================== */}
          <Route 
            path="/settings" 
            element={
              <DashboardLayout userRole={userProfile?.role || 'customer'}>
                <AccountSettings />
              </DashboardLayout>
            } 
          />

          {/* ==================== 404 NOT FOUND ==================== */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// ==================== MAIN APP ====================
function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
