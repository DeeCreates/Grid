// src/features/command-center/pages/IncidentManagement.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, CheckCircle, Clock, MapPin, 
  Plus, RefreshCw, Eye, Edit, Trash2, 
  Send, UserPlus, Filter, Download, Search,
  Shield, Zap, Activity, Users, Camera,
  XCircle, Check, AlertCircle, Bell
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  incidentService, 
  alertService,
  serviceService
} from '@/services/firebase/firestore.service';
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
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Incident, Alert } from '@/types/models';

interface IncidentStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  inProgress: number;
  resolvedToday: number;
  total: number;
  avgResolutionTime: number;
}

export function IncidentManagement() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    inProgress: 0,
    resolvedToday: 0,
    total: 0,
    avgResolutionTime: 0,
  });
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // New incident form
  const [newIncident, setNewIncident] = useState({
    type: 'security' as 'security' | 'technical' | 'system',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    description: '',
    location: '',
    address: '',
    notes: '',
  });

  // Available personnel for assignment
  const [availablePersonnel, setAvailablePersonnel] = useState<{id: string; name: string; role: string}[]>([]);

  // Load incidents
  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);

      const [incidentsData, alertsData, servicesData] = await Promise.all([
        incidentService.getAll(),
        alertService.getAll(),
        serviceService.getAll(),
      ]);

      // Sort by timestamp desc
      const sorted = incidentsData.sort((a, b) => 
        b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
      );
      setIncidents(sorted);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const critical = sorted.filter(i => i.severity === 'critical' && i.status !== 'closed').length;
      const high = sorted.filter(i => i.severity === 'high' && i.status !== 'closed').length;
      const medium = sorted.filter(i => i.severity === 'medium' && i.status !== 'closed').length;
      const low = sorted.filter(i => i.severity === 'low' && i.status !== 'closed').length;
      const inProgress = sorted.filter(i => i.status === 'investigating' || i.status === 'assigned').length;
      const resolvedToday = sorted.filter(i => 
        i.status === 'resolved' && 
        i.resolution?.resolvedAt?.toDate() >= today
      ).length;

      // Average resolution time
      const resolved = sorted.filter(i => i.status === 'resolved' && i.resolution?.resolvedAt);
      const avgResolutionTime = resolved.length > 0
        ? resolved.reduce((sum, i) => {
            const diff = (i.resolution!.resolvedAt!.toDate().getTime() - i.timestamp.toDate().getTime()) / 1000 / 60;
            return sum + diff;
          }, 0) / resolved.length
        : 0;

      setStats({
        critical,
        high,
        medium,
        low,
        inProgress,
        resolvedToday,
        total: sorted.length,
        avgResolutionTime,
      });

      // Load available personnel (users with roles)
      const usersSnapshot = await getDocs(query(
        collection(db, 'users'),
        where('role', 'in', ['admin', 'guard', 'technician']),
        where('isActive', '==', true)
      ));
      const personnel = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || doc.data().email,
        role: doc.data().role,
      }));
      setAvailablePersonnel(personnel);

      firebaseUtils.logEvent('incident_management_viewed', {
        userId: user?.uid,
        totalIncidents: sorted.length,
        critical,
      });

    } catch (error) {
      console.error('Error loading incidents:', error);
      firebaseUtils.logEvent('incident_management_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter incidents
  useEffect(() => {
    let filtered = [...incidents];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        i.description?.toLowerCase().includes(query) ||
        i.type?.toLowerCase().includes(query) ||
        i.address?.toLowerCase().includes(query) ||
        i.id?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === statusFilter);
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter(i => i.severity === severityFilter);
    }

    setFilteredIncidents(filtered);
  }, [incidents, searchQuery, statusFilter, severityFilter]);

  // Initial load
  useEffect(() => {
    loadIncidents();

    // Real-time updates
    const incidentsUnsub = incidentService.listenAll(() => {
      loadIncidents();
    });

    return () => incidentsUnsub();
  }, [loadIncidents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIncidents();
  };

  const handleCreateIncident = async () => {
    if (!newIncident.description || !newIncident.location) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      const incidentData = {
        type: newIncident.type,
        severity: newIncident.severity,
        status: 'detected' as const,
        description: newIncident.description,
        location: { latitude: 0, longitude: 0 }, // Would get from geocoding
        address: newIncident.address || newIncident.location,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        assignedTo: [],
        escalation: {
          level: 1,
          notified: [],
          timestamp: Timestamp.now(),
        },
        evidence: {
          videoClips: [],
          screenshots: [],
          audio: [],
        },
        notes: newIncident.notes,
      };

      const docRef = await addDoc(collection(db, 'incidents'), incidentData);

      firebaseUtils.logEvent('incident_created', {
        type: newIncident.type,
        severity: newIncident.severity,
      });

      setSuccessMessage('Incident created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setCreateModalOpen(false);
      setNewIncident({
        type: 'security',
        severity: 'medium',
        description: '',
        location: '',
        address: '',
        notes: '',
      });
      await loadIncidents();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create incident');
      console.error('Error creating incident:', error);
    }
  };

  const handleAssignIncident = async (incidentId: string, personnelId: string) => {
    try {
      const personnel = availablePersonnel.find(p => p.id === personnelId);
      
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'assigned',
        assignedTo: [...(selectedIncident?.assignedTo || []), personnelId],
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('incident_assigned', {
        incidentId,
        personnelId,
      });

      setSuccessMessage(`Assigned to ${personnel?.name || 'personnel'}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setAssignModalOpen(false);
      await loadIncidents();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to assign incident');
      console.error('Error assigning incident:', error);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    if (!confirm('Mark this incident as resolved?')) return;

    try {
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'resolved',
        'resolution.actions': ['Investigated and resolved'],
        'resolution.resolvedBy': user?.uid,
        'resolution.resolvedAt': Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('incident_resolved', { incidentId });
      setSuccessMessage('Incident resolved!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadIncidents();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to resolve incident');
      console.error('Error resolving incident:', error);
    }
  };

  const handleEscalateIncident = async (incidentId: string) => {
    try {
      const incident = incidents.find(i => i.id === incidentId);
      const newLevel = (incident?.escalation?.level || 0) + 1;
      
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'escalated',
        'escalation.level': newLevel,
        'escalation.timestamp': Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('incident_escalated', {
        incidentId,
        level: newLevel,
      });

      setSuccessMessage(`Incident escalated to level ${newLevel}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadIncidents();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to escalate incident');
      console.error('Error escalating incident:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default: return <AlertCircle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'detected': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'verified': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'assigned': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'investigating': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'escalated': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'resolved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'closed': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading incidents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Incident Management</h1>
          <p className="text-neutral-400 mt-1">Manage and track all security incidents</p>
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
            Create Incident
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
            <p className="text-xs text-neutral-400">Critical</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{stats.high}</p>
            <p className="text-xs text-neutral-400">High</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.medium}</p>
            <p className="text-xs text-neutral-400">Medium</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.low}</p>
            <p className="text-xs text-neutral-400">Low</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.inProgress}</p>
            <p className="text-xs text-neutral-400">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.resolvedToday}</p>
            <p className="text-xs text-neutral-400">Resolved Today</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-lime-400">{stats.avgResolutionTime.toFixed(0)}m</p>
            <p className="text-xs text-neutral-400">Avg Resolution</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search incidents by ID, type, or location..."
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
              <option value="detected">Detected</option>
              <option value="verified">Verified</option>
              <option value="assigned">Assigned</option>
              <option value="investigating">Investigating</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button 
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      <div className="space-y-3">
        {filteredIncidents.length > 0 ? (
          filteredIncidents.map((incident) => (
            <Card key={incident.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      {getSeverityIcon(incident.severity)}
                      <h3 className="font-semibold text-white capitalize">{incident.type} - {incident.id}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 mb-2">{incident.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {incident.address || incident.location?.address || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {incident.timestamp.toDate().toLocaleString()}
                      </span>
                      {incident.assignedTo && incident.assignedTo.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {incident.assignedTo.length} assigned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setSelectedIncident(incident);
                        setDetailsModalOpen(true);
                      }}
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {incident.status !== 'resolved' && incident.status !== 'closed' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedIncident(incident);
                            setAssignModalOpen(true);
                          }}
                          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEscalateIncident(incident.id)}
                          className="border-purple-700/50 text-purple-400 hover:bg-purple-500/10"
                        >
                          <Zap className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleResolveIncident(incident.id)}
                          className="bg-emerald-500 text-white hover:bg-emerald-600"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400">No incidents found</p>
              <p className="text-sm text-neutral-500">Try adjusting your filters</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Incident Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Incident" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Type *</label>
              <select
                value={newIncident.type}
                onChange={(e) => setNewIncident({ ...newIncident, type: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="security">Security</option>
                <option value="technical">Technical</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Severity *</label>
              <select
                value={newIncident.severity}
                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value as any })}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <Input
            label="Location *"
            value={newIncident.location}
            onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white"
            icon={<MapPin className="w-4 h-4 text-neutral-500" />}
          />
          <Input
            label="Address"
            value={newIncident.address}
            onChange={(e) => setNewIncident({ ...newIncident, address: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white"
          />
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Description *</label>
            <textarea
              value={newIncident.description}
              onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
              rows={4}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Describe the incident..."
            />
          </div>
          <Input
            label="Notes"
            value={newIncident.notes}
            onChange={(e) => setNewIncident({ ...newIncident, notes: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white"
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setCreateModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateIncident}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Incident
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Incident Modal */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Personnel">
        {selectedIncident && (
          <div className="space-y-4">
            <div className="bg-neutral-800/30 p-3 rounded-lg">
              <p className="font-medium text-white">{selectedIncident.id}</p>
              <p className="text-sm text-neutral-400">{selectedIncident.description}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Available Personnel</p>
              {availablePersonnel.length > 0 ? (
                availablePersonnel.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg hover:border-lime-400/30 transition">
                    <div>
                      <p className="font-medium text-white">{person.name}</p>
                      <p className="text-sm text-neutral-400 capitalize">{person.role}</p>
                    </div>
                    <Button 
                      onClick={() => handleAssignIncident(selectedIncident.id, person.id)}
                      className="bg-lime-400 text-black hover:bg-lime-300"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-neutral-400 text-center py-4">No available personnel</p>
              )}
            </div>
            <div className="flex justify-end pt-4 border-t border-neutral-800">
              <Button 
                variant="outline" 
                onClick={() => setAssignModalOpen(false)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Incident Details Modal */}
      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Incident Details" size="lg">
        {selectedIncident && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  {getSeverityIcon(selectedIncident.severity)}
                  <h3 className="text-lg font-bold text-white">{selectedIncident.id}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedIncident.status)}`}>
                    {selectedIncident.status}
                  </span>
                </div>
                <p className="text-neutral-400 mt-1">{selectedIncident.type}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Location</p>
                <p className="text-white">{selectedIncident.address || 'Unknown'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Reported</p>
                <p className="text-white">{selectedIncident.timestamp.toDate().toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-neutral-500 mb-1">Description</p>
              <p className="text-white bg-neutral-800/30 p-3 rounded-lg">{selectedIncident.description}</p>
            </div>

            {selectedIncident.assignedTo && selectedIncident.assignedTo.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">Assigned To</p>
                <div className="flex flex-wrap gap-2">
                  {selectedIncident.assignedTo.map((id) => {
                    const person = availablePersonnel.find(p => p.id === id);
                    return person ? (
                      <span key={id} className="text-sm bg-neutral-800/50 text-white px-3 py-1 rounded">
                        {person.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {selectedIncident.resolution && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs text-emerald-400 font-medium">Resolution</p>
                <p className="text-sm text-white mt-1">{selectedIncident.resolution.notes || 'Resolved'}</p>
                <p className="text-xs text-emerald-400/70 mt-1">
                  Resolved by: {selectedIncident.resolution.resolvedBy || 'System'} at {selectedIncident.resolution.resolvedAt?.toDate().toLocaleString()}
                </p>
              </div>
            )}

            {selectedIncident.escalation && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <p className="text-xs text-purple-400 font-medium">Escalation Level {selectedIncident.escalation.level}</p>
                <p className="text-sm text-white mt-1">Notified: {selectedIncident.escalation.notified?.join(', ') || 'None'}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)} className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                Close
              </Button>
              {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                <Button 
                  onClick={() => handleResolveIncident(selectedIncident.id)}
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Resolve
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default IncidentManagement;