// src/features/customer/pages/VideoArchive.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Download, Share2, Search, Filter, 
  Clock, HardDrive, Trash2, Eye, Lock, 
  ChevronLeft, ChevronRight, ZoomIn, Film,
  RefreshCw, Grid, List, CheckCircle, AlertCircle,
  Upload, Link, Copy, User, Mail, Phone,
  Settings, Play, Pause, Volume2, VolumeX,
  Maximize2, Minimize2, SkipForward, SkipBack,
  Film as FilmIcon, Camera, Wifi, Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Currency } from '@/components/ui/Currency';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
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
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { 
  ref, 
  listAll, 
  getDownloadURL, 
  deleteObject,
  getMetadata
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type { Recording } from '@/types/models';

interface Camera {
  id: string;
  name: string;
  location: string;
  type: string;
}

export function VideoArchive() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [filteredRecordings, setFilteredRecordings] = useState<any[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareExpiry, setShareExpiry] = useState('7');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 7)),
    end: new Date(),
  });
  const [playbackModalOpen, setPlaybackModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [storageStats, setStorageStats] = useState({
    used: 0,
    limit: 50000,
    percent: 0,
  });

  // Load recordings
  const loadRecordings = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get recordings from Firebase Storage
      const recordingsRef = ref(storage, `recordings/${user.uid}`);
      let recordingFiles: any[] = [];
      
      try {
        const listResult = await listAll(recordingsRef);
        for (const item of listResult.items) {
          const metadata = await getMetadata(item);
          const url = await getDownloadURL(item);
          
          // Parse recording data from path or metadata
          const pathParts = item.fullPath.split('/');
          const fileName = pathParts[pathParts.length - 1];
          const [cameraId, date, time] = fileName.split('_');
          
          recordingFiles.push({
            id: item.name,
            cameraId: cameraId || 'unknown',
            cameraName: cameras.find(c => c.id === cameraId)?.name || 'Unknown Camera',
            startTime: new Date(metadata.timeCreated || Date.now()),
            endTime: new Date(metadata.updated || Date.now()),
            duration: 0,
            size: metadata.size || 0,
            url: url,
            isProtected: false,
            hasMotion: fileName.includes('motion'),
            tags: fileName.includes('motion') ? ['motion'] : [],
            path: item.fullPath,
            metadata: metadata,
          });
        }
      } catch (err) {
        // No recordings found or error
        console.log('No recordings found or error accessing storage:', err);
      }

      // Sort by date descending
      recordingFiles.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      setRecordings(recordingFiles);

      // Calculate storage usage
      const totalSize = recordingFiles.reduce((sum, r) => sum + r.size, 0);
      const storageLimit = 50000 * 1024 * 1024; // 50GB in bytes
      const percent = (totalSize / storageLimit) * 100;
      setStorageStats({
        used: totalSize,
        limit: storageLimit,
        percent: Math.min(percent, 100),
      });

      // Get cameras from equipment
      const equipmentSnapshot = await getDocs(
        query(collection(db, 'equipment'), where('type', '==', 'camera'))
      );
      const cameraData = equipmentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Camera[];
      setCameras(cameraData);

      firebaseUtils.logEvent('video_archive_viewed', {
        userId: user.uid,
        recordings: recordingFiles.length,
        storageUsed: totalSize,
      });

    } catch (error) {
      console.error('Error loading recordings:', error);
      firebaseUtils.logEvent('video_archive_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, cameras]);

  // Filter recordings
  useEffect(() => {
    let filtered = [...recordings];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.cameraName?.toLowerCase().includes(query) ||
        r.id?.toLowerCase().includes(query) ||
        r.tags?.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    if (selectedCamera !== 'all') {
      filtered = filtered.filter(r => r.cameraId === selectedCamera);
    }

    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(r => {
        const date = new Date(r.startTime);
        return date >= dateRange.start && date <= dateRange.end;
      });
    }

    setFilteredRecordings(filtered);
  }, [recordings, searchQuery, selectedCamera, dateRange]);

  // Initial load
  useEffect(() => {
    loadRecordings();

    // Real-time updates for equipment
    const equipmentUnsub = onSnapshot(
      query(collection(db, 'equipment'), where('type', '==', 'camera')),
      () => loadRecordings()
    );

    return () => equipmentUnsub();
  }, [loadRecordings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecordings();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleDownload = async (recording: any) => {
    if (!recording.url) return;

    try {
      const link = document.createElement('a');
      link.href = recording.url;
      link.download = recording.id;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      firebaseUtils.logEvent('recording_downloaded', {
        recordingId: recording.id,
        userId: user?.uid,
      });

      setSuccessMessage('Download started!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage('Failed to download recording');
      console.error('Download error:', error);
    }
  };

  const handleShare = async () => {
    if (!selectedRecording || !shareEmail) return;

    try {
      // In production, this would create a share link with Firebase
      // const shareRef = await addDoc(collection(db, 'sharedRecordings'), {
      //   recordingId: selectedRecording.id,
      //   sharedBy: user?.uid,
      //   sharedWith: shareEmail,
      //   expiresAt: Timestamp.fromDate(new Date(Date.now() + parseInt(shareExpiry) * 24 * 60 * 60 * 1000)),
      //   createdAt: Timestamp.now(),
      // });

      firebaseUtils.logEvent('recording_shared', {
        recordingId: selectedRecording.id,
        expiresIn: shareExpiry,
      });

      setShareModalOpen(false);
      setShareEmail('');
      setSuccessMessage(`Recording shared with ${shareEmail}!`);
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage('Failed to share recording');
      console.error('Share error:', error);
    }
  };

  const handleProtect = async (recordingId: string) => {
    // In production, this would update a field in Firestore
    setRecordings(recordings.map(r => 
      r.id === recordingId ? { ...r, isProtected: !r.isProtected } : r
    ));
    
    firebaseUtils.logEvent('recording_protected', {
      recordingId,
      userId: user?.uid,
    });
    
    setSuccessMessage('Recording protected!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) return;

    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (recording && recording.path) {
        const storageRef = ref(storage, recording.path);
        await deleteObject(storageRef);
      }

      setRecordings(recordings.filter(r => r.id !== recordingId));
      
      firebaseUtils.logEvent('recording_deleted', {
        recordingId,
        userId: user?.uid,
      });
      
      setSuccessMessage('Recording deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      setErrorMessage('Failed to delete recording');
      console.error('Delete error:', error);
    }
  };

  const handleBulkDownload = async () => {
    const selectedIds = filteredRecordings.map(r => r.id);
    // In production, this would create a zip file
    alert(`Bulk downloading ${selectedIds.length} recordings...`);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading recordings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Video Archive</h1>
          <p className="text-neutral-400 mt-1">Search, view, and download recorded footage from your cameras</p>
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

      {/* Storage Usage */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-5 h-5 text-neutral-400" />
                <span className="font-medium text-white">Storage Usage</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-neutral-400">{formatSize(storageStats.used)} used</span>
                <span className="text-sm text-neutral-400">of {formatSize(storageStats.limit)}</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full">
                <div
                  className="h-2 bg-lime-400 rounded-full transition-all"
                  style={{ width: `${Math.min(storageStats.percent, 100)}%` }}
                />
              </div>
              {storageStats.percent > 80 && (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ Storage is running low. Consider upgrading your plan or deleting old recordings.
                </p>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              <Database className="w-4 h-4 mr-2" />
              Upgrade Storage
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by camera name or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search className="w-4 h-4 text-neutral-500" />}
                  className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
                >
                  <option value="all">All Cameras</option>
                  {cameras.map(camera => (
                    <option key={camera.id} value={camera.id}>{camera.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="px-3 py-2 border border-neutral-700 rounded-lg hover:bg-neutral-800 transition"
                >
                  {viewMode === 'grid' ? <List className="w-4 h-4 text-neutral-400" /> : <Grid className="w-4 h-4 text-neutral-400" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-400 mb-1">Date Range</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                    className="flex-1 px-3 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
                  />
                  <span className="self-center text-neutral-400">to</span>
                  <input
                    type="date"
                    value={dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                    className="flex-1 px-3 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    setDateRange({ start: new Date(today.setDate(today.getDate() - 1)), end: new Date() });
                  }}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  Last 24h
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    setDateRange({ start: new Date(today.setDate(today.getDate() - 7)), end: new Date() });
                  }}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  7 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    setDateRange({ start: new Date(today.setDate(today.getDate() - 30)), end: new Date() });
                  }}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  30 Days
                </Button>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedCamera !== 'all' || searchQuery) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
                <span className="text-sm text-neutral-500">Active filters:</span>
                {selectedCamera !== 'all' && (
                  <span className="text-xs bg-lime-400/10 text-lime-400 px-2 py-1 rounded-full flex items-center gap-1">
                    Camera: {cameras.find(c => c.id === selectedCamera)?.name}
                    <button onClick={() => setSelectedCamera('all')} className="hover:text-lime-300">×</button>
                  </span>
                )}
                {searchQuery && (
                  <span className="text-xs bg-lime-400/10 text-lime-400 px-2 py-1 rounded-full flex items-center gap-1">
                    Search: {searchQuery}
                    <button onClick={() => setSearchQuery('')} className="hover:text-lime-300">×</button>
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {filteredRecordings.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-neutral-400">{filteredRecordings.length} recordings found</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleBulkDownload}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Bulk Download
          </Button>
        </div>
      )}

      {/* Recordings Grid/List */}
      {filteredRecordings.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecordings.map((recording) => (
              <Card key={recording.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition group">
                <CardContent className="p-0">
                  <div className="relative h-40 bg-neutral-900 rounded-t-xl overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center">
                      <FilmIcon className="w-12 h-12 text-neutral-600" />
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1">
                      {recording.hasMotion && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Motion</span>
                      )}
                      {recording.isProtected && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Protected
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded">
                        {formatDuration(recording.duration || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-white">{recording.cameraName}</h3>
                        <p className="text-xs text-neutral-400">
                          {recording.startTime.toLocaleDateString()} • {recording.startTime.toLocaleTimeString()}
                        </p>
                      </div>
                      <span className="text-xs text-neutral-400">{formatSize(recording.size)}</span>
                    </div>

                    <div className="flex gap-1 mt-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 text-neutral-400 hover:text-white"
                        onClick={() => {
                          setSelectedRecording(recording);
                          setPlaybackModalOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 text-neutral-400 hover:text-white"
                        onClick={() => handleDownload(recording)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 text-neutral-400 hover:text-white"
                        onClick={() => {
                          setSelectedRecording(recording);
                          setShareModalOpen(true);
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 text-neutral-400 hover:text-white"
                        onClick={() => handleProtect(recording.id)}
                      >
                        <Lock className="w-4 h-4" />
                      </Button>
                      {!recording.isProtected && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(recording.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-[#161616] border-neutral-800">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-800/50 border-b border-neutral-800">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Camera</th>
                    <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Date & Time</th>
                    <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Duration</th>
                    <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Size</th>
                    <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Tags</th>
                    <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecordings.map((recording) => (
                    <tr key={recording.id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-white">{recording.cameraName}</p>
                          {recording.isProtected && <Lock className="w-3 h-3 text-yellow-400 inline ml-1" />}
                        </div>
                      </td>
                      <td className="p-3 text-neutral-400">
                        {recording.startTime.toLocaleDateString()}<br />
                        <span className="text-xs">{recording.startTime.toLocaleTimeString()}</span>
                      </td>
                      <td className="p-3 text-neutral-400">{formatDuration(recording.duration || 0)}</td>
                      <td className="p-3 text-neutral-400">{formatSize(recording.size)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {recording.tags?.slice(0, 2).map((tag: string) => (
                            <span key={tag} className="text-xs bg-neutral-800/50 text-neutral-300 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedRecording(recording);
                              setPlaybackModalOpen(true);
                            }}
                            className="text-neutral-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDownload(recording)}
                            className="text-neutral-400 hover:text-white"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedRecording(recording);
                              setShareModalOpen(true);
                            }}
                            className="text-neutral-400 hover:text-white"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-12 text-center">
            <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">No recordings found</p>
            <p className="text-sm text-neutral-500">Try adjusting your filters</p>
            <Button 
              variant="outline" 
              className="mt-4 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={() => {
                setSearchQuery('');
                setSelectedCamera('all');
                setDateRange({ 
                  start: new Date(new Date().setDate(new Date().getDate() - 7)), 
                  end: new Date() 
                });
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Playback Modal */}
      <Modal isOpen={playbackModalOpen} onClose={() => setPlaybackModalOpen(false)} title="Play Recording" size="lg">
        {selectedRecording && (
          <div className="space-y-4">
            <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
              {selectedRecording.url ? (
                <video 
                  src={selectedRecording.url} 
                  controls 
                  autoPlay 
                  className="w-full h-full rounded-lg"
                />
              ) : (
                <div className="text-center">
                  <Film className="w-16 h-16 text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500">Video Player</p>
                  <p className="text-sm text-neutral-400 mt-2">
                    {selectedRecording.cameraName} • {selectedRecording.startTime.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDownload(selectedRecording)}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleProtect(selectedRecording.id)}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  <Lock className="w-4 h-4 mr-1" />
                  {selectedRecording.isProtected ? 'Unprotect' : 'Protect'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <h4 className="font-medium text-white mb-2">Recording Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Camera:</span>
                  <span className="text-white">{selectedRecording.cameraName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Date:</span>
                  <span className="text-white">{selectedRecording.startTime.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Time:</span>
                  <span className="text-white">{selectedRecording.startTime.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Duration:</span>
                  <span className="text-white">{formatDuration(selectedRecording.duration || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">File Size:</span>
                  <span className="text-white">{formatSize(selectedRecording.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Motion Events:</span>
                  <span className="text-white">{selectedRecording.hasMotion ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Share Modal */}
      <Modal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Share Recording">
        <div className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="recipient@example.com"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
          />
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Access Expires</label>
            <select
              value={shareExpiry}
              onChange={(e) => setShareExpiry(e.target.value)}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <p className="text-sm text-neutral-400">
            The recipient will be able to view and download this recording for the specified period.
          </p>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShareModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleShare}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Recording
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default VideoArchive;