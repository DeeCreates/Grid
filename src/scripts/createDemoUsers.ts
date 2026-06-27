// src/scripts/createDemoUsers.ts
import { authService } from '@/services/firebase/auth.service';
import { firebaseUtils } from '@/lib/firebase/config';
import { Timestamp } from 'firebase/firestore';
import type { User } from '@/types/models';

export const DEMO_USERS = [
  {
    email: 'demo.customer@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'John Mensah',
    phoneNumber: '+233 24 123 4567',
    role: 'customer' as const,
    company: 'Mensah Enterprises',
  },
  {
    email: 'demo.technician@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Kwame Ansah',
    phoneNumber: '+233 24 111 2222',
    role: 'technician' as const,
    company: 'GRID Security',
  },
  {
    email: 'demo.guard@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Ama Boateng',
    phoneNumber: '+233 20 333 4444',
    role: 'guard' as const,
    company: 'GRID Security',
  },
  {
    email: 'demo.partner@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Kofi Asare',
    phoneNumber: '+233 54 555 6666',
    role: 'partner' as const,
    company: 'Asare Group',
  },
  {
    email: 'demo.admin@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Admin User',
    phoneNumber: '+233 24 777 8888',
    role: 'admin' as const,
    company: 'GRID Security',
  },
  {
    email: 'demo.sales@gridsecurity.com',
    password: 'Demo@123',
    displayName: 'Esi Mensah',
    phoneNumber: '+233 20 999 0000',
    role: 'sales' as const,
    company: 'GRID Security',
  },
];

export async function createDemoUsers() {
  const results = {
    created: [] as string[],
    existing: [] as string[],
    failed: [] as { email: string; error: string }[],
  };

  console.log('🚀 Creating demo users...');

  for (const userData of DEMO_USERS) {
    try {
      // Check if user already exists
      const exists = await authService.userExists(userData.email);
      
      if (exists) {
        results.existing.push(userData.email);
        console.log(`✅ User already exists: ${userData.email}`);
        continue;
      }

      // Create the user
      await authService.signUp(
        userData.email,
        userData.password,
        {
          displayName: userData.displayName,
          phoneNumber: userData.phoneNumber,
          role: userData.role,
          company: userData.company,
        }
      );

      results.created.push(userData.email);
      console.log(`✅ Created user: ${userData.email} (${userData.role})`);

    } catch (error: any) {
      results.failed.push({
        email: userData.email,
        error: error.message || 'Unknown error',
      });
      console.error(`❌ Failed to create ${userData.email}:`, error.message);
    }
  }

  // Log summary
  console.log('\n📊 Demo Users Creation Summary:');
  console.log(`✅ Created: ${results.created.length}`);
  console.log(`📌 Existing: ${results.existing.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.created.length > 0) {
    console.log('\n🔑 Demo Credentials:');
    console.log('-------------------');
    DEMO_USERS.filter(u => results.created.includes(u.email)).forEach(u => {
      console.log(`📧 ${u.email} (${u.role})`);
      console.log(`🔑 Password: ${u.password}`);
      console.log('---');
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Users:');
    results.failed.forEach(f => {
      console.log(`  - ${f.email}: ${f.error}`);
    });
  }

  // Log analytics event
  firebaseUtils.logEvent('demo_users_created', {
    created: results.created.length,
    existing: results.existing.length,
    failed: results.failed.length,
  });

  return results;
}

// Run this function from the browser console or app initialization
// To run: createDemoUsers()