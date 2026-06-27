// src/scripts/fixDemoUsers.ts
import { authService } from '@/services/firebase/auth.service';
import { auth, db } from '@/lib/firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

const DEMO_USERS = [
  {
    email: 'demo.customer@gridsecurity.com',
    password: 'Demo@123',
    role: 'customer',
    displayName: 'John Mensah',
  },
  {
    email: 'demo.technician@gridsecurity.com',
    password: 'Demo@123',
    role: 'technician',
    displayName: 'Kwame Ansah',
  },
  {
    email: 'demo.guard@gridsecurity.com',
    password: 'Demo@123',
    role: 'guard',
    displayName: 'Ama Boateng',
  },
  {
    email: 'demo.partner@gridsecurity.com',
    password: 'Demo@123',
    role: 'partner',
    displayName: 'Kofi Asare',
  },
  {
    email: 'demo.admin@gridsecurity.com',
    password: 'Demo@123',
    role: 'admin',
    displayName: 'Admin User',
  },
  {
    email: 'demo.sales@gridsecurity.com',
    password: 'Demo@123',
    role: 'sales',
    displayName: 'Esi Mensah',
  },
];

export async function fixDemoUsers() {
  console.log('🔧 Fixing demo users...');

  for (const userData of DEMO_USERS) {
    try {
      // Try to sign in to get the user
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          userData.email,
          userData.password
        );
        const { user } = userCredential;
        
        // Check if Firestore document exists
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          // Create Firestore document
          const newUser = {
            uid: user.uid,
            email: user.email!,
            displayName: userData.displayName,
            phoneNumber: '+233 24 123 4567',
            photoURL: '',
            role: userData.role,
            company: `${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)} Demo Company`,
            isActive: true,
            isVerified: true,
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
          await setDoc(doc(db, 'users', user.uid), newUser);
          console.log(`✅ Fixed user: ${userData.email} (${userData.role})`);
        } else {
          console.log(`✅ User already exists: ${userData.email}`);
        }
      } catch (signInError) {
        console.log(`❌ User ${userData.email} not found in Auth. Skipping...`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${userData.email}:`, error);
    }
  }

  console.log('✅ Demo users fix completed!');
}

// Run this from browser console or your app
// To run: fixDemoUsers()