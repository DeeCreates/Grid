// src/features/customer/pages/SubscriptionManagement.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, Calendar, DollarSign, AlertCircle,
  CheckCircle, Clock, Download, Plus, Trash2,
  RefreshCw, Eye, Edit, XCircle, Shield,
  Wallet, Smartphone, Banknote, CreditCard as CardIcon,
  TrendingUp, TrendingDown, Zap, Award,
  FileText, Printer, Search, Filter
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
  invoiceService, 
  serviceService 
} from '@/services/firebase/firestore.service';
import { 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Invoice, Service } from '@/types/models';

interface Subscription {
  id: string;
  plan: string;
  amount: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: Date;
  status: 'active' | 'cancelled' | 'past_due' | 'expired';
  autoRenew: boolean;
  serviceId: string;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'mobile_money' | 'bank_transfer';
  last4: string;
  expiryDate?: string;
  phoneNumber?: string;
  bankName?: string;
  accountNumber?: string;
  isDefault: boolean;
  createdAt: Date;
}

export function SubscriptionManagement() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeServices, setActiveServices] = useState<Service[]>([]);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState({ 
    type: 'card', 
    number: '', 
    expiry: '', 
    cvv: '', 
    phone: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  // Load subscription data
  const loadSubscriptionData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's services
      const services = await serviceService.query([
        where('customerId', '==', user.uid),
        where('status', 'in', ['active', 'pending'])
      ]);
      setActiveServices(services);

      // Get subscription from first active service
      if (services.length > 0) {
        const activeService = services.find(s => s.status === 'active');
        if (activeService) {
          setSubscription({
            id: activeService.id,
            plan: activeService.type === 'both' ? 'Professional Bundle' : 
                  activeService.type === 'cctv' ? 'CCTV Plan' : 'Internet Plan',
            amount: activeService.price,
            billingCycle: 'monthly',
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: activeService.status as 'active' | 'cancelled' | 'past_due' | 'expired',
            autoRenew: true,
            serviceId: activeService.id,
          });
        }
      }

      // Get invoices
      const invoicesData = await invoiceService.query([
        where('customerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      ]);
      setInvoices(invoicesData);

      // Get payment methods (from a paymentMethods collection)
      const paymentMethodsSnapshot = await getDocs(
        query(collection(db, 'paymentMethods'), where('userId', '==', user.uid))
      );
      const methods = paymentMethodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as PaymentMethod[];
      
      if (methods.length === 0) {
        // Add demo payment methods if none exist
        const demoMethods: PaymentMethod[] = [
          {
            id: 'PM-001',
            type: 'card',
            last4: '4242',
            expiryDate: '12/2026',
            isDefault: true,
            createdAt: new Date(),
          },
          {
            id: 'PM-002',
            type: 'mobile_money',
            last4: '0244XXXXXX',
            phoneNumber: '+233 24 4XX XXXX',
            isDefault: false,
            createdAt: new Date(),
          },
        ];
        setPaymentMethods(demoMethods);
      } else {
        setPaymentMethods(methods);
      }

      firebaseUtils.logEvent('subscription_management_viewed', {
        userId: user.uid,
        activeServices: services.length,
        invoices: invoicesData.length,
      });

    } catch (error) {
      console.error('Error loading subscription data:', error);
      firebaseUtils.logEvent('subscription_management_error', {
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
    loadSubscriptionData();

    // Real-time updates
    const servicesUnsub = serviceService.listenAll(() => {
      loadSubscriptionData();
    });

    const invoicesUnsub = invoiceService.listenAll(() => {
      loadSubscriptionData();
    });

    return () => {
      servicesUnsub();
      invoicesUnsub();
    };
  }, [loadSubscriptionData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSubscriptionData();
  };

  const handleAutoRenewToggle = async () => {
    if (!subscription) return;

    try {
      await updateDoc(doc(db, 'services', subscription.serviceId), {
        autoRenew: !subscription.autoRenew,
        updatedAt: Timestamp.now(),
      });

      setSubscription({ ...subscription, autoRenew: !subscription.autoRenew });
      firebaseUtils.logEvent('auto_renew_toggled', { 
        enabled: !subscription.autoRenew,
        serviceId: subscription.serviceId,
      });
      setSuccessMessage(`Auto-renew ${subscription.autoRenew ? 'disabled' : 'enabled'} successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to toggle auto-renew');
      console.error('Error toggling auto-renew:', error);
    }
  };

  const handleChangePlan = async (plan: string) => {
    if (!subscription) return;

    try {
      await updateDoc(doc(db, 'services', subscription.serviceId), {
        plan: plan,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('plan_changed', { 
        plan, 
        serviceId: subscription.serviceId,
      });

      setSuccessMessage(`Plan changed to ${plan} successfully!`);
      setChangePlanModalOpen(false);
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadSubscriptionData();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to change plan');
      console.error('Error changing plan:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    try {
      await updateDoc(doc(db, 'services', subscription.serviceId), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });

      setSubscription({ ...subscription, status: 'cancelled', autoRenew: false });
      firebaseUtils.logEvent('subscription_cancelled', { 
        serviceId: subscription.serviceId,
      });

      setSuccessMessage('Subscription cancelled successfully!');
      setCancelModalOpen(false);
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to cancel subscription');
      console.error('Error cancelling subscription:', error);
    }
  };

  const handleSetDefaultPayment = async (paymentId: string) => {
    try {
      // Update payment methods in Firestore
      const batch = writeBatch(db);
      paymentMethods.forEach(method => {
        const ref = doc(db, 'paymentMethods', method.id);
        batch.update(ref, { isDefault: method.id === paymentId });
      });
      await batch.commit();

      setPaymentMethods(paymentMethods.map(pm => ({
        ...pm,
        isDefault: pm.id === paymentId
      })));

      firebaseUtils.logEvent('default_payment_set', { paymentId });
      setSuccessMessage('Default payment method updated!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to set default payment');
      console.error('Error setting default payment:', error);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      await deleteDoc(doc(db, 'paymentMethods', paymentId));
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== paymentId));
      
      firebaseUtils.logEvent('payment_method_deleted', { paymentId });
      setSuccessMessage('Payment method deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete payment method');
      console.error('Error deleting payment method:', error);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      const newMethod = {
        userId: user?.uid,
        type: newPaymentMethod.type,
        last4: newPaymentMethod.type === 'card' ? newPaymentMethod.number.slice(-4) : 
               newPaymentMethod.type === 'mobile_money' ? newPaymentMethod.phone.slice(-10) :
               newPaymentMethod.accountNumber.slice(-4),
        expiryDate: newPaymentMethod.type === 'card' ? newPaymentMethod.expiry : undefined,
        phoneNumber: newPaymentMethod.type === 'mobile_money' ? newPaymentMethod.phone : undefined,
        bankName: newPaymentMethod.type === 'bank_transfer' ? newPaymentMethod.bankName : undefined,
        accountNumber: newPaymentMethod.type === 'bank_transfer' ? newPaymentMethod.accountNumber : undefined,
        accountName: newPaymentMethod.type === 'bank_transfer' ? newPaymentMethod.accountName : undefined,
        isDefault: paymentMethods.length === 0,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'paymentMethods'), newMethod);
      
      const addedMethod: PaymentMethod = {
        id: docRef.id,
        ...newMethod,
        createdAt: new Date(),
        isDefault: paymentMethods.length === 0,
      };

      setPaymentMethods([...paymentMethods, addedMethod]);
      setAddPaymentModalOpen(false);
      setNewPaymentMethod({ 
        type: 'card', 
        number: '', 
        expiry: '', 
        cvv: '', 
        phone: '',
        bankName: '',
        accountNumber: '',
        accountName: '',
      });

      firebaseUtils.logEvent('payment_method_added', { type: newPaymentMethod.type });
      setSuccessMessage('Payment method added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to add payment method');
      console.error('Error adding payment method:', error);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    firebaseUtils.logEvent('invoice_downloaded', { invoiceId: invoice.id });
    // In production, this would download the actual PDF
    alert(`Downloading invoice ${invoice.number}...`);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription & Billing</h1>
          <p className="text-neutral-400 mt-1">Manage your plan, payment methods, and invoices</p>
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

      {/* Current Plan */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <h3 className="text-xl font-bold text-white">{subscription.plan}</h3>
                  <StatusBadge status={subscription.status as any} />
                  {subscription.autoRenew && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Auto-renew
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-lime-400 mb-2">
                  <Currency amount={subscription.amount} />
                  <span className="text-sm text-neutral-400 font-normal">
                    /{subscription.billingCycle}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-neutral-500" />
                    Next billing: {subscription.nextBillingDate.toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    {subscription.autoRenew ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    Auto-renew: {subscription.autoRenew ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setChangePlanModalOpen(true)}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Change Plan
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleAutoRenewToggle}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  {subscription.autoRenew ? 'Turn Off' : 'Turn On'} Auto-Renew
                </Button>
                {subscription.status === 'active' && (
                  <Button 
                    variant="ghost" 
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCancelModalOpen(true)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No active subscription</p>
              <p className="text-sm text-neutral-500">Subscribe to a plan to get started</p>
              <Button className="mt-4 bg-lime-400 text-black hover:bg-lime-300">
                <Plus className="w-4 h-4 mr-2" />
                Subscribe Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-white">Payment Methods</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setAddPaymentModalOpen(true)}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Payment Method
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg hover:border-lime-400/30 transition">
                  <div className="flex items-center gap-3">
                    {method.type === 'card' ? (
                      <CardIcon className="w-8 h-8 text-blue-400" />
                    ) : method.type === 'mobile_money' ? (
                      <Smartphone className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <Banknote className="w-8 h-8 text-yellow-400" />
                    )}
                    <div>
                      <p className="font-medium text-white">
                        {method.type === 'card' ? `Card ending in ${method.last4}` : 
                         method.type === 'mobile_money' ? `Mobile Money - ${method.last4}` :
                         `${method.bankName} - ${method.accountNumber}`}
                      </p>
                      <p className="text-sm text-neutral-400">
                        {method.type === 'card' ? `Expires ${method.expiryDate}` : 
                         method.type === 'mobile_money' ? method.phoneNumber :
                         method.accountName}
                      </p>
                    </div>
                    {method.isDefault && (
                      <span className="text-xs bg-lime-400/10 text-lime-400 px-2 py-0.5 rounded">Default</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!method.isDefault && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSetDefaultPayment(method.id)}
                        className="text-neutral-400 hover:text-white"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleDeletePayment(method.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400">No payment methods</p>
                <p className="text-sm text-neutral-500">Add a payment method to start</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-white">Billing History</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-neutral-400 hover:text-white"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-neutral-800/30 border-b border-neutral-700">
                  <div>
                    <p className="font-medium text-white">{invoice.number}</p>
                    <p className="text-sm text-neutral-400">{invoice.createdAt.toDate().toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Currency amount={invoice.total} className="font-semibold text-white" />
                    <StatusBadge status={invoice.status as any} />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDownloadInvoice(invoice)}
                      className="text-neutral-400 hover:text-white"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No invoices yet</p>
              <p className="text-sm text-neutral-500">Your invoices will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Plan Modal */}
      <Modal isOpen={changePlanModalOpen} onClose={() => setChangePlanModalOpen(false)} title="Change Plan">
        <div className="space-y-4">
          <p className="text-neutral-400">Choose a plan that better suits your needs:</p>
          <div className="space-y-3">
            <div 
              className="border border-neutral-700 rounded-lg p-4 cursor-pointer hover:border-lime-400/50 transition bg-neutral-800/30"
              onClick={() => handleChangePlan('Professional Plus')}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Professional Plus</p>
                  <p className="text-sm text-neutral-400">16 cameras, 60 day storage, priority support</p>
                </div>
                <Currency amount={1499} className="font-bold text-lime-400" />
              </div>
            </div>
            <div 
              className="border border-lime-400/50 rounded-lg p-4 cursor-pointer hover:border-lime-400 transition bg-lime-400/5"
              onClick={() => handleChangePlan('Enterprise')}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Enterprise</p>
                  <p className="text-sm text-neutral-400">Unlimited cameras, 90 day storage, dedicated support</p>
                </div>
                <Currency amount={2499} className="font-bold text-lime-400" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setChangePlanModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Subscription">
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-400">Subscription will be cancelled</p>
                <p className="text-sm text-yellow-400/70 mt-1">
                  You will lose access to all services and features immediately.
                  Your data will be retained for 30 days.
                </p>
              </div>
            </div>
          </div>
          <p className="text-neutral-400">Are you sure you want to cancel your subscription?</p>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setCancelModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Keep Subscription
            </Button>
            <Button 
              variant="danger" 
              onClick={handleCancelSubscription}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Yes, Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal isOpen={addPaymentModalOpen} onClose={() => setAddPaymentModalOpen(false)} title="Add Payment Method">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setNewPaymentMethod({ ...newPaymentMethod, type: 'card' })}
              className={`flex-1 p-3 border rounded-lg text-center transition ${
                newPaymentMethod.type === 'card' 
                  ? 'border-lime-400 bg-lime-400/10' 
                  : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
              }`}
            >
              <CreditCard className={`w-6 h-6 mx-auto mb-1 ${newPaymentMethod.type === 'card' ? 'text-lime-400' : 'text-neutral-400'}`} />
              <span className={`text-sm ${newPaymentMethod.type === 'card' ? 'text-white' : 'text-neutral-400'}`}>Card</span>
            </button>
            <button
              onClick={() => setNewPaymentMethod({ ...newPaymentMethod, type: 'mobile_money' })}
              className={`flex-1 p-3 border rounded-lg text-center transition ${
                newPaymentMethod.type === 'mobile_money' 
                  ? 'border-lime-400 bg-lime-400/10' 
                  : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
              }`}
            >
              <Smartphone className={`w-6 h-6 mx-auto mb-1 ${newPaymentMethod.type === 'mobile_money' ? 'text-lime-400' : 'text-neutral-400'}`} />
              <span className={`text-sm ${newPaymentMethod.type === 'mobile_money' ? 'text-white' : 'text-neutral-400'}`}>Mobile Money</span>
            </button>
            <button
              onClick={() => setNewPaymentMethod({ ...newPaymentMethod, type: 'bank_transfer' })}
              className={`flex-1 p-3 border rounded-lg text-center transition ${
                newPaymentMethod.type === 'bank_transfer' 
                  ? 'border-lime-400 bg-lime-400/10' 
                  : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
              }`}
            >
              <Banknote className={`w-6 h-6 mx-auto mb-1 ${newPaymentMethod.type === 'bank_transfer' ? 'text-lime-400' : 'text-neutral-400'}`} />
              <span className={`text-sm ${newPaymentMethod.type === 'bank_transfer' ? 'text-white' : 'text-neutral-400'}`}>Bank Transfer</span>
            </button>
          </div>

          {newPaymentMethod.type === 'card' ? (
            <>
              <Input
                label="Card Number"
                placeholder="1234 5678 9012 3456"
                value={newPaymentMethod.number}
                onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, number: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Expiry Date"
                  placeholder="MM/YY"
                  value={newPaymentMethod.expiry}
                  onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, expiry: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
                />
                <Input
                  label="CVV"
                  type="password"
                  placeholder="123"
                  value={newPaymentMethod.cvv}
                  onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, cvv: e.target.value })}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
                />
              </div>
            </>
          ) : newPaymentMethod.type === 'mobile_money' ? (
            <Input
              label="Mobile Money Number"
              placeholder="0244XXXXXX"
              value={newPaymentMethod.phone}
              onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, phone: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
            />
          ) : (
            <>
              <Input
                label="Bank Name"
                placeholder="Enter bank name"
                value={newPaymentMethod.bankName}
                onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, bankName: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
              <Input
                label="Account Number"
                placeholder="Enter account number"
                value={newPaymentMethod.accountNumber}
                onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, accountNumber: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
              <Input
                label="Account Name"
                placeholder="Enter account name"
                value={newPaymentMethod.accountName}
                onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, accountName: e.target.value })}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setAddPaymentModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddPaymentMethod}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SubscriptionManagement;