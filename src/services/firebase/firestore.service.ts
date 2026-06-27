// src/services/firebase/firestore.service.ts
import {
  db,
  storage,
  functions,
} from '@/lib/firebase/config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  addDoc,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  FieldValue,
  DocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  UploadTask,
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import type {
  Service,
  Equipment,
  Incident,
  Alert,
  Booking,
  Invoice,
  Lead,
} from '@/types/models';

// Base CRUD operations
export class FirestoreService<T extends { id: string }> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  // Create a document with auto-generated ID
  async create(data: Omit<T, 'id'>): Promise<T> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const newDoc = await getDoc(docRef);
      return { id: docRef.id, ...newDoc.data() } as T;
    } catch (error) {
      console.error(`Create ${this.collectionName} error:`, error);
      throw error;
    }
  }

  // Create a document with specific ID
  async createWithId(id: string, data: Omit<T, 'id'>): Promise<T> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await setDoc(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const newDoc = await getDoc(docRef);
      return { id: docRef.id, ...newDoc.data() } as T;
    } catch (error) {
      console.error(`Create ${this.collectionName} with ID error:`, error);
      throw error;
    }
  }

  // Get a document by ID
  async get(id: string): Promise<T | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as T;
    } catch (error) {
      console.error(`Get ${this.collectionName} error:`, error);
      throw error;
    }
  }

  // Get all documents with optional constraints
  async getAll(constraints: QueryConstraint[] = []): Promise<T[]> {
    try {
      const q = query(collection(db, this.collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      console.error(`Get all ${this.collectionName} error:`, error);
      throw error;
    }
  }

  // Update a document
  async update(id: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Update ${this.collectionName} error:`, error);
      throw error;
    }
  }

  // Delete a document
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Delete ${this.collectionName} error:`, error);
      throw error;
    }
  }

  // Real-time listener for a single document
  listen(id: string, callback: (data: T | null) => void): () => void {
    const docRef = doc(db, this.collectionName, id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as T);
      } else {
        callback(null);
      }
    });
  }

  // Real-time listener for multiple documents
  listenAll(callback: (data: T[]) => void, constraints: QueryConstraint[] = []): () => void {
    const q = query(collection(db, this.collectionName), ...constraints);
    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
      callback(data);
    });
  }

  // Query documents with constraints
  async query(constraints: QueryConstraint[]): Promise<T[]> {
    try {
      const q = query(collection(db, this.collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      console.error(`Query ${this.collectionName} error:`, error);
      throw error;
    }
  }
}

// Specific service classes
export class ServiceService extends FirestoreService<Service> {
  constructor() {
    super('services');
  }

  async getActiveServices(userId: string): Promise<Service[]> {
    return this.query([
      where('customerId', '==', userId),
      where('status', 'in', ['active', 'pending']),
      orderBy('createdAt', 'desc'),
    ]);
  }

  async getServicesByStatus(status: string): Promise<Service[]> {
    return this.query([
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
    ]);
  }
}

export class EquipmentService extends FirestoreService<Equipment> {
  constructor() {
    super('equipment');
  }

  async getAvailableEquipment(): Promise<Equipment[]> {
    return this.query([
      where('status', '==', 'available'),
      orderBy('purchaseDate', 'asc'),
    ]);
  }

  async getEquipmentByService(serviceId: string): Promise<Equipment[]> {
    return this.query([
      where('currentServiceId', '==', serviceId),
    ]);
  }

  async getEquipmentByStatus(status: string): Promise<Equipment[]> {
    return this.query([
      where('status', '==', status),
    ]);
  }
}

export class IncidentService extends FirestoreService<Incident> {
  constructor() {
    super('incidents');
  }

  async getIncidentsByService(serviceId: string): Promise<Incident[]> {
    return this.query([
      where('serviceId', '==', serviceId),
      orderBy('timestamp', 'desc'),
    ]);
  }

  async getOpenIncidents(): Promise<Incident[]> {
    return this.query([
      where('status', 'not-in', ['resolved', 'closed']),
      orderBy('severity', 'desc'),
      orderBy('timestamp', 'desc'),
    ]);
  }
}

export class AlertService extends FirestoreService<Alert> {
  constructor() {
    super('alerts');
  }

  async getUnresolvedAlerts(): Promise<Alert[]> {
    return this.query([
      where('resolvedAt', '==', null),
      orderBy('severity', 'desc'),
      orderBy('timestamp', 'desc'),
    ]);
  }

  async getAlertsByService(serviceId: string): Promise<Alert[]> {
    return this.query([
      where('serviceId', '==', serviceId),
      orderBy('timestamp', 'desc'),
    ]);
  }
}

export class BookingService extends FirestoreService<Booking> {
  constructor() {
    super('bookings');
  }

  async getBookingsByTechnician(technicianId: string): Promise<Booking[]> {
    return this.query([
      where('assignedTo', 'array-contains', technicianId),
      orderBy('scheduledDate', 'asc'),
    ]);
  }

  async getTodayBookings(): Promise<Booking[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.query([
      where('scheduledDate', '>=', today),
      where('scheduledDate', '<', tomorrow),
      orderBy('scheduledDate', 'asc'),
    ]);
  }
}

export class InvoiceService extends FirestoreService<Invoice> {
  constructor() {
    super('invoices');
  }

  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    return this.query([
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
    ]);
  }

  async getUnpaidInvoices(): Promise<Invoice[]> {
    return this.query([
      where('status', 'in', ['draft', 'sent', 'overdue']),
      orderBy('dueDate', 'asc'),
    ]);
  }
}

