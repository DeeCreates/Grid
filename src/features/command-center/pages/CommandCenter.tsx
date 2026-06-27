// src/features/command-center/pages/CommandCenter.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Grid, Maximize2, AlertCircle, Volume2, VolumeX, 
  Users, Camera, Wifi, Activity, Clock, MapPin,
  RefreshCw, Eye, EyeOff, Shield, Zap, Bell,
  Radio, Server, Database, Cpu, MonitorPlay,
  ChevronLeft, ChevronRight, Play, Pause
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  incidentService, 
  alertService,
  serviceService,
  equipmentService,
  bookingService
} from '@/services/firebase/firestore.service';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Incident, Alert, Service, Equipment } from '@/types/models';

interface CommandCenterData {
  activeCameras: number;
  totalCameras: number;
  onlineDevices: number;
  offlineDevices: number;
  activeIncidents: number;
  activeOperators: number;
  activeClients: number;
  monitoringSessions: number;
  totalAlerts: number;
  criticalAlerts: number;
  uptime: number;
}

export function CommandCenter() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<CommandCenterData>({
    activeCameras: 0,
    totalCameras: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    activeIncidents: 0,
    activeOperators: 0,
    activeClients: 0,
    monitoringSessions: 0,
    totalAlerts: 0,
    criticalAlerts: 0,
    uptime: 99.9,
  });
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [cameraFeeds, setCameraFeeds] = useState<Equipment[]>([]);
  const [muted, setMuted] = useState(false);
  const [layout, setLayout] = useState<'2x2' | '3x3' | '4x4'>('3x3');
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load command center data
  const loadCommandCenterData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all data
      const [incidents, alertsData, services, equipment] = await Promise.all([
        incidentService.getAll(),
        alertService.getAll(),
        serviceService.getAll(),
        equipmentService.getAll(),
      ]);

      // Calculate stats
      const cameras = equipment.filter(e => e.type === 'camera');
      const activeCameras = cameras.filter(c => 
        c.status === 'deployed' && 
        c.health?.lastPing?.toDate() > new Date(Date.now() - 5 * 60 * 1000)
      );
      const onlineDevices = equipment.filter(e => 
        e.health?.lastPing?.toDate() > new Date(Date.now() - 5 * 60 * 1000)
      );
      const offlineDevices = equipment.filter(e => 
        e.health?.lastPing?.toDate() <= new Date(Date.now() - 5 * 60 * 1000) && e.status !== 'retired'
      );
      const activeIncidentsList = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved');
      const criticalAlerts = alertsData.filter(a => a.severity === 'critical' && !a.acknowledgedAt);
      const activeClients = new Set(services.filter(s => s.status === 'active').map(s => s.customerId)).size;

      setData({
        activeCameras: activeCameras.length,
        totalCameras: cameras.length,
        onlineDevices: onlineDevices.length,
        offlineDevices: offlineDevices.length,
        activeIncidents: activeIncidentsList.length,
        activeOperators: 5, // Would come from active sessions
        activeClients,
        monitoringSessions: 3, // Would come from active sessions
        totalAlerts: alertsData.length,
        criticalAlerts: criticalAlerts.length,
        uptime: 99.9,
      });

      // Set recent alerts (unacknowledged first)
      const sortedAlerts = alertsData
        .filter(a => !a.acknowledgedAt)
        .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
        .slice(0, 10);
      setAlerts(sortedAlerts);

      // Set active incidents
      setActiveIncidents(activeIncidentsList.slice(0, 5));

      // Set camera feeds
      setCameraFeeds(cameras.slice(0, 16));

      firebaseUtils.logEvent('command_center_viewed', {
        userId: user?.uid,
        activeCameras: activeCameras.length,
        activeIncidents: activeIncidentsList.length,
      });

    } catch (error) {
      console.error('Error loading command center data:', error);
      firebaseUtils.logEvent('command_center_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadCommandCenterData();

    // Real-time updates
    const alertsUnsub = alertService.listenAll(() => {
      loadCommandCenterData();
    });

    const incidentsUnsub = incidentService.listenAll(() => {
      loadCommandCenterData();
    });

    const servicesUnsub = serviceService.listenAll(() => {
      loadCommandCenterData();
    });

    return () => {
      alertsUnsub();
      incidentsUnsub();
      servicesUnsub();
    };
  }, [loadCommandCenterData]);

  // Auto-rotate camera feeds
  useEffect(() => {
    if (!isAutoRotate || cameraFeeds.length === 0) return;

    const interval = setInterval(() => {
      const currentIndex = cameraFeeds.findIndex(c => c.id === selectedCamera);
      const nextIndex = (currentIndex + 1) % cameraFeeds.length;
      setSelectedCamera(cameraFeeds[nextIndex]?.id || null);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoRotate, cameraFeeds, selectedCamera]);

  // Play alert sound for new critical alerts
  useEffect(() => {
    if (!muted && alerts.some(a => a.severity === 'critical' && !a.acknowledgedAt) && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [alerts, muted]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCommandCenterData();
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'alerts', alertId), {
        acknowledgedBy: user?.uid,
        acknowledgedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      firebaseUtils.logEvent('alert_acknowledged', { alertId });
      await loadCommandCenterData();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getGridClass = () => {
    switch (layout) {
      case '2x2': return 'grid-cols-2';
      case '3x3': return 'grid-cols-3';
      case '4x4': return 'grid-cols-4';
    }
  };

  const getGridSize = () => {
    switch (layout) {
      case '2x2': return 4;
      case '3x3': return 9;
      case '4x4': return 16;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0D0D0D]">
      <audio ref={audioRef} src="/sounds/alert.mp3" />

      {/* Status Bar */}
      <div className="bg-[#161616] border-b border-neutral-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-lime-400" />
            <span className="text-xs text-neutral-300">{data.activeCameras}/{data.totalCameras} Cameras</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-neutral-300">{data.onlineDevices} Online</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-red-400" />
            <span className="text-xs text-neutral-300">{data.offlineDevices} Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-4 h-4 ${data.criticalAlerts > 0 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`} />
            <span className="text-xs text-neutral-300">{data.activeIncidents} Incidents</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-neutral-300">{data.activeOperators} Operators</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-neutral-300">{data.uptime}% Uptime</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            className={`p-1 rounded text-xs transition ${isAutoRotate ? 'text-lime-400 bg-lime-400/10' : 'text-neutral-500 hover:text-white'}`}
            title={isAutoRotate ? 'Auto-rotate on' : 'Auto-rotate off'}
          >
            <RefreshCw className={`w-4 h-4 ${isAutoRotate ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setMuted(!muted)} className="text-neutral-400 hover:text-white">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="flex gap-1 bg-neutral-800/50 rounded p-0.5">
            {(['2x2', '3x3', '4x4'] as const).map((l) => (
              <button 
                key={l}
                onClick={() => setLayout(l)} 
                className={`px-2 py-0.5 text-[10px] rounded transition ${layout === l ? 'bg-lime-400 text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white h-7 px-2"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Clock className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {/* Video Grid */}
      <div className={`flex-1 grid ${getGridClass()} gap-1 p-1 relative`}>
        {cameraFeeds.slice(0, getGridSize()).map((camera, index) => (
          <div 
            key={camera.id} 
            className={`bg-black rounded-lg overflow-hidden relative group cursor-pointer transition-all duration-300 ${
              selectedCamera === camera.id ? 'ring-2 ring-lime-400 ring-offset-1 ring-offset-black' : ''
            } ${fullscreenCamera === camera.id ? 'col-span-full row-span-full' : ''}`}
            onClick={() => {
              if (fullscreenCamera === camera.id) {
                setFullscreenCamera(null);
              } else {
                setSelectedCamera(camera.id === selectedCamera ? null : camera.id);
              }
            }}
          >
            {/* Camera Feed Content */}
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
              <div className="text-center">
                <Camera className={`w-8 h-8 ${camera.status === 'deployed' ? 'text-lime-400/50' : 'text-red-400/50'} mb-2`} />
                <p className="text-xs text-neutral-500">{camera.model || `Camera ${index + 1}`}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${camera.status === 'deployed' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-[8px] text-neutral-500">
                    {camera.status === 'deployed' ? 'LIVE' : camera.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Camera Info Overlay */}
            <div className="absolute top-2 left-2 flex items-center gap-2">
              <span className="text-[10px] bg-black/60 text-white/80 px-2 py-0.5 rounded">
                {camera.serialNumber || `CAM-${String(index + 1).padStart(3, '0')}`}
              </span>
              {camera.status === 'deployed' && (
                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">LIVE</span>
              )}
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
              <button 
                className="bg-black/60 p-1 rounded hover:bg-black/80 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenCamera(fullscreenCamera === camera.id ? null : camera.id);
                }}
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Camera Status Indicator */}
            <div className="absolute bottom-2 left-2">
              <span className={`text-[8px] px-1.5 py-0.5 rounded ${camera.status === 'deployed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {camera.status === 'deployed' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Panel */}
      <div className="absolute right-4 top-20 w-80 max-h-[60vh] overflow-y-auto space-y-2 z-10">
        {alerts.filter(a => !a.acknowledgedAt).slice(0, 5).map((alert) => (
          <div 
            key={alert.id} 
            className={`p-3 rounded-lg shadow-lg border ${getSeverityColor(alert.severity)} animate-slide-in bg-[#1a1a1a] backdrop-blur-sm`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${getSeverityBg(alert.severity)} animate-pulse`} />
                  <p className="font-semibold text-sm text-white truncate">{alert.type}</p>
                </div>
                <p className="text-xs text-neutral-300 mt-1">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{alert.location || alert.address || 'Unknown'}</span>
                  <span>•</span>
                  <span>{alert.timestamp.toDate().toLocaleTimeString()}</span>
                </div>
              </div>
              <button 
                onClick={() => acknowledgeAlert(alert.id)} 
                className="text-white/50 hover:text-white transition flex-shrink-0 ml-2"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-[10px] h-6 px-2 flex-1"
              >
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
              <Button 
                size="sm" 
                className="bg-lime-400 text-black hover:bg-lime-300 text-[10px] h-6 px-2 flex-1"
                onClick={() => {
                  // Dispatch action
                  firebaseUtils.logEvent('alert_dispatched', { alertId: alert.id });
                }}
              >
                <Shield className="w-3 h-3 mr-1" />
                Dispatch
              </Button>
            </div>
          </div>
        ))}
        {alerts.filter(a => !a.acknowledgedAt).length === 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
            <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
            <p className="text-sm text-emerald-400">All clear</p>
            <p className="text-xs text-emerald-400/70">No active alerts</p>
          </div>
        )}
      </div>

      {/* Camera Navigation Controls */}
      {cameraFeeds.length > getGridSize() && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <button 
            className="bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition"
            onClick={() => {
              const currentIndex = cameraFeeds.findIndex(c => c.id === selectedCamera);
              const prevIndex = (currentIndex - 1 + cameraFeeds.length) % cameraFeeds.length;
              setSelectedCamera(cameraFeeds[prevIndex]?.id || null);
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/60 bg-black/60 px-3 py-1 rounded-full">
            {selectedCamera ? `${cameraFeeds.findIndex(c => c.id === selectedCamera) + 1} / ${cameraFeeds.length}` : 'All Cameras'}
          </span>
          <button 
            className="bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition"
            onClick={() => {
              const currentIndex = cameraFeeds.findIndex(c => c.id === selectedCamera);
              const nextIndex = (currentIndex + 1) % cameraFeeds.length;
              setSelectedCamera(cameraFeeds[nextIndex]?.id || null);
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            className={`bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition ${isAutoRotate ? 'text-lime-400' : ''}`}
            onClick={() => setIsAutoRotate(!isAutoRotate)}
          >
            <RefreshCw className={`w-4 h-4 ${isAutoRotate ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}

export default CommandCenter;