// src/features/mobile/technician/TechnicianEquipment.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Package, QrCode, Check, AlertTriangle,
  RefreshCw, Search, Filter, Plus,
  Camera, Wifi, HardDrive, Server,
  Shield, Zap, Battery, Signal,
  Eye, Edit, Trash2, Download,
  ChevronRight, MoreVertical, Calendar,
  MapPin, User, Building, Clock,
  CheckCircle, XCircle, AlertCircle
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
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Equipment } from '@/types/models';

interface TechnicianEquipment extends Equipment {
  assignedToMe: boolean;
  lastUsed: Date | null;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
}

export function TechnicianEquipment() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [equipment, setEquipment] = useState<TechnicianEquipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<TechnicianEquipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<TechnicianEquipment | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    available: 0,
    maintenance: 0,
    lowStock: 0,
  });

  // Load equipment
  const loadEquipment = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get equipment assigned to this technician
      const equipmentQuery = query(
        collection(db, 'equipment'),
        where('assignedTo', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const equipmentSnapshot = await getDocs(equipmentQuery);
      
      const equipmentData = equipmentSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          assignedToMe: data.assignedTo === user.uid,
          lastUsed: data.lastUsed?.toDate() || null,
          condition: data.condition || 'good',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as TechnicianEquipment;
      });

      setEquipment(equipmentData);

      // Calculate stats
      const assigned = equipmentData.filter(e => e.assignedTo === user.uid);
      const available = equipmentData.filter(e => e.status === 'available');
      const maintenance = equipmentData.filter(e => e.status === 'maintenance');
      const lowStock = equipmentData.filter(e => e.health?.batteryLevel && e.health.batteryLevel < 20);

      setStats({
        total: equipmentData.length,
        assigned: assigned.length,
        available: available.length,
        maintenance: maintenance.length,
        lowStock: lowStock.length,
      });

      firebaseUtils.logEvent('technician_equipment_viewed', {
        userId: user.uid,
        totalEquipment: equipmentData.length,
      });

    } catch (error) {
      console.error('Error loading equipment:', error);
      firebaseUtils.logEvent('technician_equipment_error', {
        error: String(error),
        userId: user?.uid,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter equipment
  useEffect(() => {
    let filtered = [...equipment];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.model?.toLowerCase().includes(query) ||
        e.serialNumber?.toLowerCase().includes(query) ||
        e.type?.toLowerCase().includes(query) ||
        e.manufacturer?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    setFilteredEquipment(filtered);
  }, [equipment, searchQuery, statusFilter]);

  // Initial load and real-time updates
  useEffect(() => {
    loadEquipment();

    const equipmentUnsub = onSnapshot(
      query(collection(db, 'equipment'), where('assignedTo', '==', user?.uid)),
      () => loadEquipment()
    );

    return () => equipmentUnsub();
  }, [loadEquipment, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEquipment();
  };

  const handleScanQR = () => {
    // In production, this would open the camera for QR scanning
    // For demo, we'll simulate scanning
    setQrModalOpen(true);
  };

  const handleQRScanComplete = () => {
    if (scanResult.trim()) {
      // Find equipment by QR code
      const found = equipment.find(e => e.qrCode === scanResult.trim());
      if (found) {
        setSelectedEquipment(found);
        setDetailModalOpen(true);
        setQrModalOpen(false);
        setScanResult('');
        
        firebaseUtils.logEvent('equipment_scanned', {
          equipmentId: found.id,
          userId: user?.uid,
        });
      } else {
        setErrorMessage('Equipment not found. Please check the QR code.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    }
  };

  const handleUpdateStatus = async (equipmentId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'equipment', equipmentId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('equipment_status_updated', {
        equipmentId,
        newStatus,
        userId: user?.uid,
      });

      setSuccessMessage(`Equipment status updated to ${newStatus}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadEquipment();

    } catch (error: any) {
      setErrorMessage('Failed to update equipment status');
      console.error('Error updating status:', error);
    }
  };

  const handleReturnEquipment = async (equipmentId: string) => {
    if (!confirm('Are you sure you want to return this equipment?')) return;

    try {
      await updateDoc(doc(db, 'equipment', equipmentId), {
        assignedTo: null,
        status: 'available',
        updatedAt: serverTimestamp(),
      });

      firebaseUtils.logEvent('equipment_returned', {
        equipmentId,
        userId: user?.uid,
      });

      setSuccessMessage('Equipment returned successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadEquipment();

    } catch (error: any) {
      setErrorMessage('Failed to return equipment');
      console.error('Error returning equipment:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'camera': return <Camera className="w-5 h-5 text-blue-400" />;
      case 'router': return <Wifi className="w-5 h-5 text-emerald-400" />;
      case 'nvr': return <HardDrive className="w-5 h-5 text-purple-400" />;
      case 'switch': return <Server className="w-5 h-5 text-yellow-400" />;
      case 'cable': return <Activity className="w-5 h-5 text-amber-400" />;
      case 'mount': return <Shield className="w-5 h-5 text-neutral-400" />;
      default: return <Package className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'text-emerald-400 bg-emerald-400/10';
      case 'good': return 'text-blue-400 bg-blue-400/10';
      case 'fair': return 'text-yellow-400 bg-yellow-400/10';
      case 'poor': return 'text-red-400 bg-red-400/10';
      default: return 'text-neutral-400 bg-neutral-400/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading equipment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">My Equipment</h1>
          <p className="text-sm text-neutral-400">Manage your assigned equipment</p>
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
            onClick={handleScanQR}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            <QrCode className="w-4 h-4 mr-1" />
            Scan QR
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
      <div className="grid grid-cols-4 gap-2">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-white">{stats.total}</p>
            <p className="text-[10px] text-neutral-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-blue-400">{stats.assigned}</p>
            <p className="text-[10px] text-neutral-400">Assigned</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{stats.available}</p>
            <p className="text-[10px] text-neutral-400">Available</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{stats.maintenance}</p>
            <p className="text-[10px] text-neutral-400">Maintenance</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search equipment..."
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
          <option value="available">Available</option>
          <option value="deployed">Deployed</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {/* Equipment List */}
      {filteredEquipment.length > 0 ? (
        <div className="space-y-3">
          {filteredEquipment.map((item) => (
            <Card key={item.id} className="bg-[#161616] border-neutral-800 hover:border-lime-400/30 transition">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-800/50 rounded-lg flex items-center justify-center">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{item.model || item.serialNumber}</h3>
                      <span className="text-xs text-neutral-500">{item.serialNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-neutral-400">{item.manufacturer}</span>
                      <span className="text-neutral-600">•</span>
                      <StatusBadge status={item.status as any} />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getConditionColor(item.condition)}`}>
                        {item.condition}
                      </span>
                    </div>
                    {item.health?.batteryLevel !== undefined && (
                      <div className="flex items-center gap-1 mt-1">
                        <Battery className="w-3 h-3 text-neutral-500" />
                        <span className="text-xs text-neutral-400">{item.health.batteryLevel}%</span>
                        <Signal className="w-3 h-3 text-neutral-500 ml-2" />
                        <span className="text-xs text-neutral-400">{item.health.signalStrength || '100'}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedEquipment(item);
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
            <Package className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">No equipment found</p>
            <p className="text-sm text-neutral-500">Scan a QR code to add equipment</p>
            <Button 
              variant="outline" 
              className="mt-4 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={handleScanQR}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Scan QR Code
            </Button>
          </CardContent>
        </Card>
      )}

      {/* QR Scan Modal */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title="Scan QR Code">
        <div className="space-y-4 text-center py-4">
          <div className="w-48 h-48 mx-auto bg-neutral-800/50 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <QrCode className="w-16 h-16 text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">Scan Equipment QR</p>
              <p className="text-xs text-neutral-500">Position the QR code within the frame</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Or enter QR code manually"
              value={scanResult}
              onChange={(e) => setScanResult(e.target.value)}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
            />
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              onClick={() => {
                setQrModalOpen(false);
                setScanResult('');
              }}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-lime-400 text-black hover:bg-lime-300"
              onClick={handleQRScanComplete}
              disabled={!scanResult.trim()}
            >
              <Check className="w-4 h-4 mr-2" />
              Verify
            </Button>
          </div>
        </div>
      </Modal>

      {/* Equipment Detail Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Equipment Details" size="lg">
        {selectedEquipment && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedEquipment.type)}
                  <h3 className="text-lg font-bold text-white">{selectedEquipment.model || selectedEquipment.serialNumber}</h3>
                </div>
                <p className="text-sm text-neutral-400">SN: {selectedEquipment.serialNumber}</p>
              </div>
              <StatusBadge status={selectedEquipment.status as any} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Type</p>
                <p className="text-white capitalize">{selectedEquipment.type}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Manufacturer</p>
                <p className="text-white">{selectedEquipment.manufacturer}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Condition</p>
                <p className={`capitalize ${getConditionColor(selectedEquipment.condition)} px-2 py-0.5 rounded inline-block`}>
                  {selectedEquipment.condition}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Firmware</p>
                <p className="text-white">{selectedEquipment.health?.firmwareVersion || '1.0.0'}</p>
              </div>
            </div>

            {selectedEquipment.health && (
              <div className="bg-neutral-800/30 p-3 rounded-lg">
                <p className="text-xs font-medium text-neutral-400 mb-2">Health Status</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-neutral-500">Battery</p>
                    <p className="text-white">{selectedEquipment.health.batteryLevel || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Signal</p>
                    <p className="text-white">{selectedEquipment.health.signalStrength || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Uptime</p>
                    <p className="text-white">{selectedEquipment.health.uptime || 0}h</p>
                  </div>
                </div>
              </div>
            )}

            {selectedEquipment.lastUsed && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Last Used</p>
                <p className="text-white">{selectedEquipment.lastUsed.toLocaleString()}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-neutral-800">
              {selectedEquipment.status === 'deployed' && (
                <>
                  <Button 
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                    onClick={() => handleUpdateStatus(selectedEquipment.id, 'available')}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Mark Available
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => handleUpdateStatus(selectedEquipment.id, 'maintenance')}
                  >
                    <Tool className="w-4 h-4 mr-2" />
                    Report Maintenance
                  </Button>
                </>
              )}
              {selectedEquipment.assignedTo === user?.uid && (
                <Button 
                  variant="outline"
                  className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                  onClick={() => handleReturnEquipment(selectedEquipment.id)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Return Equipment
                </Button>
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161616] border-t border-neutral-800 flex justify-around py-3">
        <button className="text-neutral-500 hover:text-white transition">
          <Calendar className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Jobs</span>
        </button>
        <button className="text-lime-400">
          <Package className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Equipment</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <MapPin className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Route</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <Camera className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Scan</span>
        </button>
        <button className="text-neutral-500 hover:text-white transition">
          <Settings className="w-6 h-6 mx-auto" />
          <span className="text-[10px] block">Settings</span>
        </button>
      </div>
    </div>
  );
}

export default TechnicianEquipment;