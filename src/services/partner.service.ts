// src/services/partner.service.ts
import { FirestoreService } from './firebase/firestore.service';
import { functionsService } from './firebase/firestore.service';
import type { Lead } from '@/types/models';

export class PartnerService {
  // Get partner dashboard data
  async getDashboardData(partnerId: string) {
    const [leads, referrals, commissions, payouts] = await Promise.all([
      this.getLeads(partnerId),
      this.getReferrals(partnerId),
      this.getCommissions(partnerId),
      this.getPayouts(partnerId),
    ]);

    const converted = leads.filter(l => l.status === 'converted');
    const totalCommission = commissions.reduce((sum, c) => sum + (c.status === 'paid' ? c.amount : 0), 0);
    const pendingCommission = commissions.reduce((sum, c) => sum + (c.status === 'pending' ? c.amount : 0), 0);

    return {
      totalLeads: leads.length,
      convertedLeads: converted.length,
      conversionRate: leads.length > 0 ? Math.round((converted.length / leads.length) * 100) : 0,
      totalEarnings: totalCommission,
      pendingEarnings: pendingCommission,
      referrals,
      commissions,
      payouts,
      partnerInfo: await this.getPartnerInfo(partnerId),
    };
  }

  // Get partner info
  async getPartnerInfo(partnerId: string) {
    const doc = await getDoc(doc(db, 'partners', partnerId));
    return { id: doc.id, ...doc.data() };
  }

  // Get leads
  async getLeads(partnerId: string): Promise<Lead[]> {
    const q = query(
      collection(db, 'leads'),
      where('assignedTo', '==', partnerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get referrals
  async getReferrals(partnerId: string) {
    const q = query(
      collection(db, 'referrals'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get commissions
  async getCommissions(partnerId: string) {
    const q = query(
      collection(db, 'commissions'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Get payouts
  async getPayouts(partnerId: string) {
    const q = query(
      collection(db, 'payouts'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Create referral
  async createReferral(data: {
    partnerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    notes?: string;
  }): Promise<string> {
    const leadRef = await addDoc(collection(db, 'leads'), {
      source: 'referral',
      status: 'new',
      customerData: {
        name: data.customerName,
        email: data.customerEmail,
        phone: data.customerPhone,
      },
      assignedTo: data.partnerId,
      notes: data.notes ? [{ content: data.notes, createdAt: serverTimestamp(), createdBy: data.partnerId }] : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'referrals'), {
      partnerId: data.partnerId,
      leadId: leadRef.id,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return leadRef.id;
  }

  // Request payout
  async requestPayout(partnerId: string, amount: number): Promise<void> {
    await addDoc(collection(db, 'payouts'), {
      partnerId,
      amount,
      status: 'pending',
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}