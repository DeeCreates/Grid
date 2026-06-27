// src/services/operations.service.ts
import { FirestoreService } from './firebase/firestore.service';
import { functionsService } from './firebase/firestore.service';
import type { Service, Equipment, Booking, Invoice, Lead } from '@/types/models';

export class OperationsService {
  // Get operations dashboard data
  async getDashboardData() {
    const [services, equipment, bookings, invoices, leads] = await Promise.all([
      serviceService.getAll(),
      equipmentService.getAll(),
      bookingService.getAll(),
      invoiceService.getAll(),
      leadService.getAll(),
    ]);

    const activeServices = services.filter(s => s.status === 'active');
    const todayBookings = await bookingService.getTodayBookings();
    const availableEquipment = equipment.filter(e => e.status === 'available');
    const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const newLeads = leads.filter(l => l.status === 'new');

    return {
      activeProjects: activeServices.length,
      deploymentsToday: todayBookings.length,
      availableEquipment: availableEquipment.length,
      revenue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
      openTickets: 0, // Would come from tickets collection
      utilizationRate: Math.round((activeServices.length / (services.length || 1)) * 100),
      todayBookings,
      pendingInvoices,
      newLeads,
    };
  }

  // Get customer management data
  async getCustomerManagement() {
    const customers = await this.getAllCustomers();
    const customerStats = await Promise.all(
      customers.map(async (customer) => {
        const services = await serviceService.getActiveServices(customer.uid);
        const invoices = await invoiceService.getInvoicesByCustomer(customer.uid);
        return {
          ...customer,
          activeServices: services.length,
          totalSpent: invoices.reduce((sum, i) => sum + (i.status === 'paid' ? i.total : 0), 0),
          lastActive: customer.lastLoginAt || customer.createdAt,
        };
      })
    );

    return customerStats;
  }

  // Get all customers
  async getAllCustomers() {
    const q = query(collection(db, 'users'), where('role', '==', 'customer'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Create deployment
  async createDeployment(data: Partial<Booking>): Promise<Booking> {
    // Check equipment availability
    const requiredEquipment = data.equipmentIds || [];
    const available = await equipmentService.getAvailableEquipment();
    const availableIds = available.map(e => e.id);
    
    const missing = requiredEquipment.filter(id => !availableIds.includes(id));
    if (missing.length > 0) {
      throw new Error(`Equipment not available: ${missing.join(', ')}`);
    }

    // Assign equipment
    const booking = await bookingService.create(data as Booking);
    
    // Update equipment status
    await Promise.all(
      requiredEquipment.map(id => 
        equipmentService.update(id, { 
          status: 'deployed', 
          currentServiceId: booking.id 
        })
      )
    );

    return booking;
  }

  // Optimize deployment routes
  async optimizeRoutes(deployments: Booking[]) {
    const result = await functionsService.optimizeRoutes({ deployments });
    return result.data;
  }

  // Get inventory data
  async getInventory() {
    const equipment = await equipmentService.getAll();
    
    return {
      total: equipment.length,
      available: equipment.filter(e => e.status === 'available').length,
      deployed: equipment.filter(e => e.status === 'deployed').length,
      maintenance: equipment.filter(e => e.status === 'maintenance').length,
      retired: equipment.filter(e => e.status === 'retired').length,
      lowHealth: equipment.filter(e => e.health.batteryLevel && e.health.batteryLevel < 20).length,
      equipment,
    };
  }

  // Add equipment
  async addEquipment(data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipment> {
    return equipmentService.create({
      ...data,
      status: 'available',
      health: {
        lastPing: Timestamp.now(),
        firmwareVersion: '1.0.0',
        uptime: 0,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } as Equipment);
  }

  // Get analytics data
  async getAnalytics(dateRange: { start: Date; end: Date }) {
    const [services, invoices, bookings, incidents] = await Promise.all([
      serviceService.getAll(),
      invoiceService.getAll(),
      bookingService.getAll(),
      incidentService.getAll(),
    ]);

    // Filter by date range
    const filteredInvoices = invoices.filter(i => 
      i.createdAt.toDate() >= dateRange.start && 
      i.createdAt.toDate() <= dateRange.end
    );

    const revenueByMonth = this.groupByMonth(filteredInvoices);
    const servicesByType = this.groupByType(services);
    const customerGrowth = await this.getCustomerGrowth(dateRange);

    return {
      revenue: {
        total: filteredInvoices.reduce((sum, i) => sum + (i.status === 'paid' ? i.total : 0), 0),
        byMonth: revenueByMonth,
      },
      services: {
        total: services.length,
        byType: servicesByType,
        active: services.filter(s => s.status === 'active').length,
      },
      customers: customerGrowth,
      bookings: {
        total: bookings.filter(b => 
          b.createdAt.toDate() >= dateRange.start && 
          b.createdAt.toDate() <= dateRange.end
        ).length,
        completed: bookings.filter(b => b.status === 'completed').length,
      },
      incidents: {
        total: incidents.filter(i =>
          i.createdAt.toDate() >= dateRange.start &&
          i.createdAt.toDate() <= dateRange.end
        ).length,
        resolved: incidents.filter(i => i.status === 'resolved').length,
      },
    };
  }

  // Helper methods
  private groupByMonth(invoices: Invoice[]) {
    const groups: Record<string, number> = {};
    invoices.forEach(invoice => {
      const month = invoice.createdAt.toDate().toLocaleString('default', { month: 'short' });
      groups[month] = (groups[month] || 0) + invoice.total;
    });
    return groups;
  }

  private groupByType(services: Service[]) {
    const groups: Record<string, number> = {};
    services.forEach(service => {
      groups[service.type] = (groups[service.type] || 0) + 1;
    });
    return groups;
  }

  private async getCustomerGrowth(dateRange: { start: Date; end: Date }) {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'customer'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const customers = snapshot.docs.map(doc => doc.data());
    
    const growth = customers.filter(c => 
      c.createdAt.toDate() >= dateRange.start &&
      c.createdAt.toDate() <= dateRange.end
    );

    return {
      total: customers.length,
      new: growth.length,
      active: customers.filter(c => c.isActive).length,
    };
  }
}