export class LeadService extends FirestoreService<Lead> {
  constructor() {
    super('leads');
  }

  async getNewLeads(): Promise<Lead[]> {
    return this.query([
      where('status', '==', 'new'),
      orderBy('createdAt', 'desc'),
    ]);
  }

  async getLeadsBySource(source: string): Promise<Lead[]> {
    return this.query([
      where('source', '==', source),
      orderBy('createdAt', 'desc'),
    ]);
  }
}

// Export singleton instances
export const serviceService = new ServiceService();
export const equipmentService = new EquipmentService();
export const incidentService = new IncidentService();
export const alertService = new AlertService();
export const bookingService = new BookingService();
export const invoiceService = new InvoiceService();
export const leadService = new LeadService();

// Storage utilities
export const storageService = {
  // Upload a file
  async uploadFile(path: string, file: File): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  },

  // Upload multiple files
  async uploadFiles(paths: string[], files: File[]): Promise<string[]> {
    try {
      const uploadPromises = files.map((file, index) => {
        const storageRef = ref(storage, paths[index]);
        return uploadBytes(storageRef, file).then(() => getDownloadURL(storageRef));
      });
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Upload files error:', error);
      throw error;
    }
  },

  // Delete a file
  async deleteFile(path: string): Promise<void> {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  },

  // Get download URL
  async getDownloadURL(path: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Get download URL error:', error);
      throw error;
    }
  },

  // List files in a directory
  async listFiles(path: string): Promise<string[]> {
    try {
      const storageRef = ref(storage, path);
      const result = await listAll(storageRef);
      return result.items.map((item) => item.name);
    } catch (error) {
      console.error('List files error:', error);
      throw error;
    }
  },
};

// Cloud Functions
export const functionsService = {
  // Calculate service price
  calculateServicePrice: httpsCallable(functions, 'calculateServicePrice'),

  // Generate invoice
  generateInvoice: httpsCallable(functions, 'generateInvoice'),

  // Process payment
  processPayment: httpsCallable(functions, 'processPayment'),

  // Send notification
  sendNotification: httpsCallable(functions, 'sendNotification'),

  // AI Security Assessment
  aiSecurityAssessment: httpsCallable(functions, 'aiSecurityAssessment'),

  // Generate report
  generateReport: httpsCallable(functions, 'generateReport'),

  // Optimize routes
  optimizeRoutes: httpsCallable(functions, 'optimizeRoutes'),

  // Process video analytics
  processVideoAnalytics: httpsCallable(functions, 'processVideoAnalytics'),
};

// Batch operations
export const batchService = {
  async writeBatch(operations: Array<{
    type: 'set' | 'update' | 'delete';
    ref: string;
    data?: any;
  }>): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const op of operations) {
        const docRef = doc(db, op.ref);
        switch (op.type) {
          case 'set':
            batch.set(docRef, op.data);
            break;
          case 'update':
            batch.update(docRef, op.data);
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Batch write error:', error);
      throw error;
    }
  },
};