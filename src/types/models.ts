// src/types/models.ts
import { Timestamp, GeoPoint } from 'firebase/firestore';

// ==================== User & Authentication ====================
export interface User {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  role: 'customer' | 'technician' | 'guard' | 'partner' | 'admin' | 'sales';
  company?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  fcmTokens?: string[];
  permissions?: string[];
  preferences?: {
    notifications: boolean;
    darkMode: boolean;
    language: string;
    timezone: string;
  };
  metadata?: {
    loginCount: number;
    lastIP?: string;
    deviceInfo?: string;
  };
}

// ==================== Services ====================
export interface Service {
  id: string;
  customerId: string;
  customerName: string;
  type: 'cctv' | 'internet' | 'both';
  status: 'draft' | 'pending' | 'active' | 'suspended' | 'completed' | 'cancelled';
  startDate: Timestamp;
  endDate?: Timestamp;
  location: GeoPoint;
  address: string;
  addressDetails?: {
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  cameraCount?: number;
  cameraTypes?: ('indoor' | 'outdoor' | 'ptz' | 'dome' | 'bullet')[];
  internetSpeed?: number;
  storageDays: number;
  monitoringType: 'self' | 'inhouse' | 'thirdparty';
  monitoringSchedule?: {
    monday: { start: string; end: string };
    tuesday: { start: string; end: string };
    wednesday: { start: string; end: string };
    thursday: { start: string; end: string };
    friday: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { start: string; end: string };
  };
  price: number;
  currency: 'GHS';
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  discount?: number;
  totalPrice: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  equipmentIds: string[];
  notes?: string;
  tags?: string[];
  sla?: {
    level: 'basic' | 'standard' | 'premium' | 'enterprise';
    responseTime: number; // minutes
    resolutionTime: number; // minutes
    uptimeGuarantee: number; // percentage
  };
}

// ==================== Equipment ====================
export interface Equipment {
  id: string;
  serialNumber: string;
  qrCode: string;
  type: 'camera' | 'router' | 'nvr' | 'switch' | 'cable' | 'mount' | 'sensor' | 'gateway';
  model: string;
  manufacturer: string;
  category: 'security' | 'networking' | 'accessory';
  status: 'available' | 'deployed' | 'maintenance' | 'retired' | 'lost' | 'damaged';
  currentServiceId?: string;
  currentLocation?: GeoPoint;
  health: {
    lastPing: Timestamp;
    batteryLevel?: number;
    signalStrength?: number;
    firmwareVersion: string;
    uptime: number;
    temperature?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    alertsCount: number;
  };
  purchaseDate: Timestamp;
  purchasePrice: number;
  warrantyExpiry: Timestamp;
  lastMaintenance: Timestamp;
  maintenanceHistory?: {
    date: Timestamp;
    type: 'preventive' | 'corrective' | 'upgrade';
    description: string;
    performedBy: string;
    cost: number;
  }[];
  notes?: string;
  metadata?: Record<string, any>;
  assignedTo?: string;
}

// ==================== Incidents ====================
export interface Incident {
  id: string;
  serviceId: string;
  customerId: string;
  type: 'security' | 'technical' | 'system' | 'physical' | 'cyber';
  severity: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  status: 'detected' | 'verified' | 'investigating' | 'assigned' | 'escalated' | 'resolved' | 'closed';
  timestamp: Timestamp;
  location: GeoPoint;
  address: string;
  description: string;
  category: string;
  subCategory?: string;
  evidence: {
    videoClips: string[];
    screenshots: string[];
    audio: string[];
    documents: string[];
    notes: string[];
  };
  assignedTo: string[];
  escalation: {
    level: number;
    notified: string[];
    timestamp: Timestamp;
    reason?: string;
  };
  resolution?: {
    actions: string[];
    resolvedBy: string;
    resolvedAt: Timestamp;
    notes: string;
    cost?: number;
    timeToResolve?: number; // minutes
  };
  aiAnalysis?: {
    confidence: number;
    recommendations: string[];
    detectedAt: Timestamp;
    modelVersion: string;
  };
  customerFeedback?: {
    rating: number;
    comment: string;
    timestamp: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags?: string[];
}

// ==================== Alerts ====================
export interface Alert {
  id: string;
  serviceId: string;
  customerId: string;
  type: 'intrusion' | 'loitering' | 'offline' | 'storage' | 'network' | 'custom' | 
        'motion' | 'face_detected' | 'license_plate' | 'crowd' | 'fire' | 'glass_break';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  message: string;
  timestamp: Timestamp;
  location?: GeoPoint;
  address?: string;
  source: 'camera' | 'sensor' | 'system' | 'ai' | 'user';
  sourceId?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
  resolvedAt?: Timestamp;
  resolutionNotes?: string;
  videoClip?: string;
  snapshot?: string;
  metadata?: Record<string, any>;
  autoEscalated: boolean;
  escalationLevel?: number;
}

// ==================== Bookings ====================
export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  type: 'installation' | 'maintenance' | 'consultation' | 'emergency' | 'repair' | 'retrieval';
  status: 'pending' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled' | 'rescheduled';
  scheduledDate: Timestamp;
  scheduledWindow: {
    start: string;
    end: string;
  };
  duration: number; // minutes
  assignedTo: string[];
  assignedTeam?: string;
  location: {
    address: string;
    coordinates?: GeoPoint;
    instructions?: string;
  };
  serviceId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  checklist?: {
    item: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: Timestamp;
    notes?: string;
  }[];
  equipmentRequired?: string[];
  completedAt?: Timestamp;
  rating?: number;
  feedback?: string;
  cancellationReason?: string;
  rescheduleReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reminderSent: boolean;
}

// ==================== Invoices & Payments ====================
export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId?: string;
  number: string;
  type: 'subscription' | 'oneTime' | 'installation' | 'maintenance' | 'custom';
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'service' | 'equipment' | 'labor' | 'tax' | 'discount';
    metadata?: Record<string, any>;
  }[];
  subtotal: number;
  tax: number;
  taxRate: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  currency: 'GHS';
  dueDate: Timestamp;
  issuedAt: Timestamp;
  paidAt?: Timestamp;
  paymentMethod?: 'card' | 'mobile_money' | 'bank_transfer' | 'cash';
  paymentDetails?: {
    transactionId?: string;
    reference?: string;
    gateway?: string;
    metadata?: Record<string, any>;
  };
  billingAddress: {
    street: string;
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reminderCount: number;
  lastReminderSent?: Timestamp;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: 'GHS';
  method: 'card' | 'mobile_money' | 'bank_transfer' | 'cash';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  transactionId: string;
  reference: string;
  gateway: string;
  metadata?: Record<string, any>;
  processedAt: Timestamp;
  completedAt?: Timestamp;
  refundedAt?: Timestamp;
  refundReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Leads & Marketing ====================
export interface Lead {
  id: string;
  source: 'website' | 'referral' | 'social' | 'event' | 'partner' | 'cold_call' | 'email' | 'ad' | 'organic';
  status: 'new' | 'contacted' | 'qualified' | 'quoted' | 'negotiating' | 'converted' | 'lost' | 'archived';
  customerData: {
    name: string;
    email: string;
    phone: string;
    company?: string;
    position?: string;
    website?: string;
    industry?: string;
  };
  requirements: {
    serviceType: string[];
    location: string;
    duration?: string;
    budget?: number;
    timeline?: string;
    specificNeeds?: string[];
  };
  assessment?: {
    propertyType: string;
    areaSize: number;
    entrances: number;
    riskScore: number;
    recommendedPackage: string;
    estimatedCost: number;
    cameraCount: number;
    storageRequired: number;
    internetSpeed: number;
  };
  assignedTo?: string;
  assignedTeam?: string;
  notes: {
    content: string;
    createdAt: Timestamp;
    createdBy: string;
    type: 'general' | 'call' | 'email' | 'meeting' | 'follow-up';
  }[];
  activities: {
    type: 'email' | 'call' | 'meeting' | 'note' | 'quote' | 'followup';
    description: string;
    timestamp: Timestamp;
    createdBy: string;
  }[];
  followUpDate?: Timestamp;
  estimatedValue: number;
  conversionProbability: number; // 0-100
  createdAt: Timestamp;
  updatedAt: Timestamp;
  convertedAt?: Timestamp;
  convertedToServiceId?: string;
  lostReason?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// ==================== Subscriptions ====================
export interface Subscription {
  id: string;
  customerId: string;
  serviceId: string;
  plan: {
    id: string;
    name: string;
    tier: 'basic' | 'standard' | 'professional' | 'enterprise' | 'custom';
    features: string[];
    price: number;
    currency: 'GHS';
  };
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';
  startDate: Timestamp;
  endDate: Timestamp;
  autoRenew: boolean;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: Timestamp;
  lastBillingDate?: Timestamp;
  paymentMethod: {
    type: 'card' | 'mobile_money' | 'bank_transfer';
    last4?: string;
    expiryDate?: string;
    provider?: string;
  };
  cancellations?: {
    requestedAt: Timestamp;
    reason: string;
    processedAt?: Timestamp;
    refundAmount?: number;
  };
  pauses?: {
    pausedAt: Timestamp;
    resumeAt?: Timestamp;
    reason: string;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  usage?: {
    storageUsed: number;
    bandwidthUsed: number;
    cameraHours: number;
  };
}

// ==================== Partners & Referrals ====================
export interface Partner {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  type: 'individual' | 'company' | 'agent';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  status: 'active' | 'pending' | 'suspended' | 'inactive';
  referralCode: string;
  referralLink: string;
  commissionRate: number;
  totalEarnings: number;
  pendingEarnings: number;
  totalReferrals: number;
  successfulReferrals: number;
  joinedAt: Timestamp;
  lastActive: Timestamp;
  preferences?: {
    commission: 'percentage' | 'fixed';
    paymentMethod: 'bank' | 'mobile_money' | 'cheque';
    notification: boolean;
  };
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    branch: string;
    swiftCode?: string;
  };
  mobileMoneyDetails?: {
    network: string;
    number: string;
    name: string;
  };
  documents?: {
    id: string;
    type: 'id' | 'license' | 'certificate';
    url: string;
    verified: boolean;
    uploadedAt: Timestamp;
  }[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Referral {
  id: string;
  partnerId: string;
  leadId: string;
  customerId?: string;
  status: 'pending' | 'contacted' | 'converted' | 'commission_paid' | 'expired';
  referredAt: Timestamp;
  convertedAt?: Timestamp;
  commissionAmount?: number;
  commissionPaidAt?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Commission {
  id: string;
  partnerId: string;
  referralId: string;
  amount: number;
  type: 'percentage' | 'fixed';
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  description: string;
  approvedAt?: Timestamp;
  paidAt?: Timestamp;
  paymentReference?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Payout {
  id: string;
  partnerId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  method: 'bank_transfer' | 'mobile_money' | 'cheque' | 'cash';
  reference: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  mobileMoneyDetails?: {
    network: string;
    number: string;
    name: string;
  };
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Monitoring & Surveillance ====================
export interface MonitoringSession {
  id: string;
  serviceId: string;
  operatorId: string;
  operatorName: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  status: 'active' | 'paused' | 'ended';
  cameras: {
    cameraId: string;
    name: string;
    streamUrl: string;
    status: 'online' | 'offline' | 'recording';
    lastActive: Timestamp;
  }[];
  alerts: Alert[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Recording {
  id: string;
  serviceId: string;
  cameraId: string;
  cameraName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number;
  size: number;
  format: string;
  resolution: string;
  frameRate: number;
  path: string;
  thumbnailPath?: string;
  hasMotion: boolean;
  motionEvents?: {
    timestamp: Timestamp;
    confidence: number;
    label: string;
  }[];
  isProtected: boolean;
  retentionDays: number;
  expiresAt: Timestamp;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Reports ====================
export interface Report {
  id: string;
  type: 'security' | 'incident' | 'usage' | 'financial' | 'performance' | 'custom';
  title: string;
  description?: string;
  generatedBy: string;
  generatedFor: string; // customerId or partnerId or userId
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };
  data: Record<string, any>;
  format: 'pdf' | 'csv' | 'excel' | 'json';
  fileUrl?: string;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    nextRun: Timestamp;
    recipients: string[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;
}

// ==================== Notifications ====================
export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Timestamp;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  priority: 'low' | 'medium' | 'high';
  sentAt: Timestamp;
  deliveredAt?: Timestamp;
  expiresAt?: Timestamp;
  metadata?: Record<string, any>;
}

// ==================== Analytics ====================
export interface AnalyticsEvent {
  id: string;
  eventName: string;
  userId?: string;
  sessionId: string;
  timestamp: Timestamp;
  properties: Record<string, any>;
  userProperties?: Record<string, any>;
  deviceInfo: {
    platform: string;
    browser: string;
    os: string;
    device: string;
    screenSize: string;
  };
  location?: {
    country: string;
    region: string;
    city: string;
  };
  createdAt: Timestamp;
}

// ==================== Support Tickets ====================
export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId?: string;
  subject: string;
  description: string;
  category: 'technical' | 'billing' | 'service' | 'emergency' | 'general' | 'complaint';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  status: 'open' | 'inProgress' | 'pending' | 'resolved' | 'closed' | 'escalated';
  attachments: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  assignedTo?: string;
  assignedTeam?: string;
  escalationLevel?: number;
  messages: {
    id: string;
    author: string;
    authorType: 'customer' | 'agent' | 'system';
    message: string;
    timestamp: Timestamp;
    attachments?: string[];
  }[];
  resolution?: {
    summary: string;
    actions: string[];
    resolvedBy: string;
    resolvedAt: Timestamp;
  };
  satisfaction: {
    rating?: number;
    feedback?: string;
    submittedAt?: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt?: Timestamp;
}

// ==================== Security Teams ====================
export interface SecurityTeam {
  id: string;
  name: string;
  type: 'guard' | 'response' | 'monitoring' | 'technical' | 'emergency';
  members: string[]; // User IDs
  leader: string;
  location: GeoPoint;
  status: 'available' | 'deployed' | 'off-duty' | 'emergency';
  schedule: {
    monday: { start: string; end: string }[];
    tuesday: { start: string; end: string }[];
    wednesday: { start: string; end: string }[];
    thursday: { start: string; end: string }[];
    friday: { start: string; end: string }[];
    saturday: { start: string; end: string }[];
    sunday: { start: string; end: string }[];
  };
  vehicles?: {
    id: string;
    type: string;
    plate: string;
    status: 'available' | 'deployed' | 'maintenance';
    location?: GeoPoint;
  }[];
  equipment?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastDeployed?: Timestamp;
}

// ==================== Patrols & Checkpoints ====================
export interface Patrol {
  id: string;
  securityTeamId: string;
  guardId: string;
  route: {
    checkpoints: Checkpoint[];
    startTime: Timestamp;
    endTime?: Timestamp;
    duration: number;
  };
  status: 'scheduled' | 'inProgress' | 'completed' | 'cancelled';
  incidents: string[]; // Incident IDs
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Checkpoint {
  id: string;
  name: string;
  location: GeoPoint;
  address: string;
  type: 'entrance' | 'exit' | 'perimeter' | 'interior' | 'critical';
  status: 'active' | 'inactive' | 'maintenance';
  verificationRequired: 'qr' | 'nfc' | 'photo' | 'manual' | 'biometric';
  verificationHistory: {
    verifiedBy: string;
    timestamp: Timestamp;
    method: string;
    notes?: string;
    photo?: string;
  }[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Inventory & Assets ====================
export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  type: 'consumable' | 'equipment' | 'spare_part' | 'accessory';
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  location: string;
  warehouse?: string;
  purchasePrice: number;
  sellingPrice: number;
  currency: 'GHS';
  supplier?: string;
  supplierContact?: string;
  expiryDate?: Timestamp;
  lastRestocked: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Messages & Chat ====================
export interface Message {
  id: string;
  sender: string;
  senderType: 'user' | 'system' | 'agent' | 'bot';
  receiver: string;
  receiverType: 'user' | 'group' | 'broadcast';
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'location';
  attachments?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  read: boolean;
  readAt?: Timestamp;
  deliveredAt?: Timestamp;
  replyTo?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: Message;
  unreadCount: number;
  type: 'direct' | 'group' | 'broadcast' | 'incident';
  groupName?: string;
  groupIcon?: string;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Audit Logs ====================
export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'share';
  resource: string;
  resourceId?: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  ipAddress: string;
  userAgent: string;
  timestamp: Timestamp;
  status: 'success' | 'failure';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// ==================== System Settings ====================
export interface SystemSettings {
  id: string;
  key: string;
  value: any;
  category: 'general' | 'security' | 'billing' | 'notifications' | 'features' | 'integrations';
  description?: string;
  isPublic: boolean;
  updatedBy: string;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

// ==================== Integration ====================
export interface Integration {
  id: string;
  name: string;
  type: 'payment' | 'email' | 'sms' | 'analytics' | 'crm' | 'iot' | 'ai' | 'automation';
  provider: string;
  status: 'active' | 'inactive' | 'error' | 'pending';
  config: Record<string, any>;
  credentials?: Record<string, any>;
  webhooks?: {
    url: string;
    events: string[];
    secret: string;
  }[];
  lastSync?: Timestamp;
  errorCount: number;
  lastError?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==================== Webhook Events ====================
export interface WebhookEvent {
  id: string;
  event: string;
  payload: Record<string, any>;
  timestamp: Timestamp;
  delivered: boolean;
  deliveryAttempts: number;
  lastDelivery?: Timestamp;
  lastError?: string;
  createdAt: Timestamp;
}

// ==================== Utility Types ====================
export type FirestoreTimestamp = Timestamp;
export type FirestoreGeoPoint = GeoPoint;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterOptions {
  search?: string;
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}