// src/features/customer/pages/LiveMonitoring.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Grid, LayoutGrid, Maximize2, AlertCircle, 
  Volume2, VolumeX, Pip, RefreshCw, Camera as CameraIcon,
  Eye, EyeOff, Play, Pause, SkipForward, SkipBack,
  Fullscreen, Minimize2, Settings, Filter,
  Grid3x3, Grid2x2, Grid4x4, List, Plus,
  ChevronLeft, ChevronRight, Activity, Wifi,
  Signal, Battery, Clock, MapPin, Calendar, Focus
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { equipmentService } from '@/services/firebase/firestore.service';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Equipment } from '@/types/models';

interface Camera extends Equipment {
  streamUrl?: string;
  isOnline: boolean;
  viewerCount: number;
  lastMotion: Date | null;
}

export function LiveMonitoring() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [layout, setLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4'>('2x2');
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    recording: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Load cameras
  const loadCameras = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all equipment that are cameras
      const allEquipment = await equipmentService.getAll();
      const cameraEquipment = allEquipment.filter(e => e.type === 'camera');

      // Enrich with camera-specific data
      const enrichedCameras: Camera[] = cameraEquipment.map(cam => {
        const isOnline = cam.status === 'deployed' && 
          cam.health?.lastPing?.toDate() > new Date(Date.now() - 5 * 60 * 1000);
        
        return {
          ...cam,
          isOnline,
          viewerCount: Math.floor(Math.random() * 20) + 1,
          lastMotion: isOnline ? new Date(Date.now() - Math.random() * 60000) : null,
          streamUrl: isOnline ? `/streams/${cam.id}.m3u8` : undefined,
        };
      });

      setCameras(enrichedCameras);

      // Calculate stats
      const online = enrichedCameras.filter(c => c.isOnline);
      const offline = enrichedCameras.filter(c => !c.isOnline);
      const recording = enrichedCameras.filter(c => c.status === 'deployed');

      setStats({
        total: enrichedCameras.length,
        online: online.length,
        offline: offline.length,
        recording: recording.length,
      });

      // Select first online camera if none selected
      if (!selectedCamera && online.length > 0) {
        setSelectedCamera(online[0]);
      }

      firebaseUtils.logEvent('live_monitoring_viewed', {
        userId: user.uid,
        totalCameras: enrichedCameras.length,
        onlineCameras: online.length,
      });

    } catch (error) {
      console.error('Error loading cameras:', error);
      firebaseUtils.logEvent('live_monitoring_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedCamera]);

  // Initial load
  useEffect(() => {
    loadCameras();

    // Real-time updates for equipment
    if (!user) return;

    const equipmentUnsub = equipmentService.listenAll(() => {
      loadCameras();
    });

    return () => equipmentUnsub();
  }, [loadCameras, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCameras();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const getGridClass = () => {
    switch (layout) {
      case '1x1': return 'grid-cols-1';
      case '2x2': return 'grid-cols-1 md:grid-cols-2';
      case '3x3': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case '4x4': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  };

  const getGridSize = () => {
    switch (layout) {
      case '1x1': return 1;
      case '2x2': return 4;
      case '3x3': return 9;
      case '4x4': return 16;
    }
  };

  const onlineCameras = cameras.filter(c => c.isOnline);
  const displayCameras = layout === '1x1' && selectedCamera 
    ? [selectedCamera] 
    : onlineCameras.slice(0, getGridSize());

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Monitoring</h1>
          <p className="text-neutral-400 mt-1">Real-time surveillance feed from your cameras</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Layout Controls */}
          <div className="bg-neutral-800/50 rounded-lg p-1 flex">
            {(['1x1', '2x2', '3x3', '4x4'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  layout === l 
                    ? 'bg-lime-400 text-black' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleFullscreen}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Fullscreen className="w-4 h-4" />}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <CameraIcon className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-400">Total</p>
              <p className="text-lg font-bold text-white">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs text-neutral-400">Online</p>
              <p className="text-lg font-bold text-emerald-400">{stats.online}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-xs text-neutral-400">Offline</p>
              <p className="text-lg font-bold text-red-400">{stats.offline}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-neutral-400">Recording</p>
              <p className="text-lg font-bold text-blue-400">{stats.recording}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Grid */}
      {displayCameras.length > 0 ? (
        <div className={`grid ${getGridClass()} gap-3`}>
          {displayCameras.map((camera) => (
            <div key={camera.id} className="relative group">
              <div className="aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-lime-400/30 transition-all duration-300">
                {camera.isOnline ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
                    <div className="text-center">
                      <div className="relative">
                        <CameraIcon className="w-12 h-12 text-lime-400/30 mx-auto mb-2" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                      </div>
                      <p className="text-sm text-white font-medium">{camera.model || camera.serialNumber}</p>
                      <div className="flex items-center justify-center gap-2 mt-1 text-xs text-neutral-400">
                        <span>Live</span>
                        <span>•</span>
                        <span>{camera.viewerCount} viewers</span>
                      </div>
                      {camera.lastMotion && (
                        <p className="text-[10px] text-neutral-500 mt-1">
                          Motion: {Math.floor((Date.now() - camera.lastMotion.getTime()) / 1000)}s ago
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
                    <AlertCircle className="w-12 h-12 mb-2" />
                    <p className="text-sm">Camera Offline</p>
                    <p className="text-xs text-neutral-500">{camera.status}</p>
                  </div>
                )}
              </div>

              {/* Camera Overlay */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-black/60 text-white/80 px-2 py-0.5 rounded">
                    {camera.serialNumber || 'N/A'}
                  </span>
                  {camera.isOnline && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">LIVE</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setSelectedCamera(camera)}
                    className="bg-black/60 p-1 rounded hover:bg-black/80 transition"
                    title="Select camera"
                  >
                    <Focus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Bottom Overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-black/60 text-white/80 px-2 py-0.5 rounded flex items-center gap-1">
                    <Signal className="w-3 h-3" />
                    {camera.health?.signalStrength || '100'}%
                  </span>
                  {camera.health?.batteryLevel !== undefined && (
                    <span className="text-[10px] bg-black/60 text-white/80 px-2 py-0.5 rounded flex items-center gap-1">
                      <Battery className="w-3 h-3" />
                      {camera.health.batteryLevel}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedCamera(camera)}
                    className="text-[10px] bg-black/60 text-white/80 px-2 py-0.5 rounded hover:bg-black/80 transition"
                  >
                    <Eye className="w-3 h-3 inline mr-0.5" />
                    View
                  </button>
                </div>
              </div>

              {/* Motion Indicator */}
              {camera.lastMotion && (
                <div className="absolute top-2 right-2">
                  <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded animate-pulse">
                    Motion
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-12 text-center">
            <CameraIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">No online cameras</p>
            <p className="text-sm text-neutral-500">All cameras are currently offline</p>
          </CardContent>
        </Card>
      )}

      {/* Camera Sidebar */}
      <div className="border-t border-neutral-800 pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">All Cameras</h3>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="text-neutral-400 hover:text-white"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-neutral-400 hover:text-white"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {cameras.map((camera) => (
              <button
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className={`p-3 rounded-lg text-left transition-all duration-200 ${
                  selectedCamera?.id === camera.id
                    ? 'bg-lime-400/10 border-2 border-lime-400'
                    : 'bg-neutral-800/30 border border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${camera.isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <p className="font-medium text-sm text-white truncate">{camera.model || camera.serialNumber}</p>
                </div>
                <p className="text-xs text-neutral-400 mt-1 truncate">{camera.serialNumber}</p>
                {camera.isOnline && (
                  <p className="text-[10px] text-emerald-400 mt-1">{camera.viewerCount} viewers</p>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {cameras.map((camera) => (
              <button
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                  selectedCamera?.id === camera.id
                    ? 'bg-lime-400/10 border border-lime-400'
                    : 'bg-neutral-800/30 border border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${camera.isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-sm text-white">{camera.model || camera.serialNumber}</span>
                  <span className="text-xs text-neutral-400">{camera.serialNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  {camera.isOnline && (
                    <span className="text-xs text-emerald-400">Live</span>
                  )}
                  <StatusBadge status={camera.isOnline ? 'active' : 'inactive'} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Audio Control */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMuted(!muted)}
          className="bg-neutral-800 text-white p-3 rounded-full shadow-lg hover:bg-neutral-700 transition border border-neutral-700"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

export default LiveMonitoring;