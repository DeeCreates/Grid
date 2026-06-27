// src/scripts/fixExistingUsers.ts
import { auth } from '@/lib/firebase/config';
import { 
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp,
  runTransaction 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { User } from '@/types/models';

const DEMO_USERS = [
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

export async function fixExistingUsers() {
  console.log('🔧 Fixing existing users...');
  
  const results = {
    fixed: [] as string[],
    failed: [] as string[],
    created: [] as string[],
  };

  for (const userData of DEMO_USERS) {
    try {
      // Check if user exists in Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, userData.email);
      
      if (signInMethods.length === 0) {
        console.log(`⚠️ User ${userData.email} doesn't exist in Auth, skipping...`);
        continue;
      }

      // Try to sign in to get the user
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          userData.email,
          userData.password
        );
        const user = userCredential.user;

        // Check if Firestore document exists
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // Create Firestore document
          const newUser: User = {
            uid: user.uid,
            email: user.email!,
            displayName: userData.displayName,
            phoneNumber: userData.phoneNumber,
            photoURL: '',
            role: userData.role,
            company: userData.company,
            isActive: true,
            isVerified: user.emailVerified,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            lastLoginAt: Timestamp.now(),
            preferences: {
              notifications: true,
              darkMode: false,
              language: 'en',
              timezone: 'Africa/Accra',
            },
          };

          await setDoc(userDocRef, newUser);
          results.created.push(userData.email);
          console.log(`✅ Created Firestore document for: ${userData.email}`);
        } else {
          results.fixed.push(userData.email);
          console.log(`✅ User already fixed: ${userData.email}`);
        }

      } catch (signInError) {
        console.error(`❌ Failed to sign in as ${userData.email}:`, signInError);
        results.failed.push(userData.email);
      }

    } catch (error) {
      console.error(`❌ Error processing ${userData.email}:`, error);
      results.failed.push(userData.email);
    }
  }

  console.log('\n📊 Fix Results:');
  console.log(`✅ Created documents: ${results.created.length}`);
  console.log(`✅ Already fixed: ${results.fixed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.created.length > 0) {
    console.log('\n📝 Created users:');
    results.created.forEach(email => console.log(`  - ${email}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed users:');
    results.failed.forEach(email => console.log(`  - ${email}`));
  }

  return results;
}

// Run this function from browser console:
// import { fixExistingUsers } from './src/scripts/fixExistingUsers.ts';
// fixExistingUsers();