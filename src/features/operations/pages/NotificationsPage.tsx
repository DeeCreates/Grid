// src/features/operations/pages/NotificationsPage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCheck, Trash2, RefreshCw, Search,
  Settings, AlertCircle, CheckCircle, Info, 
  AlertTriangle, Calendar, DollarSign, Package, 
  Shield, Zap, X, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';

// Simple notification interface
interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert';
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  read: boolean;
  createdAt: Date;
  data?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
}

function NotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Notification[];
        
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
        setLoading(false);
      }, (err) => {
        console.error('Notifications error:', err);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error('Error setting up notifications:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'alert': return <Bell className="w-5 h-5 text-red-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'low': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-neutral-400 bg-neutral-400/10';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q);
    }
    return true;
  });

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <h2 className="text-red-400 font-medium">Error loading notifications</h2>
          <p className="text-red-400/70 text-sm mt-1">{error}</p>
          <Button 
            className="mt-3 bg-lime-400 text-black hover:bg-lime-300"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-400/10 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Notifications</h1>
              <p className="text-neutral-400 text-sm">Stay updated with your security alerts</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read ({unreadCount})
            </Button>
          )}
          <Button className="bg-lime-400 text-black hover:bg-lime-300">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-white">{notifications.length}</p>
            <p className="text-xs text-neutral-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-lime-400">{unreadCount}</p>
            <p className="text-xs text-neutral-400">Unread</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400">0</p>
            <p className="text-xs text-neutral-400">Service</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-400">0</p>
            <p className="text-xs text-neutral-400">Incidents</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-neutral-500" />}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-0">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {filteredNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-neutral-800/30 transition cursor-pointer',
                    !notification.read ? 'bg-neutral-800/20' : ''
                  )}
                  onClick={() => {
                    setSelectedNotification(notification);
                    setDetailModalOpen(true);
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-neutral-800/50 flex items-center justify-center flex-shrink-0">
                      {getTypeIcon(notification.type || 'info')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              'text-sm font-medium',
                              !notification.read ? 'text-white' : 'text-neutral-400'
                            )}>
                              {notification.title || 'Untitled Notification'}
                            </p>
                            {!notification.read && (
                              <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-neutral-400 mt-0.5 line-clamp-2">
                            {notification.body || 'No message'}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-neutral-500">
                              {notification.createdAt ? formatDistanceToNow(notification.createdAt, { addSuffix: true }) : 'Just now'}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {notification.category || 'general'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No notifications found</p>
              <p className="text-sm text-neutral-500">You're all caught up!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Notification Details" size="lg">
        {selectedNotification && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-neutral-800/50 flex items-center justify-center flex-shrink-0">
                {getTypeIcon(selectedNotification.type || 'info')}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{selectedNotification.title || 'Untitled'}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-neutral-500">
                    {selectedNotification.createdAt ? formatDistanceToNow(selectedNotification.createdAt, { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-800/30 p-4 rounded-lg">
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">
                {selectedNotification.body || 'No message'}
              </p>
            </div>

            <div className="flex gap-2 pt-4 border-t border-neutral-800">
              <Button 
                variant="outline" 
                onClick={() => setDetailModalOpen(false)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


export default NotificationsPage;