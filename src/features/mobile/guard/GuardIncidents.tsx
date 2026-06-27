// src/features/mobile/guard/GuardIncidents.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, Camera, Send, X, RefreshCw,
  Search, Filter, Eye, CheckCircle, Clock,
  MapPin, User, Phone, Mail, Calendar,
  Image, Video, File, Paperclip, Upload,
  MessageCircle, MoreVertical, ChevronRight,
  Shield, Zap, Activity, Award, Star
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type { Incident } from '@/types/models';

interface IncidentWithDetails extends Incident {
  reportedBy: string;
  reportedByName: string;
  evidenceCount: number;
  responseTime: number;
}

export function GuardIncidents() {
  const { user, userProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incidents, setIncidents] = useState<IncidentWithDetails[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<IncidentWithDetails[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  // New incident form
  const [newIncident, setNewIncident] = useState({
    type: '',
    location: '',
    address: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    evidence: [] as File[],
  });

  // Load incidents
  const loadIncidents = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get incidents assigned to this guard
      const incidentsQuery = query(
        collection(db, 'incidents'),
        where('assignedTo', 'array-contains', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const incidentsSnapshot = await getDocs(incidentsQuery);
      
      const incidentsData = await Promise.all(
        incidentsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Get reporter info
          let reportedByName = 'Unknown';
          if (data.reportedBy) {
            const userDoc = await getDoc(doc(db, 'users', data.reportedBy));
            if (userDoc.exists()) {
              reportedByName = userDoc.data().displayName || 'Unknown';
            }
          }

          // Calculate response time
          let responseTime = 0;
          if (data.status === 'resolved' && data.resolution?.resolvedAt) {
            responseTime = (data.resolution.resolvedAt.toDate().getTime() - data.timestamp.toDate().getTime()) / 1000 / 60;
          }

          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
            reportedByName,
            evidenceCount: data.evidence?.videoClips?.length || 0,
            responseTime,
          } as IncidentWithDetails;
        })
      );

      setIncidents(incidentsData);

      firebaseUtils.logEvent('guard_incidents_viewed', {
        userId: user.uid,
        totalIncidents: incidentsData.length,
      });

    } catch (error) {
      console.error('Error loading incidents:', error);
      firebaseUtils.logEvent('guard_incidents_error', {
        error: String(error),
        userId: user?.uid,
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
        i.type?.toLowerCase().includes(query) ||
        i.description?.toLowerCase().includes(query) ||
        i.location?.address?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === statusFilter);
    }

    setFilteredIncidents(filtered);
  }, [incidents, searchQuery, statusFilter]);

  // Initial load and real-time updates
  useEffect(() => {
    loadIncidents();

    const incidentsUnsub = onSnapshot(
      query(collection(db, 'incidents'), where('assignedTo', 'array-contains', user?.uid)),
      () => loadIncidents()
    );

    return () => incidentsUnsub();
  }, [loadIncidents, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIncidents();
  };

  const handleReportIncident = async () => {
    if (!user || !newIncident.type || !newIncident.location || !newIncident.description) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setErrorMessage('');

    try {
      // Upload evidence files
      const evidenceUrls: string[] = [];
      for (const file of newIncident.evidence) {
        const fileRef = ref(storage, `incidents/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        evidenceUrls.push(url);
      }

      // Create incident
      const incidentData = {
        type: newIncident.type,
        severity: newIncident.severity,
        status: 'detected',
        timestamp: serverTimestamp(),
        location: {
          address: newIncident.location,
          coordinates: null,
        },
        address: newIncident.location,
        description: newIncident.description,
        evidence: {
          videoClips: [],
          screenshots: evidenceUrls,
          audio: [],
        },
        assignedTo: [user.uid],
        reportedBy: user.uid,
        escalation: {
          level: 1,
          notified: [],
          timestamp: serverTimestamp(),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'incidents'), incidentData);

      firebaseUtils.logEvent('incident_reported', {
        type: newIncident.type,
        severity: newIncident.severity,
        userId: user.uid,
      });

      setSuccessMessage('Incident reported successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setReportModalOpen(false);
      setNewIncident({
        type: '',
        location: '',
        address: '',
        description: '',
        severity: 'medium',
        evidence: [],
      });
      await loadIncidents();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to report incident');
      console.error('Error reporting incident:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    try {
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'resolved',
        'resolution.actions': ['Investigated and resolved by guard'],
        'resolution.resolvedBy': user?.uid,
        'resolution.resolvedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('incident_resolved', {
        incidentId,
        userId: user?.uid,
      });

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
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'escalated',
        'escalation.level': 2,
        'escalation.timestamp': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('incident_escalated', {
        incidentId,
        userId: user?.uid,
      });

      setSuccessMessage('Incident escalated!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadIncidents();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to escalate incident');
      console.error('Error escalating incident:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewIncident({
      ...newIncident,
      evidence: [...newIncident.evidence, ...files],
    });
  };

  const removeFile = (index: number) => {
    setNewIncident({
      ...newIncident,
      evidence: newIncident.evidence.filter((_, i) => i !== index),
    });
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
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading incidents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">Incident Reports</h1>
          <p className="text-sm text-neutral-400">Manage and report security incidents</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-neutral-800 p-2 rounded-full hover:bg-neutral-700 transition"
          >
            <RefreshCw className={`w-4 h-4 text-neutral-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Button 
            onClick={() => setReportModalOpen(true)}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Report
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
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-neutral-500" />}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
        >
          <option value="all">All</option>
          <option value="detected">Detected</option>
          <option value="verified">Verified</option>
          <option value="assigned">Assigned</option>
          <option value="investigating">Investigating</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Incidents List */}
      {filteredIncidents.length > 0 ? (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => (
            <Card key={incident.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${
                        incident.severity === 'critical' ? 'text-red-400' : 
                        incident.severity === 'high' ? 'text-orange-400' : 
                        'text-yellow-400'
                      }`} />
                      <h3 className="font-semibold text-white">{incident.type}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400">{incident.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {incident.location?.address || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {incident.timestamp.toLocaleTimeString()}
                      </span>
                      {incident.evidenceCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {incident.evidenceCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedIncident(incident);
                        setDetailModalOpen(true);
                      }}
                      className="text-neutral-400 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">No incidents found</p>
            <p className="text-sm text-neutral-500">Report an incident to get started</p>
            <Button 
              onClick={() => setReportModalOpen(true)}
              className="mt-4 bg-lime-400 text-black hover:bg-lime-300"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Report Incident
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report Incident Modal */}
      <Modal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} title="Report Incident" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Incident Type *"
              placeholder="e.g., Suspicious Person, Theft, Vandalism"
              value={newIncident.type}
              onChange={(e) => setNewIncident({ ...newIncident, type: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
            />
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Severity</label>
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
            placeholder="Where did this occur?"
            value={newIncident.location}
            onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
            icon={<MapPin className="w-4 h-4 text-neutral-500" />}
          />

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Description *</label>
            <textarea
              rows={4}
              value={newIncident.description}
              onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Provide detailed information about the incident..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">Evidence (Photos/Videos)</label>
            <div className="border-2 border-dashed border-neutral-700 rounded-lg p-4 text-center hover:border-lime-400/50 transition">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="evidence-upload"
              />
              <label htmlFor="evidence-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">Click to upload evidence</p>
                <p className="text-xs text-neutral-500">Images, videos, or documents</p>
              </label>
            </div>
            {newIncident.evidence.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {newIncident.evidence.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 bg-neutral-800/50 px-2 py-1 rounded text-xs text-neutral-300">
                    <File className="w-3 h-3" />
                    {file.name}
                    <button onClick={() => removeFile(index)} className="text-red-400 hover:text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={() => setReportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-lime-400 text-black hover:bg-lime-300"
              onClick={handleReportIncident}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Incident Detail Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Incident Details" size="lg">
        {selectedIncident && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${
                    selectedIncident.severity === 'critical' ? 'text-red-400' : 
                    selectedIncident.severity === 'high' ? 'text-orange-400' : 
                    'text-yellow-400'
                  }`} />
                  <h3 className="text-lg font-bold text-white">{selectedIncident.type}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedIncident.status)}`}>
                    {selectedIncident.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-400 mt-1">ID: {selectedIncident.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Location</p>
                <p className="text-white">{selectedIncident.location?.address || 'Unknown'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Reported</p>
                <p className="text-white">{selectedIncident.timestamp.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Reported By</p>
                <p className="text-white">{selectedIncident.reportedByName}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Severity</p>
                <p className="text-white capitalize">{selectedIncident.severity}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Description</p>
              <p className="text-white bg-neutral-800/30 p-3 rounded-lg">{selectedIncident.description}</p>
            </div>

            {selectedIncident.evidence && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Evidence</p>
                <div className="flex flex-wrap gap-2">
                  {selectedIncident.evidence.screenshots?.map((url, index) => (
                    <div key={index} className="w-20 h-20 bg-neutral-800/50 rounded-lg flex items-center justify-center">
                      <Image className="w-8 h-8 text-neutral-500" />
                    </div>
                  ))}
                  {selectedIncident.evidence.videoClips?.map((url, index) => (
                    <div key={index} className="w-20 h-20 bg-neutral-800/50 rounded-lg flex items-center justify-center">
                      <Video className="w-8 h-8 text-neutral-500" />
                    </div>
                  ))}
                  {!selectedIncident.evidence.screenshots?.length && !selectedIncident.evidence.videoClips?.length && (
                    <p className="text-sm text-neutral-500">No evidence uploaded</p>
                  )}
                </div>
              </div>
            )}

            {selectedIncident.resolution && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs text-emerald-400 font-medium">Resolution</p>
                <p className="text-sm text-white mt-1">{selectedIncident.resolution.notes || 'Resolved'}</p>
                <p className="text-xs text-emerald-400/70 mt-1">
                  Resolved at {selectedIncident.resolution.resolvedAt?.toDate().toLocaleString()}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-neutral-800">
              {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                <>
                  <Button 
                    onClick={() => handleResolveIncident(selectedIncident.id)}
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Resolve
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleEscalateIncident(selectedIncident.id)}
                    className="border-purple-700/50 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Escalate
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                onClick={() => setDetailModalOpen(false)}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 ml-auto"
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

export default GuardIncidents;