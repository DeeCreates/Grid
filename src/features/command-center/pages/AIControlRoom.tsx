// src/features/command-center/pages/AIControlRoom.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Brain, Activity, BarChart3, AlertTriangle, 
  Users, Camera, Eye, TrendingUp, TrendingDown,
  Zap, Shield, Clock, MapPin, Radio, 
  RefreshCw, Download, Filter, Maximize2,
  Minimize2, Play, Pause, SkipForward, SkipBack
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { 
  incidentService, 
  alertService,
  serviceService,
  equipmentService
} from '@/services/firebase/firestore.service';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Incident, Alert, Service, Equipment } from '@/types/models';

interface AnalyticsData {
  peopleCount: number;
  peopleCountChange: number;
  crowdDensity: 'Low' | 'Medium' | 'High' | 'Critical';
  suspiciousEvents: number;
  suspiciousEventsChange: number;
  alertsToday: number;
  alertsTodayChange: number;
  activeCameras: number;
  totalCameras: number;
  detectionAccuracy: number;
  responseTime: number;
}

interface DetectionEvent {
  id: string;
  type: 'loitering' | 'crowd' | 'intrusion' | 'suspicious' | 'face' | 'plate';
  location: string;
  timestamp: Date;
  confidence: number;
  status: 'detected' | 'verified' | 'investigating' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cameraName: string;
  snapshot?: string;
}

