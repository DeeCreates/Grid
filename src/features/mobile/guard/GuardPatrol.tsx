// src/features/mobile/guard/GuardPatrol.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, QrCode, Camera, CheckCircle, Navigation,
  RefreshCw, Clock, AlertTriangle, Shield,
  Zap, Star, Award, Flag, BookOpen, ClipboardList,
  Scan, Upload, Image, Video, X, Check,
  ChevronRight, ChevronLeft, MoreVertical,
  Battery, Signal, Wifi, Bluetooth, Phone
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
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

interface Checkpoint {
  id: string;
  name: string;
  location: string;
  status: 'pending' | 'completed' | 'missed' | 'skipped';
  time: Date | null;
  type: 'entrance' | 'exit' | 'perimeter' | 'interior' | 'critical';
  code: string;
  photoEvidence?: string;
  notes?: string;
}

export function GuardPatrol() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [activePatrolId, setActivePatrolId] = useState<string | null>(null);
  const [patrolStats, setPatrolStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    missed: 0,
    progress: 0,
    startTime: null as Date | null,
    estimatedEnd: null as Date | null,
  });
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load patrol data
  const loadPatrol = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get active patrol
      const patrolsQuery = query(
        collection(db, 'patrols'),
        where('guardId', '==', user.uid),
        where('status', '==', 'inProgress'),
        orderBy('startTime', 'desc'),
        limit(1)
      );
      const patrolsSnapshot = await getDocs(patrolsQuery);

      if (!patrolsSnapshot.empty) {
        const patrolData = patrolsSnapshot.docs[0];
        setActivePatrolId(patrolData.id);
        
        const data = patrolData.data();
        const checkpointsList = data.checkpoints || [];
        
        const formattedCheckpoints: Checkpoint[] = checkpointsList.map((c: any) => ({
          id: c.id || `cp-${Date.now()}`,
          name: c.name || 'Unknown',
          location: c.location || 'Unknown',
          status: c.completed ? 'completed' : c.skipped ? 'skipped' : 'pending',
          time: c.completedAt?.toDate() || null,
          type: c.type || 'interior',
          code: c.code || `CP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          photoEvidence: c.photoEvidence || null,
          notes: c.notes || null,
        }));

        setCheckpoints(formattedCheckpoints);

        const completed = formattedCheckpoints.filter(c => c.status === 'completed').length;
        const pending = formattedCheckpoints.filter(c => c.status === 'pending').length;
        const missed = formattedCheckpoints.filter(c => c.status === 'missed').length;
        const total = formattedCheckpoints.length;

        setPatrolStats({
          total,
          completed,
          pending,
          missed,
          progress: total > 0 ? (completed / total) * 100 : 0,
          startTime: data.startTime?.toDate() || null,
          estimatedEnd: data.estimatedEndTime?.toDate() || null,
        });
      } else {
        // No active patrol - show demo checkpoints
        const demoCheckpoints: Checkpoint[] = [
          { id: '1', name: 'Main Entrance', location: 'Zone A', status: 'completed', time: new Date(Date.now() - 30 * 60000), type: 'entrance', code: 'CP-001' },
          { id: '2', name: 'Parking Lot A', location: 'Zone A', status: 'completed', time: new Date(Date.now() - 15 * 60000), type: 'perimeter', code: 'CP-002' },
          { id: '3', name: 'Warehouse Door', location: 'Zone B', status: 'pending', time: null, type: 'exit', code: 'CP-003' },
          { id: '4', name: 'Security Booth', location: 'Zone B', status: 'pending', time: null, type: 'interior', code: 'CP-004' },
          { id: '5', name: 'Loading Dock', location: 'Zone C', status: 'pending', time: null, type: 'perimeter', code: 'CP-005' },
        ];
        setCheckpoints(demoCheckpoints);
        setActivePatrolId(null);
        setPatrolStats({
          total: demoCheckpoints.length,
          completed: demoCheckpoints.filter(c => c.status === 'completed').length,
          pending: demoCheckpoints.filter(c => c.status === 'pending').length,
          missed: 0,
          progress: (demoCheckpoints.filter(c => c.status === 'completed').length / demoCheckpoints.length) * 100,
          startTime: null,
          estimatedEnd: null,
        });
      }

      firebaseUtils.logEvent('guard_patrol_viewed', {
        userId: user.uid,
        activePatrol: !!activePatrolId,
        checkpoints: checkpoints.length,
      });

    } catch (error) {
      console.error('Error loading patrol:', error);
      firebaseUtils.logEvent('guard_patrol_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activePatrolId]);

  // Initial load and real-time updates
  useEffect(() => {
    loadPatrol();

    const patrolsUnsub = onSnapshot(
      query(collection(db, 'patrols'), where('guardId', '==', user?.uid)),
      () => loadPatrol()
    );

    return () => patrolsUnsub();
  }, [loadPatrol, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPatrol();
  };

  const handleStartPatrol = async () => {
    try {
      const patrolData = {
        guardId: user?.uid,
        startTime: serverTimestamp(),
        status: 'inProgress',
        location: 'Zone A',
        checkpoints: [
          { id: 'cp1', name: 'Main Entrance', location: 'Zone A', type: 'entrance', completed: false, code: 'CP-001' },
          { id: 'cp2', name: 'Parking Lot A', location: 'Zone A', type: 'perimeter', completed: false, code: 'CP-002' },
          { id: 'cp3', name: 'Warehouse Door', location: 'Zone B', type: 'exit', completed: false, code: 'CP-003' },
          { id: 'cp4', name: 'Security Booth', location: 'Zone B', type: 'interior', completed: false, code: 'CP-004' },
          { id: 'cp5', name: 'Loading Dock', location: 'Zone C', type: 'perimeter', completed: false, code: 'CP-005' },
        ],
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'patrols'), patrolData);

      firebaseUtils.logEvent('patrol_started', {
        guardId: user?.uid,
      });

      setSuccessMessage('Patrol started successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadPatrol();

    } catch (error: any) {
      setErrorMessage('Failed to start patrol');
      console.error('Error starting patrol:', error);
    }
  };

  const handleVerifyCheckpoint = async (checkpointId: string) => {
    if (!activePatrolId) {
      setErrorMessage('No active patrol. Please start a patrol first.');
      return;
    }

    try {
      const checkpoint = checkpoints.find(c => c.id === checkpointId);
      if (!checkpoint) return;

      // Update checkpoint in Firestore
      const patrolRef = doc(db, 'patrols', activePatrolId);
      const patrolDoc = await getDoc(patrolRef);
      if (patrolDoc.exists()) {
        const data = patrolDoc.data();
        const updatedCheckpoints = (data.checkpoints || []).map((c: any) => {
          if (c.id === checkpointId) {
            return { ...c, completed: true, completedAt: serverTimestamp() };
          }
          return c;
        });

        await updateDoc(patrolRef, {
          checkpoints: updatedCheckpoints,
          updatedAt: serverTimestamp(),
        });
      }

      // Update local state
      setCheckpoints(checkpoints.map(c => 
        c.id === checkpointId ? { ...c, status: 'completed', time: new Date() } : c
      ));

      firebaseUtils.logEvent('checkpoint_verified', {
        checkpointId,
        patrolId: activePatrolId,
        guardId: user?.uid,
      });

      setSuccessMessage('Checkpoint verified!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadPatrol();

    } catch (error: any) {
      setErrorMessage('Failed to verify checkpoint');
      console.error('Error verifying checkpoint:', error);
    }
  };

  const handleTakePhoto = async () => {
    // In production, this would open the camera
    // For demo, we'll simulate photo capture
    setUploading(true);
    try {
      // Simulate photo upload
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setPhotoModalOpen(false);
      setSuccessMessage('Photo captured successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

      firebaseUtils.logEvent('patrol_photo_taken', {
        guardId: user?.uid,
        checkpointId: selectedCheckpoint?.id,
      });

    } catch (error) {
      setErrorMessage('Failed to capture photo');
      console.error('Error capturing photo:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleQRScan = () => {
    setQrModalOpen(false);
    if (selectedCheckpoint) {
      handleVerifyCheckpoint(selectedCheckpoint.id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'pending': return <MapPin className="w-5 h-5 text-neutral-500" />;
      case 'missed': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'skipped': return <X className="w-5 h-5 text-yellow-400" />;
      default: return <MapPin className="w-5 h-5 text-neutral-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-emerald-400/30 bg-emerald-400/5';
      case 'pending': return 'border-neutral-700 bg-neutral-800/30';
      case 'missed': return 'border-red-400/30 bg-red-400/5';
      case 'skipped': return 'border-yellow-400/30 bg-yellow-400/5';
      default: return 'border-neutral-700 bg-neutral-800/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading patrol...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">Patrol Route</h1>
          <p className="text-sm text-neutral-400">
            {activePatrolId ? 'Active patrol in progress' : 'No active patrol'}
          </p>
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
            variant="outline" 
            size="sm"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <Navigation className="w-4 h-4 mr-1" />
            Route Map
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

      {/* Patrol Stats */}
      {activePatrolId && (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white font-medium">Progress</span>
              <span className="text-sm text-lime-400">{patrolStats.progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full">
              <div 
                className="h-2 bg-lime-400 rounded-full transition-all" 
                style={{ width: `${patrolStats.progress}%` }} 
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center">
                <p className="text-xs text-neutral-400">Completed</p>
                <p className="text-lg font-bold text-emerald-400">{patrolStats.completed}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-neutral-400">Pending</p>
                <p className="text-lg font-bold text-yellow-400">{patrolStats.pending}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-neutral-400">Total</p>
                <p className="text-lg font-bold text-white">{patrolStats.total}</p>
              </div>
            </div>
            {patrolStats.startTime && (
              <p className="text-xs text-neutral-500 mt-2">
                Started: {patrolStats.startTime.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start Patrol Button */}
      {!activePatrolId && (
        <Button 
          className="w-full bg-lime-400 text-black hover:bg-lime-300 py-6"
          onClick={handleStartPatrol}
        >
          <Shield className="w-5 h-5 mr-2" />
          Start Patrol
        </Button>
      )}

      {/* Checkpoints */}
      <div className="space-y-3">
        {checkpoints.map((checkpoint, index) => (
          <Card key={checkpoint.id} className={`bg-[#161616] border ${getStatusColor(checkpoint.status)} transition hover:border-lime-400/30`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(checkpoint.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{checkpoint.name}</h3>
                      <span className="text-xs text-neutral-500">{checkpoint.code}</span>
                    </div>
                    <p className="text-xs text-neutral-400">{checkpoint.location}</p>
                    {checkpoint.time && (
                      <p className="text-xs text-neutral-500">Checked at {checkpoint.time.toLocaleTimeString()}</p>
                    )}
                    {checkpoint.type && (
                      <span className="text-[10px] bg-neutral-800/50 text-neutral-400 px-1.5 py-0.5 rounded">
                        {checkpoint.type}
                      </span>
                    )}
                  </div>
                </div>
                {checkpoint.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="bg-lime-400 text-black hover:bg-lime-300 h-8"
                      onClick={() => {
                        setSelectedCheckpoint(checkpoint);
                        setQrModalOpen(true);
                      }}
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      Verify
                    </Button>
                  </div>
                )}
                {checkpoint.status === 'completed' && checkpoint.photoEvidence && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-neutral-400 hover:text-white"
                    onClick={() => {
                      setSelectedCheckpoint(checkpoint);
                      setPhotoModalOpen(true);
                    }}
                  >
                    <Image className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Photo Evidence Card */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4 text-center">
          <div className="w-12 h-12 bg-neutral-800/50 rounded-full flex items-center justify-center mx-auto mb-2">
            <Camera className="w-6 h-6 text-neutral-500" />
          </div>
          <p className="text-sm text-neutral-400">Take photo evidence at each checkpoint</p>
          <p className="text-xs text-neutral-500">Required for verification</p>
          <Button 
            variant="outline" 
            className="mt-2 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            onClick={() => {
              const pendingCheckpoint = checkpoints.find(c => c.status === 'pending');
              if (pendingCheckpoint) {
                setSelectedCheckpoint(pendingCheckpoint);
                setPhotoModalOpen(true);
              } else {
                setErrorMessage('No pending checkpoints to photograph');
                setTimeout(() => setErrorMessage(''), 3000);
              }
            }}
          >
            <Camera className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
        </CardContent>
      </Card>

      {/* QR Scan Modal */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title="Verify Checkpoint">
        <div className="space-y-4 text-center py-4">
          <div className="w-48 h-48 mx-auto bg-neutral-800/50 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <QrCode className="w-16 h-16 text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">Scan QR Code</p>
              <p className="text-xs text-neutral-500">Position the QR code within the frame</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Or enter code manually"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
            />
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={() => {
                setQrModalOpen(false);
                setScannedCode('');
              }}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-lime-400 text-black hover:bg-lime-300"
              onClick={handleQRScan}
              disabled={!scannedCode}
            >
              <Check className="w-4 h-4 mr-2" />
              Verify
            </Button>
          </div>
        </div>
      </Modal>

      {/* Photo Modal */}
      <Modal isOpen={photoModalOpen} onClose={() => setPhotoModalOpen(false)} title="Take Photo Evidence">
        <div className="space-y-4 text-center py-4">
          <div className="w-48 h-48 mx-auto bg-neutral-800/50 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">Camera Preview</p>
              <p className="text-xs text-neutral-500">{selectedCheckpoint?.name}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Any observations..."
            />
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={() => {
                setPhotoModalOpen(false);
                setNotes('');
              }}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-lime-400 text-black hover:bg-lime-300"
              onClick={handleTakePhoto}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default GuardPatrol;