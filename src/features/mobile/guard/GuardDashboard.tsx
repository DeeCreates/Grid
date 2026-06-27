// src/features/mobile/guard/GuardDashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, Clock, AlertTriangle, CheckCircle, Navigation,
  RefreshCw, Shield, Users, Camera, Activity,
  Bell, Calendar, Phone, MessageCircle, Search,
  Filter, Plus, Eye, MoreVertical, ChevronRight,
  Battery, Signal, Wifi, Bluetooth, Zap,
  Star, Award, Flag, BookOpen, ClipboardList
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Incident, Alert, Patrol } from '@/types/models';

interface Checkpoint {
  id: string;
  name: string;
  location: string;
  status: 'pending' | 'completed' | 'missed';
  time?: Date;
  type: 'entrance' | 'exit' | 'perimeter' | 'interior' | 'critical';
}

export function GuardDashboard() {
  const { user, userProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPatrol, setCurrentPatrol] = useState<{
    active: boolean;
    location: string;
    checkpointsCompleted: number;
    totalCheckpoints: number;
    nextCheckpoint: string;
    startTime: Date | null;
    estimatedEndTime: Date | null;
  }>({
    active: false,
    location: 'Not assigned',
    checkpointsCompleted: 0,
    totalCheckpoints: 0,
    nextCheckpoint: 'No patrol assigned',
    startTime: null,
    estimatedEndTime: null,
  });
  
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    totalPatrols: 0,
    completedCheckpoints: 0,
    incidentsReported: 0,
    alertsResolved: 0,
  });
  const [guardInfo, setGuardInfo] = useState({
    name: '',
    badgeNumber: '',
    shift: 'Day',
    status: 'on-duty',
    rating: 4.8,
  });

  // Load guard data
  const loadGuardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get guard profile
      if (userProfile) {
        setGuardInfo({
          name: userProfile.displayName || 'Guard',
          badgeNumber: userProfile.badgeNumber || `GRD-${user.uid.slice(-6)}`,
          shift: userProfile.shift || 'Day',
          status: userProfile.isActive ? 'on-duty' : 'off-duty',
          rating: userProfile.rating || 4.8,
        });
      }

      // Get current patrol
      const patrolsQuery = query(
        collection(db, 'patrols'),
        where('guardId', '==', user.uid),
        where('status', '==', 'inProgress'),
        orderBy('startTime', 'desc'),
        limit(1)
      );
      const patrolsSnapshot = await getDocs(patrolsQuery);
      
      if (!patrolsSnapshot.empty) {
        const patrolData = patrolsSnapshot.docs[0].data();
        const checkpointsList = patrolData.checkpoints || [];
        const completed = checkpointsList.filter((c: any) => c.completed).length;
        const next = checkpointsList.find((c: any) => !c.completed);
        
        setCurrentPatrol({
          active: true,
          location: patrolData.location || 'Zone A',
          checkpointsCompleted: completed,
          totalCheckpoints: checkpointsList.length,
          nextCheckpoint: next?.name || 'All completed',
          startTime: patrolData.startTime?.toDate() || null,
          estimatedEndTime: patrolData.estimatedEndTime?.toDate() || null,
        });
        
        setCheckpoints(checkpointsList.map((c: any) => ({
          id: c.id,
          name: c.name,
          location: c.location,
          status: c.completed ? 'completed' : 'pending',
          time: c.completedAt?.toDate(),
          type: c.type || 'interior',
        })));
      } else {
        setCurrentPatrol({
          active: false,
          location: 'No active patrol',
          checkpointsCompleted: 0,
          totalCheckpoints: 0,
          nextCheckpoint: 'Start a patrol',
          startTime: null,
          estimatedEndTime: null,
        });
        setCheckpoints([]);
      }

      // Get recent incidents
      const incidentsQuery = query(
        collection(db, 'incidents'),
        where('assignedTo', 'array-contains', user.uid),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const incidentsSnapshot = await getDocs(incidentsQuery);
      const incidentsData = incidentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Incident[];
      setRecentIncidents(incidentsData);

      // Get alerts
      const alertsQuery = query(
        collection(db, 'alerts'),
        where('assignedTo', '==', user.uid),
        where('resolvedAt', '==', null),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const alertsSnapshot = await getDocs(alertsQuery);
      const alertsData = alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Alert[];
      setAlerts(alertsData);

      // Calculate stats
      const allPatrols = await getDocs(
        query(collection(db, 'patrols'), where('guardId', '==', user.uid))
      );
      const allIncidents = await getDocs(
        query(collection(db, 'incidents'), where('assignedTo', 'array-contains', user.uid))
      );
      const allAlerts = await getDocs(
        query(collection(db, 'alerts'), where('assignedTo', '==', user.uid))
      );

      setStats({
        totalPatrols: allPatrols.size,
        completedCheckpoints: 0, // Would need to sum from patrols
        incidentsReported: allIncidents.size,
        alertsResolved: allAlerts.docs.filter(d => d.data().resolvedAt).length,
      });

      firebaseUtils.logEvent('guard_dashboard_viewed', {
        userId: user.uid,
        activePatrol: !patrolsSnapshot.empty,
        incidents: incidentsData.length,
      });

    } catch (error) {
      console.error('Error loading guard data:', error);
      firebaseUtils.logEvent('guard_dashboard_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userProfile]);

  // Initial load and real-time updates
  useEffect(() => {
    loadGuardData();

    // Real-time updates
    const patrolsUnsub = onSnapshot(
      query(collection(db, 'patrols'), where('guardId', '==', user?.uid)),
      () => loadGuardData()
    );

    const incidentsUnsub = onSnapshot(
      query(collection(db, 'incidents'), where('assignedTo', 'array-contains', user?.uid)),
      () => loadGuardData()
    );

    return () => {
      patrolsUnsub();
      incidentsUnsub();
    };
  }, [loadGuardData, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGuardData();
  };

  const handleStartPatrol = async () => {
    try {
      await addDoc(collection(db, 'patrols'), {
        guardId: user?.uid,
        guardName: guardInfo.name,
        startTime: serverTimestamp(),
        status: 'inProgress',
        location: 'Zone A',
        checkpoints: [
          { id: 'cp1', name: 'Main Entrance', location: 'Zone A', type: 'entrance', completed: false },
          { id: 'cp2', name: 'Parking Lot', location: 'Zone A', type: 'perimeter', completed: false },
          { id: 'cp3', name: 'Warehouse Door', location: 'Zone A', type: 'exit', completed: false },
          { id: 'cp4', name: 'Security Booth', location: 'Zone A', type: 'interior', completed: false },
        ],
        createdAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('patrol_started', {
        guardId: user?.uid,
      });

      await loadGuardData();

    } catch (error) {
      console.error('Error starting patrol:', error);
    }
  };

  const handleCompleteCheckpoint = async (checkpointId: string) => {
    try {
      // In production, this would update the checkpoint in Firestore
      setCheckpoints(checkpoints.map(c => 
        c.id === checkpointId ? { ...c, status: 'completed', time: new Date() } : c
      ));
      
      firebaseUtils.logEvent('checkpoint_completed', {
        checkpointId,
        guardId: user?.uid,
      });

    } catch (error) {
      console.error('Error completing checkpoint:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-lime-400 to-emerald-400 text-black p-4 rounded-xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">Guard Dashboard</h1>
            <p className="text-black/80">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {guardInfo.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded">{guardInfo.badgeNumber}</span>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded">{guardInfo.shift} Shift</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-black/20 p-2 rounded-full hover:bg-black/30 transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <StatusBadge status={guardInfo.status === 'on-duty' ? 'active' : 'inactive'} />
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{guardInfo.rating}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Patrols</p>
              <p className="text-lg font-bold text-white">{stats.totalPatrols}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Checkpoints</p>
              <p className="text-lg font-bold text-white">{stats.completedCheckpoints}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Incidents</p>
              <p className="text-lg font-bold text-white">{stats.incidentsReported}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Resolved</p>
              <p className="text-lg font-bold text-white">{stats.alertsResolved}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Patrol */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-white">Current Patrol</h2>
            <StatusBadge status={currentPatrol.active ? 'active' : 'inactive'} />
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-neutral-400">
              <MapPin className="w-4 h-4 text-neutral-500" />
              {currentPatrol.location}
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {currentPatrol.checkpointsCompleted}/{currentPatrol.totalCheckpoints} Checkpoints
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <Navigation className="w-4 h-4 text-lime-400" />
              Next: {currentPatrol.nextCheckpoint}
            </div>
            {currentPatrol.startTime && (
              <div className="flex items-center gap-2 text-neutral-400">
                <Clock className="w-4 h-4 text-neutral-500" />
                Started: {currentPatrol.startTime.toLocaleTimeString()}
              </div>
            )}
          </div>
          <div className="mt-3 h-1.5 bg-neutral-800 rounded-full">
            <div 
              className="h-1.5 bg-lime-400 rounded-full transition-all" 
              style={{ 
                width: `${currentPatrol.totalCheckpoints > 0 
                  ? (currentPatrol.checkpointsCompleted / currentPatrol.totalCheckpoints) * 100 
                  : 0}%` 
              }} 
            />
          </div>
          <Button 
            className="w-full mt-4 bg-lime-400 text-black hover:bg-lime-300"
            onClick={currentPatrol.active ? handleCompleteCheckpoint : handleStartPatrol}
          >
            {currentPatrol.active ? 'Continue Patrol' : 'Start Patrol'}
          </Button>
        </CardContent>
      </Card>

      {/* Checkpoints */}
      {checkpoints.length > 0 && (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-white">Checkpoints</h2>
              <span className="text-xs text-neutral-400">
                {checkpoints.filter(c => c.status === 'completed').length}/{checkpoints.length} done
              </span>
            </div>
            <div className="space-y-2">
              {checkpoints.slice(0, 4).map((checkpoint) => (
                <div 
                  key={checkpoint.id} 
                  className={`flex items-center justify-between p-2 rounded-lg transition ${
                    checkpoint.status === 'completed' 
                      ? 'bg-emerald-400/10 border border-emerald-400/20' 
                      : 'bg-neutral-800/30 border border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {checkpoint.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <MapPin className="w-4 h-4 text-neutral-500" />
                    )}
                    <div>
                      <p className="text-sm text-white">{checkpoint.name}</p>
                      <p className="text-xs text-neutral-400">{checkpoint.location}</p>
                    </div>
                  </div>
                  {checkpoint.status === 'pending' && (
                    <Button 
                      size="sm" 
                      className="bg-lime-400 text-black hover:bg-lime-300 h-7 text-xs"
                      onClick={() => handleCompleteCheckpoint(checkpoint.id)}
                    >
                      Complete
                    </Button>
                  )}
                  {checkpoint.status === 'completed' && checkpoint.time && (
                    <span className="text-xs text-neutral-500">
                      {checkpoint.time.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Incidents */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-white">Recent Incidents</h2>
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white h-7 text-xs">
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {recentIncidents.length > 0 ? (
              recentIncidents.slice(0, 3).map((incident) => (
                <div key={incident.id} className="flex items-center justify-between p-2 bg-neutral-800/30 rounded-lg border border-neutral-700">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${
                      incident.severity === 'critical' ? 'text-red-400' : 
                      incident.severity === 'high' ? 'text-orange-400' : 
                      'text-yellow-400'
                    }`} />
                    <div>
                      <p className="text-sm text-white">{incident.type}</p>
                      <p className="text-xs text-neutral-400">{incident.location?.address || 'Unknown'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {incident.timestamp.toDate().toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">No recent incidents</p>
                <p className="text-xs text-neutral-500">All clear</p>
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            className="w-full mt-3 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Incident
          </Button>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="bg-[#161616] border-neutral-800 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-yellow-400" />
              <h2 className="font-semibold text-white">Active Alerts</h2>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                {alerts.length}
              </span>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{alert.message}</p>
                    <p className="text-xs text-neutral-400">{alert.timestamp.toDate().toLocaleTimeString()}</p>
                  </div>
                  <Button size="sm" className="bg-yellow-500 text-black hover:bg-yellow-400 h-7 text-xs">
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button 
          variant="outline" 
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          <Phone className="w-4 h-4 mr-1" />
          Call
        </Button>
        <Button 
          variant="outline" 
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          <MessageCircle className="w-4 h-4 mr-1" />
          Message
        </Button>
        <Button 
          variant="outline" 
          className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          <Bell className="w-4 h-4 mr-1" />
          Alerts
        </Button>
      </div>
    </div>
  );
}

export default GuardDashboard;