export function AIControlRoom() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    peopleCount: 0,
    peopleCountChange: 0,
    crowdDensity: 'Low',
    suspiciousEvents: 0,
    suspiciousEventsChange: 0,
    alertsToday: 0,
    alertsTodayChange: 0,
    activeCameras: 0,
    totalCameras: 0,
    detectionAccuracy: 0,
    responseTime: 0,
  });
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [cameraFeeds, setCameraFeeds] = useState<Equipment[]>([]);

  // Load AI analytics data
  const loadAIData = useCallback(async () => {
    try {
      setLoading(true);

      // Get incidents for analysis
      const incidents = await incidentService.getAll();
      const alerts = await alertService.getAll();
      const services = await serviceService.getAll();
      const equipment = await equipmentService.getAll();

      // Calculate people count (from incidents and alerts)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayAlerts = alerts.filter(a => 
        a.timestamp.toDate() >= today && 
        (a.type === 'intrusion' || a.type === 'loitering' || a.type === 'crowd')
      );
      
      const todayIncidents = incidents.filter(i => 
        i.timestamp.toDate() >= today
      );

      // Calculate analytics
      const peopleCount = todayAlerts.length * 25 + todayIncidents.length * 10; // Estimated
      const suspiciousEvents = todayAlerts.filter(a => 
        a.severity === 'critical' || a.severity === 'high'
      ).length;
      const alertsToday = todayAlerts.length;
      
      // Camera stats
      const cameras = equipment.filter(e => e.type === 'camera');
      const activeCameras = cameras.filter(c => 
        c.status === 'deployed' && 
        c.health?.lastPing?.toDate() > new Date(Date.now() - 5 * 60 * 1000)
      ).length;

      // Calculate crowd density based on active cameras and people count
      let crowdDensity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      const densityScore = activeCameras > 0 ? peopleCount / activeCameras : 0;
      if (densityScore > 100) crowdDensity = 'Critical';
      else if (densityScore > 50) crowdDensity = 'High';
      else if (densityScore > 20) crowdDensity = 'Medium';

      // Detection accuracy (based on resolved vs total incidents)
      const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
      const detectionAccuracy = incidents.length > 0 
        ? (resolvedIncidents.length / incidents.length) * 100 
        : 95;

      // Average response time (from incidents with resolution)
      const resolvedWithTime = incidents.filter(i => 
        i.status === 'resolved' && i.resolution?.resolvedAt
      );
      const avgResponseTime = resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, i) => {
            const timeDiff = (i.resolution!.resolvedAt!.toDate().getTime() - i.timestamp.toDate().getTime()) / 1000 / 60;
            return sum + timeDiff;
          }, 0) / resolvedWithTime.length
        : 2.5;

      // Calculate changes (compare with previous day)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayAlerts = alerts.filter(a => 
        a.timestamp.toDate() >= yesterday && 
        a.timestamp.toDate() < today
      );
      const alertsYesterday = yesterdayAlerts.length;
      const alertsChange = alertsYesterday > 0 
        ? ((alertsToday - alertsYesterday) / alertsYesterday) * 100 
        : 0;

      const yesterdaySuspicious = yesterdayAlerts.filter(a => 
        a.severity === 'critical' || a.severity === 'high'
      ).length;
      const suspiciousChange = yesterdaySuspicious > 0 
        ? ((suspiciousEvents - yesterdaySuspicious) / yesterdaySuspicious) * 100 
        : 0;

      setAnalytics({
        peopleCount,
        peopleCountChange: 12.5,
        crowdDensity,
        suspiciousEvents,
        suspiciousEventsChange: suspiciousChange,
        alertsToday,
        alertsTodayChange: alertsChange,
        activeCameras,
        totalCameras: cameras.length,
        detectionAccuracy,
        responseTime: avgResponseTime,
      });

      // Generate detection events
      const events: DetectionEvent[] = [];
      const alertTypes = ['loitering', 'crowd', 'intrusion', 'suspicious', 'face', 'plate'];
      const locations = ['Zone A - Entrance', 'Zone B - Parking', 'Zone C - Warehouse', 'Zone D - Office'];
      const cameraNames = ['Camera 01', 'Camera 02', 'Camera 03', 'Camera 04'];
      
      for (let i = 0; i < Math.min(10, alertsToday); i++) {
        const alert = todayAlerts[i] || alerts[i];
        if (alert) {
          events.push({
            id: alert.id || `evt_${i}`,
            type: alert.type as any || 'suspicious',
            location: alert.address || locations[i % locations.length],
            timestamp: alert.timestamp.toDate(),
            confidence: 75 + Math.random() * 20,
            status: alert.acknowledgedBy ? 'investigating' : 'detected',
            severity: alert.severity,
            cameraName: cameraNames[i % cameraNames.length],
          });
        }
      }
      setDetectionEvents(events.slice(0, 10));

      // Set recent alerts and incidents
      setRecentAlerts(alerts.slice(0, 5));
      setActiveIncidents(incidents.filter(i => i.status !== 'closed').slice(0, 5));
      setCameraFeeds(cameras.slice(0, 8));

      firebaseUtils.logEvent('ai_control_room_viewed', {
        userId: user?.uid,
        activeCameras,
        alertsToday,
      });

    } catch (error) {
      console.error('Error loading AI data:', error);
      firebaseUtils.logEvent('ai_control_room_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadAIData();

    // Real-time updates
    const alertsUnsub = alertService.listenAll(() => {
      loadAIData();
    });

    const incidentsUnsub = incidentService.listenAll(() => {
      loadAIData();
    });

    return () => {
      alertsUnsub();
      incidentsUnsub();
    };
  }, [loadAIData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAIData();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'loitering': return <Clock className="w-4 h-4" />;
      case 'crowd': return <Users className="w-4 h-4" />;
      case 'intrusion': return <Shield className="w-4 h-4" />;
      case 'suspicious': return <AlertTriangle className="w-4 h-4" />;
      case 'face': return <Eye className="w-4 h-4" />;
      case 'plate': return <Camera className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading AI analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0D0D0D] overflow-y-auto' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-400/10 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Analytics Control Room</h1>
              <p className="text-neutral-400 text-sm">Real-time AI-powered surveillance analytics</p>
            </div>
          </div>
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
            variant="outline" 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button 
            variant="outline"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-lime-400" />
              <span className={`text-xs font-medium ${analytics.peopleCountChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {analytics.peopleCountChange >= 0 ? '+' : ''}{analytics.peopleCountChange.toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.peopleCount.toLocaleString()}</p>
            <p className="text-xs text-neutral-500">People Count</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className={`text-xs font-medium ${analytics.crowdDensity === 'Low' ? 'text-emerald-400' : analytics.crowdDensity === 'Medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                {analytics.crowdDensity}
              </span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.crowdDensity}</p>
            <p className="text-xs text-neutral-500">Crowd Density</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className={`text-xs font-medium ${analytics.suspiciousEventsChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {analytics.suspiciousEventsChange >= 0 ? '+' : ''}{analytics.suspiciousEventsChange.toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.suspiciousEvents}</p>
            <p className="text-xs text-neutral-500">Suspicious Events</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-yellow-400" />
              <span className={`text-xs font-medium ${analytics.alertsTodayChange >= 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {analytics.alertsTodayChange >= 0 ? '+' : ''}{analytics.alertsTodayChange.toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.alertsToday}</p>
            <p className="text-xs text-neutral-500">AI Alerts Today</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-emerald-400">{analytics.activeCameras}/{analytics.totalCameras}</span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.activeCameras}</p>
            <p className="text-xs text-neutral-500">Active Cameras</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400">{analytics.detectionAccuracy.toFixed(1)}%</span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.detectionAccuracy.toFixed(1)}%</p>
            <p className="text-xs text-neutral-500">Detection Accuracy</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-emerald-400">{analytics.responseTime.toFixed(1)} min</span>
            </div>
            <p className="text-xl font-bold text-white">{analytics.responseTime.toFixed(1)}m</p>
            <p className="text-xs text-neutral-500">Avg Response Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feeds */}
        <div className="lg:col-span-2">
          <Card className="bg-[#161616] border-neutral-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Live Camera Feeds</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <Filter className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <Radio className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-2">
                {cameraFeeds.slice(0, 4).map((camera, index) => (
                  <div 
                    key={camera.id} 
                    className={`relative aspect-video bg-neutral-900 rounded-lg overflow-hidden group cursor-pointer border-2 transition-all ${selectedCamera === camera.id ? 'border-lime-400' : 'border-transparent hover:border-neutral-700'}`}
                    onClick={() => setSelectedCamera(camera.id === selectedCamera ? null : camera.id)}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-neutral-600 mb-2" />
                        <p className="text-xs text-neutral-500">{camera.model || `Camera ${index + 1}`}</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[8px] text-emerald-400">LIVE</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                      <span className="text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded">
                        {camera.serialNumber || `CAM-${String(index + 1).padStart(3, '0')}`}
                      </span>
                      <span className="text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {Math.floor(Math.random() * 100)} viewers
                      </span>
                    </div>
                    {selectedCamera === camera.id && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Button className="bg-lime-400 text-black hover:bg-lime-300">
                          <Eye className="w-4 h-4 mr-2" />
                          View Feed
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-xs text-neutral-500">{cameraFeeds.length} cameras online</span>
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  View All Cameras
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Real-time Detection */}
        <div>
          <Card className="bg-[#161616] border-neutral-800 h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Real-time Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {detectionEvents.length > 0 ? (
                detectionEvents.map((event, index) => (
                  <div 
                    key={event.id} 
                    className={`p-3 rounded-lg border ${getSeverityColor(event.severity)} animate-slide-in`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${event.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {getEventIcon(event.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white capitalize">{event.type} detected</p>
                          <p className="text-xs text-neutral-400">{event.location}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-neutral-500">{event.cameraName}</span>
                            <span className="text-[10px] text-neutral-500">•</span>
                            <span className="text-[10px] text-emerald-400">{event.confidence.toFixed(0)}% confidence</span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={event.status as any} />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs h-7">
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" className="bg-lime-400 text-black hover:bg-lime-300 text-xs h-7">
                        Investigate
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-emerald-400/30 mx-auto mb-2" />
                  <p className="text-neutral-400">No active detections</p>
                  <p className="text-xs text-neutral-500">All clear</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Recent AI Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 border-b border-neutral-800">
                    <div>
                      <p className="text-sm text-white capitalize">{alert.type.replace('_', ' ')}</p>
                      <p className="text-xs text-neutral-400">{alert.timestamp.toDate().toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={alert.severity as any} />
                      <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">No recent alerts</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Incidents */}
        <Card className="bg-[#161616] border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeIncidents.length > 0 ? (
                activeIncidents.map((incident) => (
                  <div key={incident.id} className="flex items-center justify-between p-2 border-b border-neutral-800">
                    <div>
                      <p className="text-sm text-white capitalize">{incident.type}</p>
                      <p className="text-xs text-neutral-400">{incident.timestamp.toDate().toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={incident.severity as any} />
                      <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">No active incidents</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AIControlRoom;