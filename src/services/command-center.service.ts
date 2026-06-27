// src/services/command-center.service.ts
import { FirestoreService } from './firebase/firestore.service';
import { functionsService } from './firebase/firestore.service';
import type { Incident, Alert } from '@/types/models';

export class CommandCenterService {
  // Get command center dashboard data
  async getDashboardData() {
    const [incidents, alerts, onlineDevices, activeSessions] = await Promise.all([
      incidentService.getOpenIncidents(),
      alertService.getUnresolvedAlerts(),
      this.getOnlineDevices(),
      this.getActiveMonitoringSessions(),
    ]);

    return {
      activeClients: await this.getActiveClients(),
      connectedCameras: await this.getConnectedCameras(),
      onlineDevices,
      offlineDevices: await this.getOfflineDevices(),
      activeAlerts: alerts.filter(a => !a.acknowledged).length,
      openIncidents: incidents.length,
      securityPersonnelOnline: await this.getOnlineSecurityPersonnel(),
      currentMonitoringSessions: activeSessions,
      alerts,
      incidents,
    };
  }

  // Get active clients
  async getActiveClients(): Promise<number> {
    const services = await serviceService.getServicesByStatus('active');
    return services.length;
  }

  // Get connected cameras
  async getConnectedCameras(): Promise<number> {
    const equipment = await equipmentService.getEquipmentByStatus('deployed');
    return equipment.length;
  }

  // Get online devices
  async getOnlineDevices(): Promise<number> {
    const equipment = await equipmentService.getAll();
    const online = equipment.filter(e => 
      e.health.lastPing.toDate() > new Date(Date.now() - 5 * 60 * 1000)
    );
    return online.length;
  }

  // Get offline devices
  async getOfflineDevices(): Promise<number> {
    const equipment = await equipmentService.getAll();
    const offline = equipment.filter(e => 
      e.health.lastPing.toDate() <= new Date(Date.now() - 5 * 60 * 1000)
    );
    return offline.length;
  }

  // Get online security personnel
  async getOnlineSecurityPersonnel(): Promise<number> {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['guard', 'technician']),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  // Get active monitoring sessions
  async getActiveMonitoringSessions(): Promise<number> {
    const q = query(
      collection(db, 'monitoringSessions'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  // Create incident
  async createIncident(data: Partial<Incident>): Promise<Incident> {
    const incident = await incidentService.create({
      ...data,
      status: 'detected',
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } as Incident);

    // Auto-escalate based on severity
    if (data.severity === 'critical' || data.severity === 'high') {
      await this.escalateIncident(incident.id, data.severity === 'critical' ? 4 : 3);
    }

    // Send notifications
    await functionsService.sendNotification({
      type: 'incident_created',
      incidentId: incident.id,
      severity: data.severity,
    });

    return incident;
  }

  // Escalate incident
  async escalateIncident(incidentId: string, level: number): Promise<void> {
    const escalationMap = {
      1: ['operator'],
      2: ['supervisor'],
      3: ['security_team'],
      4: ['emergency_services'],
    };

    const toNotify = escalationMap[level as keyof typeof escalationMap] || [];

    await incidentService.update(incidentId, {
      status: 'escalated',
      'escalation.level': level,
      'escalation.timestamp': Timestamp.now(),
    });

    // Send notifications to escalation contacts
    for (const recipient of toNotify) {
      await functionsService.sendNotification({
        type: 'incident_escalated',
        incidentId,
        level,
        recipient,
      });
    }
  }

  // Dispatch security team
  async dispatchTeam(incidentId: string, teamId: string): Promise<void> {
    const incident = await incidentService.get(incidentId);
    if (!incident) throw new Error('Incident not found');

    const team = await this.getSecurityTeam(teamId);
    const eta = this.calculateETA(team.location, incident.location);

    await incidentService.update(incidentId, {
      status: 'assigned',
      assignedTo: team.members,
      'dispatch.teamId': teamId,
      'dispatch.dispatchedAt': Timestamp.now(),
      'dispatch.estimatedArrival': eta,
    });

    // Notify team members
    for (const member of team.members) {
      await functionsService.sendNotification({
        type: 'emergency_dispatch',
        incidentId,
        location: incident.location,
        eta,
        userId: member,
      });
    }
  }

  // Get security team
  async getSecurityTeam(teamId: string) {
    const doc = await getDoc(doc(db, 'securityTeams', teamId));
    return { id: doc.id, ...doc.data() };
  }

  // Calculate ETA
  private calculateETA(from: GeoPoint, to: GeoPoint): number {
    // Simple distance calculation (would use Google Maps API in production)
    const lat1 = from.latitude;
    const lon1 = from.longitude;
    const lat2 = to.latitude;
    const lon2 = to.longitude;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Assume average speed of 40 km/h in city
    return distance / 40 * 60; // Returns minutes
  }

  // Resolve incident
  async resolveIncident(incidentId: string, resolution: {
    actions: string[];
    notes: string;
  }): Promise<void> {
    await incidentService.update(incidentId, {
      status: 'resolved',
      'resolution.actions': resolution.actions,
      'resolution.notes': resolution.notes,
      'resolution.resolvedAt': Timestamp.now(),
    });
  }

  // Close incident
  async closeIncident(incidentId: string): Promise<void> {
    await incidentService.update(incidentId, {
      status: 'closed',
      updatedAt: Timestamp.now(),
    });
  }

  // Real-time alert listener
  listenAlerts(callback: (alerts: Alert[]) => void): () => void {
    const q = query(
      collection(db, 'alerts'),
      where('resolvedAt', '==', null),
      orderBy('severity', 'desc'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Alert[];
      callback(alerts);
    });
  }

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await alertService.update(alertId, {
      acknowledgedBy: userId,
      acknowledgedAt: Timestamp.now(),
    });
  }
}