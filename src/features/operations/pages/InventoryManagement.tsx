// src/features/operations/pages/InventoryManagement.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Package, Search, Filter, Plus, QrCode, 
  AlertTriangle, CheckCircle, Wifi, Camera, 
  HardDrive, Edit, Trash2, Download, RefreshCw,
  Eye, X, Save, Clock, Shield, Server, Cpu,
  Battery, Signal, Activity, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Currency } from '@/components/ui/Currency';
import { useAuthStore } from '@/stores/authStore';
import { firebaseUtils } from '@/lib/firebase';
import { equipmentService } from '@/services/firebase/firestore.service';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  Timestamp,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Equipment } from '@/types/models';

interface EquipmentFormData {
  serialNumber: string;
  type: 'camera' | 'router' | 'nvr' | 'switch' | 'cable' | 'mount';
  model: string;
  manufacturer: string;
  status: 'available' | 'deployed' | 'maintenance' | 'retired';
  purchasePrice: number;
  purchaseDate: string;
  warrantyExpiry: string;
  notes: string;
}

export function InventoryManagement() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState<EquipmentFormData>({
    serialNumber: '',
    type: 'camera',
    model: '',
    manufacturer: '',
    status: 'available',
    purchasePrice: 0,
    purchaseDate: '',
    warrantyExpiry: '',
    notes: '',
  });

  // Load equipment
  const loadEquipment = useCallback(async () => {
    try {
      setLoading(true);
      
      const equipmentData = await equipmentService.getAll();
      setEquipment(equipmentData);

      firebaseUtils.logEvent('inventory_viewed', {
        userId: user?.uid,
        totalItems: equipmentData.length,
      });

    } catch (error) {
      console.error('Error loading equipment:', error);
      firebaseUtils.logEvent('inventory_error', {
        error: String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadEquipment();

    // Real-time updates
    const unsubscribe = equipmentService.listenAll((data) => {
      setEquipment(data);
    });

    return () => unsubscribe();
  }, [loadEquipment]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEquipment();
  };

  const handleAddEquipment = async () => {
    // Validate
    if (!formData.serialNumber || !formData.model || !formData.manufacturer) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      const newEquipment = {
        serialNumber: formData.serialNumber,
        type: formData.type,
        model: formData.model,
        manufacturer: formData.manufacturer,
        status: formData.status,
        qrCode: `QR-${Date.now()}-${formData.serialNumber}`,
        purchasePrice: formData.purchasePrice || 0,
        purchaseDate: formData.purchaseDate ? Timestamp.fromDate(new Date(formData.purchaseDate)) : Timestamp.now(),
        warrantyExpiry: formData.warrantyExpiry ? Timestamp.fromDate(new Date(formData.warrantyExpiry)) : Timestamp.now(),
        lastMaintenance: Timestamp.now(),
        health: {
          lastPing: Timestamp.now(),
          firmwareVersion: '1.0.0',
          uptime: 0,
          alertsCount: 0,
        },
        notes: formData.notes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'equipment'), newEquipment);

      firebaseUtils.logEvent('equipment_added', {
        type: formData.type,
        status: formData.status,
      });

      setSuccessMessage('Equipment added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setAddModalOpen(false);
      resetForm();
      await loadEquipment();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to add equipment');
      console.error('Error adding equipment:', error);
    }
  };

  const handleUpdateEquipment = async () => {
    if (!selectedEquipment) return;

    try {
      await updateDoc(doc(db, 'equipment', selectedEquipment.id), {
        serialNumber: formData.serialNumber,
        type: formData.type,
        model: formData.model,
        manufacturer: formData.manufacturer,
        status: formData.status,
        purchasePrice: formData.purchasePrice,
        notes: formData.notes,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('equipment_updated', {
        id: selectedEquipment.id,
        status: formData.status,
      });

      setSuccessMessage('Equipment updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setEditModalOpen(false);
      await loadEquipment();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update equipment');
      console.error('Error updating equipment:', error);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment? This action cannot be undone.')) return;

    try {
      await deleteDoc(doc(db, 'equipment', id));
      
      firebaseUtils.logEvent('equipment_deleted', { id });
      
      setSuccessMessage('Equipment deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadEquipment();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete equipment');
      console.error('Error deleting equipment:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'equipment', id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      firebaseUtils.logEvent('equipment_status_changed', {
        id,
        newStatus,
      });

      await loadEquipment();

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update status');
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      serialNumber: '',
      type: 'camera',
      model: '',
      manufacturer: '',
      status: 'available',
      purchasePrice: 0,
      purchaseDate: '',
      warrantyExpiry: '',
      notes: '',
    });
    setErrorMessage('');
  };

  const openEditModal = (item: Equipment) => {
    setSelectedEquipment(item);
    setFormData({
      serialNumber: item.serialNumber,
      type: item.type,
      model: item.model,
      manufacturer: item.manufacturer,
      status: item.status,
      purchasePrice: item.purchasePrice || 0,
      purchaseDate: item.purchaseDate ? new Date(item.purchaseDate.seconds * 1000).toISOString().split('T')[0] : '',
      warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry.seconds * 1000).toISOString().split('T')[0] : '',
      notes: item.notes || '',
    });
    setEditModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      available: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      deployed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      maintenance: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      retired: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
      lost: 'bg-red-500/10 text-red-400 border-red-500/20',
      damaged: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return badges[status as keyof typeof badges] || badges.available;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'camera': return <Camera className="w-5 h-5 text-lime-400" />;
      case 'router': return <Wifi className="w-5 h-5 text-blue-400" />;
      case 'nvr': return <HardDrive className="w-5 h-5 text-purple-400" />;
      case 'switch': return <Server className="w-5 h-5 text-amber-400" />;
      case 'cable': return <Activity className="w-5 h-5 text-emerald-400" />;
      case 'mount': return <Shield className="w-5 h-5 text-neutral-400" />;
      default: return <Package className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-emerald-400 bg-emerald-500/10';
    if (health >= 60) return 'text-yellow-400 bg-yellow-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  const filteredEquipment = equipment.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery && !item.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !item.model?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    deployed: equipment.filter(e => e.status === 'deployed').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    lowHealth: equipment.filter(e => e.health?.alertsCount > 5 || false).length,
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
          <p className="text-neutral-400 mt-1">Track and manage all equipment assets</p>
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
            onClick={() => setQrScannerOpen(true)}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan QR
          </Button>
          <Button 
            onClick={() => {
              resetForm();
              setAddModalOpen(true);
            }}
            className="bg-lime-400 text-black hover:bg-lime-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Equipment
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Total Equipment</p>
            <p className="text-xl font-bold text-white">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Available</p>
            <p className="text-xl font-bold text-emerald-400">{stats.available}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Deployed</p>
            <p className="text-xl font-bold text-blue-400">{stats.deployed}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Maintenance</p>
            <p className="text-xl font-bold text-yellow-400">{stats.maintenance}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#161616] border-neutral-800">
          <CardContent className="p-3">
            <p className="text-xs text-neutral-400">Needs Attention</p>
            <p className="text-xl font-bold text-red-400">{stats.lowHealth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by serial number or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-neutral-500" />}
                className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="all">All Types</option>
              <option value="camera">Cameras</option>
              <option value="router">Routers</option>
              <option value="nvr">NVRs</option>
              <option value="switch">Switches</option>
              <option value="cable">Cables</option>
              <option value="mount">Mounts</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="deployed">Deployed</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <Button 
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Table */}
      <Card className="bg-[#161616] border-neutral-800">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-800/50 border-b border-neutral-800">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Type</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Serial Number</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Model</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Manufacturer</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Location</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Health</th>
                <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.length > 0 ? (
                filteredEquipment.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition">
                    <td className="p-3">{getTypeIcon(item.type)}</td>
                    <td className="p-3 font-medium text-white">{item.serialNumber}</td>
                    <td className="p-3 text-neutral-400">{item.model}</td>
                    <td className="p-3 text-neutral-400">{item.manufacturer}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-400">{item.currentLocation || '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all`}
                            style={{ 
                              width: `${Math.min((item.health?.uptime || 0) / 100, 100)}%`,
                              backgroundColor: (item.health?.uptime || 0) >= 80 ? '#34d399' : 
                                             (item.health?.uptime || 0) >= 60 ? '#fbbf24' : '#f87171'
                            }}
                          />
                        </div>
                        <span className="text-xs text-neutral-400">{Math.min((item.health?.uptime || 0), 100)}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(item)}
                          className="text-neutral-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteEquipment(item.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No equipment found</p>
                    <p className="text-xs mt-1">Add your first piece of equipment</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Equipment Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Equipment" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Serial Number *"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="camera">Camera</option>
              <option value="router">Router</option>
              <option value="nvr">NVR</option>
              <option value="switch">Switch</option>
              <option value="cable">Cable</option>
              <option value="mount">Mount</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Model *"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <Input
              label="Manufacturer *"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="available">Available</option>
              <option value="deployed">Deployed</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Purchase Price (₵)"
              type="number"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <Input
              label="Purchase Date"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <Input
            label="Warranty Expiry"
            type="date"
            value={formData.warrantyExpiry}
            onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
            className="bg-neutral-900/50 border-neutral-800 text-white"
          />
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Any additional notes..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setAddModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddEquipment}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Add Equipment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Equipment Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Equipment" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Serial Number *"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="camera">Camera</option>
              <option value="router">Router</option>
              <option value="nvr">NVR</option>
              <option value="switch">Switch</option>
              <option value="cable">Cable</option>
              <option value="mount">Mount</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Model *"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
            <Input
              label="Manufacturer *"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-400/50"
            >
              <option value="available">Available</option>
              <option value="deployed">Deployed</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Purchase Price (₵)"
              type="number"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
              className="bg-neutral-900/50 border-neutral-800 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-lime-400/50"
              placeholder="Any additional notes..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <Button 
              variant="outline" 
              onClick={() => setEditModalOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateEquipment}
              className="bg-lime-400 text-black hover:bg-lime-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Update Equipment
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal isOpen={qrScannerOpen} onClose={() => setQrScannerOpen(false)} title="Scan QR Code">
        <div className="space-y-4 text-center py-8">
          <div className="w-48 h-48 mx-auto bg-neutral-800/50 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <QrCode className="w-16 h-16 text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">Camera preview</p>
              <p className="text-xs text-neutral-500">Scan equipment QR code</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400">Position the QR code within the frame</p>
          <div className="flex justify-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setQrScannerOpen(false)}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button 
              className="bg-lime-400 text-black hover:bg-lime-300"
              onClick={() => {
                setQrScannerOpen(false);
                alert('QR Code scanned! (Demo)');
              }}
            >
              <Camera className="w-4 h-4 mr-2" />
              Scan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default InventoryManagement;