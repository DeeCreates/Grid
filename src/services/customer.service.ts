// src/services/customer.service.ts
import { FirestoreService } from './firebase/firestore.service';
import { storageService } from './firebase/firestore.service';
import { functionsService } from './firebase/firestore.service';
import type { Service, Booking, Invoice, Incident, Alert } from '@/types/models';

export class CustomerService {
  // Get customer dashboard data
  async getDashboardData(customerId: string) {
    const [services, incidents, alerts, invoices] = await Promise.all([
      this.getActiveServices(customerId),
      this.getRecentIncidents(customerId),
      this.getUnresolvedAlerts(customerId),
      this.getRecentInvoices(customerId),
    ]);

    return {
      activeServices: services.length,
      openIncidents: incidents.filter(i => i.status !== 'resolved').length,
      unresolvedAlerts: alerts.filter(a => !a.acknowledged).length,
      totalCameras: services.reduce((sum, s) => sum + (s.cameraCount || 0), 0),
      pendingInvoices: invoices.filter(i => i.status === 'sent').length,
      services,
      incidents,
      alerts,
      invoices,
    };
  }

  // Get active services
  async getActiveServices(customerId: string): Promise<Service[]> {
    return serviceService.query([
      where('customerId', '==', customerId),
      where('status', 'in', ['active', 'pending']),
      orderBy('createdAt', 'desc'),
    ]);
  }

  // Get service details with equipment
  async getServiceDetails(serviceId: string): Promise<{
    service: Service;
    equipment: Equipment[];
    incidents: Incident[];
    alerts: Alert[];
  }> {
    const [service, equipment, incidents, alerts] = await Promise.all([
      serviceService.get(serviceId),
      equipmentService.getEquipmentByService(serviceId),
      incidentService.getIncidentsByService(serviceId),
      alertService.getAlertsByService(serviceId),
    ]);

    if (!service) throw new Error('Service not found');

    return { service, equipment, incidents, alerts };
  }

  // Get video recordings
  async getRecordings(serviceId: string, dateRange: { start: Date; end: Date }) {
    const recordingsRef = ref(storage, `recordings/${serviceId}`);
    const result = await listAll(recordingsRef);
    
    const recordings = await Promise.all(
      result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return {
          name: item.name,
          url,
          size: item.size,
          metadata: item.metadata,
        };
      })
    );

    // Filter by date range
    return recordings.filter(r => {
      const date = new Date(r.metadata?.timeCreated || 0);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }

  // Request new service
  async requestService(data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<Service> {
    // Calculate price
    const priceResult = await functionsService.calculateServicePrice(data);
    
    const service = await serviceService.create({
      ...data,
      price: priceResult.data.total,
      status: 'pending',
      equipmentIds: [],
    });

    // Create initial booking
    await bookingService.create({
      customerId: data.customerId,
      type: 'installation',
      status: 'pending',
      scheduledDate: Timestamp.now(),
      scheduledWindow: { start: '09:00', end: '17:00' },
      assignedTo: [],
      location: {
        address: data.address,
        coordinates: data.location,
      },
      notes: 'Initial installation booking',
    });

    return service;
  }

  // Book maintenance
  async bookMaintenance(data: Partial<Booking>): Promise<Booking> {
    return bookingService.create({
      ...data,
      type: 'maintenance',
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } as Booking);
  }

  // Submit support ticket
  async submitTicket(data: {
    customerId: string;
    serviceId: string;
    subject: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    attachments?: File[];
  }): Promise<string> {
    // Upload attachments
    let attachmentUrls: string[] = [];
    if (data.attachments) {
      const paths = data.attachments.map((_, i) => 
        `tickets/${data.customerId}/${Date.now()}_${i}`
      );
      attachmentUrls = await storageService.uploadFiles(paths, data.attachments);
    }

    const ticketRef = await addDoc(collection(db, 'tickets'), {
      ...data,
      attachmentUrls,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify support team
    await functionsService.sendNotification({
      type: 'ticket_created',
      ticketId: ticketRef.id,
      customerId: data.customerId,
    });

    return ticketRef.id;
  }

  // Get support tickets
  async getTickets(customerId: string) {
    const q = query(
      collection(db, 'tickets'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Update subscription
  async updateSubscription(serviceId: string, plan: string): Promise<void> {
    const service = await serviceService.get(serviceId);
    if (!service) throw new Error('Service not found');

    // Calculate new price
    const priceResult = await functionsService.calculateServicePrice({
      ...service,
      plan,
    });

    await serviceService.update(serviceId, {
      plan,
      price: priceResult.data.total,
      status: 'active',
    });

    // Generate new invoice
    await functionsService.generateInvoice({ serviceId, plan });
  }

  // Cancel service
  async cancelService(serviceId: string, reason: string): Promise<void> {
    await serviceService.update(serviceId, {
      status: 'cancelled',
      notes: reason,
    });

    // Notify operations team
    await functionsService.sendNotification({
      type: 'service_cancelled',
      serviceId,
    });
  }
}