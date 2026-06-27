// src/features/customer/pages/SupportCenter.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  MessageCircle, Phone, Mail, Clock, CheckCircle, 
  AlertCircle, ChevronRight, RefreshCw, Plus,
  Search, Filter, Download, Printer, Send,
  Paperclip, Image, Smile, Mic, Video,
  User, Calendar, Tag, Flag, Star,
  MoreVertical, Edit, Trash2, Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: 'technical' | 'billing' | 'service' | 'emergency' | 'general' | 'complaint';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  assignedToName?: string;
  messages: Message[];
  attachments: Attachment[];
  resolution?: {
    summary: string;
    resolvedAt: Date;
    resolvedBy: string;
  };
  rating?: number;
  feedback?: string;
}

interface Message {
  id: string;
  author: 'customer' | 'agent' | 'system';
  authorName: string;
  content: string;
  timestamp: Date;
  attachments?: string[];
  isRead: boolean;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export function SupportCenter() {
  const { user, userProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    urgent: 0,
  });

  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'technical' as Ticket['category'],
    priority: 'medium' as Ticket['priority'],
    description: '',
  });

  // Load tickets
  const loadTickets = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get tickets from Firestore
      const ticketsQuery = query(
        collection(db, 'supportTickets'),
        where('customerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const ticketsSnapshot = await getDocs(ticketsQuery);
      
      const ticketsData: Ticket[] = [];
      for (const doc of ticketsSnapshot.docs) {
        const data = doc.data();
        const messagesSnapshot = await getDocs(
          query(collection(db, 'supportTickets', doc.id, 'messages'), orderBy('timestamp', 'asc'))
        );
        const messages = messagesSnapshot.docs.map(m => ({
          id: m.id,
          ...m.data(),
          timestamp: m.data().timestamp?.toDate() || new Date(),
        })) as Message[];

        ticketsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          messages,
          attachments: data.attachments || [],
          resolution: data.resolution ? {
            ...data.resolution,
            resolvedAt: data.resolution.resolvedAt?.toDate() || new Date(),
          } : undefined,
        } as Ticket);
      }

      setTickets(ticketsData);

      // Calculate stats
      const open = ticketsData.filter(t => t.status === 'open');
      const inProgress = ticketsData.filter(t => t.status === 'in-progress');
      const resolved = ticketsData.filter(t => t.status === 'resolved');
      const closed = ticketsData.filter(t => t.status === 'closed');
      const urgent = ticketsData.filter(t => t.priority === 'urgent' || t.priority === 'critical');

      setStats({
        total: ticketsData.length,
        open: open.length,
        inProgress: inProgress.length,
        resolved: resolved.length,
        closed: closed.length,
        urgent: urgent.length,
      });

      firebaseUtils.logEvent('support_center_viewed', {
        userId: user.uid,
        totalTickets: ticketsData.length,
        openTickets: open.length,
      });

    } catch (error) {
      console.error('Error loading tickets:', error);
      firebaseUtils.logEvent('support_center_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter tickets
  useEffect(() => {
    let filtered = [...tickets];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.subject?.toLowerCase().includes(query) ||
        t.ticketNumber?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  // Initial load and real-time updates
  useEffect(() => {
    loadTickets();

    const ticketsUnsub = onSnapshot(
      query(collection(db, 'supportTickets'), where('customerId', '==', user?.uid)),
      () => loadTickets()
    );

    return () => ticketsUnsub();
  }, [loadTickets, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTickets();
  };

  const handleCreateTicket = async () => {
    if (!user || !newTicket.subject || !newTicket.description) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      const ticketData = {
        ticketNumber: `TKT-${Date.now().toString().slice(-6)}`,
        subject: newTicket.subject,
        category: newTicket.category,
        priority: newTicket.priority,
        status: 'open',
        customerId: user.uid,
        customerName: userProfile?.displayName || 'Customer',
        customerEmail: user.email || '',
        customerPhone: userProfile?.phoneNumber || '',
        description: newTicket.description,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messages: [],
        attachments: [],
      };

      const docRef = await addDoc(collection(db, 'supportTickets'), ticketData);

      // Add initial message
      await addDoc(collection(db, 'supportTickets', docRef.id, 'messages'), {
        author: 'customer',
        authorName: userProfile?.displayName || 'Customer',
        content: newTicket.description,
        timestamp: serverTimestamp(),
        isRead: true,
      });

      firebaseUtils.logEvent('support_ticket_created', {
        category: newTicket.category,
        priority: newTicket.priority,
      });

      setSuccessMessage('Ticket created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setCreateModalOpen(false);
      setNewTicket({
        subject: '',
        category: 'technical',
        priority: 'medium',
        description: '',
      });
      await loadTickets();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create ticket');
      console.error('Error creating ticket:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'supportTickets', selectedTicket.id, 'messages'), {
        author: 'customer',
        authorName: userProfile?.displayName || 'Customer',
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        isRead: false,
      });

      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        updatedAt: serverTimestamp(),
        status: selectedTicket.status === 'open' ? 'in-progress' : selectedTicket.status,
      });

      setNewMessage('');
      firebaseUtils.logEvent('support_message_sent', {
        ticketId: selectedTicket.id,
      });

      await loadTickets();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send message');
      console.error('Error sending message:', error);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
        'resolution.summary': 'Resolved',
        'resolution.resolvedAt': serverTimestamp(),
        'resolution.resolvedBy': user?.uid,
      });

      firebaseUtils.logEvent('support_ticket_resolved', { ticketId });
      setSuccessMessage('Ticket resolved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadTickets();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to resolve ticket');
      console.error('Error resolving ticket:', error);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'closed',
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('support_ticket_closed', { ticketId });
      setSuccessMessage('Ticket closed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadTickets();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to close ticket');
      console.error('Error closing ticket:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in-progress': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'resolved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'closed': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'urgent': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'high': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'low': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return <AlertCircle className="w-4 h-4" />;
      case 'billing': return <DollarSign className="w-4 h-4" />;
      case 'emergency': return <AlertCircle className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Center</h1>
          <p className="text-neutral-400 mt-1">Get help with your services and report issues</p>
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
            New Ticket
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

      {/* Quick Support Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-blue-400/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="font-semibold text-white">Live Chat</h3>
            <p className="text-sm text-neutral-400 mt-1">Chat with our support team</p>
            <Button variant="outline" size="sm" className="mt-3 border-neutral-700 text-neutral-300 hover:bg-neutral-800">
              Start Chat
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Phone className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white">Call Us</h3>
            <p className="text-sm text-neutral-400 mt-1">24/7 Emergency Support</p>
            <p className="font-medium text-lime-400 mt-2">+233 24 444 5555</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-purple-400/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white">Email Support</h3>
            <p className="text-sm text-neutral-400 mt-1">Response within 1 hour</p>
            <p className="font-medium text-lime-400 mt-2">support@gridsecurity.com</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-neutral-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{stats.open}</p>
            <p className="text-xs text-neutral-400">Open</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-400">{stats.inProgress}</p>
            <p className="text-xs text-neutral-400">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-400">{stats.resolved}</p>
            <p className="text-xs text-neutral-400">Resolved</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-neutral-400">{stats.closed}</p>
            <p className="text-xs text-neutral-400">Closed</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-400">{stats.urgent}</p>
            <p className="text-xs text-neutral-400">Urgent</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search tickets by subject, ID, or category..."
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
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="all">All Categories</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="service">Service</option>
              <option value="emergency">Emergency</option>
              <option value="general">General</option>
              <option value="complaint">Complaint</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Base */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Quick Help</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              'How to access live monitoring?',
              'Troubleshooting camera offline issues',
              'Understanding your storage usage',
              'How to download video footage?',
              'Managing your subscription',
              'Setting up two-factor authentication',
            ].map((topic, index) => (
              <button
                key={index}
                className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg hover:bg-neutral-800 transition group"
              >
                <span className="text-neutral-300 text-sm group-hover:text-white transition">{topic}</span>
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-lime-400 transition" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-white">My Tickets</CardTitle>
          <span className="text-sm text-neutral-400">{filteredTickets.length} tickets</span>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No tickets found</p>
              <p className="text-sm text-neutral-500">Create a support ticket to get help</p>
              <Button 
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 bg-lime-400 text-black hover:bg-lime-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 bg-neutral-800/30 border border-neutral-700 rounded-lg hover:border-lime-400/30 cursor-pointer transition group"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <p className="font-medium text-white">{ticket.subject}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400">
                        Ticket #{ticket.ticketNumber} • {ticket.category} • Created {ticket.createdAt.toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                        {ticket.messages.length > 0 && (
                          <span className="text-xs text-neutral-500">
                            {ticket.messages.length} messages
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
                            setReplyModalOpen(true);
                          }}
                          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(ticket);
                        }}
                        className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Support Ticket" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <Input
            label="Subject *"
            placeholder="Brief description of your issue"
            value={newTicket.subject}
            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Category *</label>
              <select
                value={newTicket.category}
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="technical">Technical Issue</option>
                <option value="billing">Billing</option>
                <option value="service">Service Request</option>
                <option value="emergency">Emergency</option>
                <option value="general">General</option>
                <option value="complaint">Complaint</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Priority</label>
              <select
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Description *</label>
            <textarea
              rows={4}
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Please provide detailed information about your issue..."
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
              onClick={handleCreateTicket}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Submit Ticket
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <Modal 
          isOpen={!!selectedTicket && !replyModalOpen} 
          onClose={() => setSelectedTicket(null)} 
          title={`Ticket ${selectedTicket.ticketNumber}`}
          size="xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Ticket Info */}
            <div className="p-4 bg-neutral-800/30 border border-neutral-700 rounded-lg">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-medium text-white">{selectedTicket.subject}</p>
                  <p className="text-sm text-neutral-400">{selectedTicket.category} • Created {selectedTicket.createdAt.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                </div>
              </div>
              {selectedTicket.assignedToName && (
                <p className="text-sm text-neutral-400 mt-2">
                  Assigned to: {selectedTicket.assignedToName}
                </p>
              )}
            </div>

            {/* Messages */}
            <div className="space-y-3 max-h-80 overflow-y-auto p-2">
              {selectedTicket.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.author === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.author === 'customer' 
                      ? 'bg-lime-400/10 border border-lime-400/20 text-white' 
                      : msg.author === 'agent' 
                        ? 'bg-blue-400/10 border border-blue-400/20 text-white'
                        : 'bg-neutral-800/50 border border-neutral-700 text-neutral-300'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-lime-400">
                        {msg.author === 'customer' ? 'You' : msg.authorName}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              {selectedTicket.messages.length === 0 && (
                <p className="text-center text-neutral-500 py-4">No messages yet</p>
              )}
            </div>

            {/* Reply Input */}
            {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
              <div className="flex gap-2 pt-4 border-t border-neutral-800">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  className="bg-lime-400 text-black hover:bg-lime-300"
                  disabled={!newMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-neutral-800">
              {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                <>
                  <Button 
                    onClick={() => handleResolveTicket(selectedTicket.id)}
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Resolve
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleCloseTicket(selectedTicket.id)}
                    className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                onClick={() => setSelectedTicket(null)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 ml-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SupportCenter;