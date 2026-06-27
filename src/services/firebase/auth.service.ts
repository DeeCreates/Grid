// src/services/firebase/auth.service.ts
import {
  auth,
  firebaseUtils,
} from '@/lib/firebase/config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  User as FirebaseUser,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { User } from '@/types/models';

// Helper function to create standardized error objects
function createAuthError(code: string, message: string): Error {
  const error = new Error(message);
  (error as any).code = code;
  return error;
}

export const authService = {
  /**
   * Sign up new user
   */
  async signUp(
    email: string,
    password: string,
    userData: Partial<User>
  ): Promise<User> {
    try {
      // Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const { user } = userCredential;

      // Update profile with display name if provided
      if (userData.displayName) {
        await updateProfile(user, {
          displayName: userData.displayName,
          photoURL: userData.photoURL || null,
        });
      }

      // Create user document in Firestore
      const userDoc: User = {
        uid: user.uid,
        email: user.email!,
        displayName: userData.displayName || '',
        phoneNumber: userData.phoneNumber || '',
        photoURL: userData.photoURL || '',
        role: userData.role || 'customer',
        company: userData.company || '',
        isActive: true,
        isVerified: false,
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

      await setDoc(doc(db, 'users', user.uid), userDoc);

      // Log analytics event
      firebaseUtils.logEvent('sign_up', {
        method: 'email',
        role: userData.role || 'customer',
      });

      return userDoc;
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Handle Firebase errors
      const errorCode = error.code || '';
      
      if (errorCode === 'auth/email-already-in-use') {
        throw createAuthError(
          'auth/email-already-in-use',
          'This email is already registered. Please sign in instead.'
        );
      }
      if (errorCode === 'auth/weak-password') {
        throw createAuthError(
          'auth/weak-password',
          'Password is too weak. Please use a stronger password.'
        );
      }
      if (errorCode === 'auth/invalid-email') {
        throw createAuthError(
          'auth/invalid-email',
          'Please enter a valid email address.'
        );
      }
      if (errorCode === 'auth/network-request-failed') {
        throw createAuthError(
          'auth/network-request-failed',
          'Network error. Please check your internet connection and try again.'
        );
      }
      
      // Generic error
      throw createAuthError(
        'auth/unknown',
        error.message || 'Registration failed. Please try again.'
      );
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string): Promise<User> {
    try {
      // Sign in the user - let Firebase handle the error if user doesn't exist
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const { user } = userCredential;

      // Get user document from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      let userData: User;
      
      if (!userDoc.exists()) {
        // If document doesn't exist, create it (for existing auth users)
        console.log('Creating Firestore document for existing auth user...');
        
        userData = {
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName || '',
          phoneNumber: user.phoneNumber || '',
          photoURL: user.photoURL || '',
          role: 'customer',
          company: '',
          isActive: true,
          isVerified: user.emailVerified || false,
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
        
        await setDoc(doc(db, 'users', user.uid), userData);
        
        // Update auth profile if display name is missing
        if (!user.displayName) {
          await updateProfile(user, {
            displayName: email.split('@')[0],
          });
        }
      } else {
        userData = userDoc.data() as User;
      }

      // Update last login timestamp
      await updateDoc(doc(db, 'users', user.uid), {
        lastLoginAt: Timestamp.now(),
      });

      // Log analytics event
      firebaseUtils.logEvent('login', {
        method: 'email',
        role: userData.role,
      });

      return userData;
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Handle Firebase Auth errors
      const errorCode = error.code || '';
      
      if (errorCode === 'auth/user-not-found') {
        throw createAuthError(
          'auth/user-not-found',
          'No account found with this email address'
        );
      }
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        throw createAuthError(
          'auth/wrong-password',
          'Incorrect password. Please try again.'
        );
      }
      if (errorCode === 'auth/too-many-requests') {
        throw createAuthError(
          'auth/too-many-requests',
          'Too many failed attempts. Please try again later.'
        );
      }
      if (errorCode === 'auth/invalid-email') {
        throw createAuthError(
          'auth/invalid-email',
          'Please enter a valid email address'
        );
      }
      if (errorCode === 'auth/user-disabled') {
        throw createAuthError(
          'auth/user-disabled',
          'This account has been disabled. Please contact support.'
        );
      }
      if (errorCode === 'auth/network-request-failed') {
        throw createAuthError(
          'auth/network-request-failed',
          'Network error. Please check your internet connection.'
        );
      }
      
      // Generic error
      throw createAuthError(
        'auth/unknown',
        error.message || 'Login failed. Please try again.'
      );
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      firebaseUtils.logEvent('logout');
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw createAuthError(
        'auth/signout-error',
        error.message || 'Failed to sign out'
      );
    }
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
      firebaseUtils.logEvent('password_reset_requested', { email });
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      const errorCode = error.code || '';
      
      if (errorCode === 'auth/user-not-found') {
        throw createAuthError(
          'auth/user-not-found',
          'No account found with this email address'
        );
      }
      
      throw createAuthError(
        'auth/reset-error',
        error.message || 'Failed to send reset email'
      );
    }
  },

  /**
   * Send email verification to current user
   */
  async sendVerificationEmail(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw createAuthError(
          'auth/no-user',
          'No user logged in'
        );
      }
      await sendEmailVerification(user);
    } catch (error: any) {
      console.error('Send verification error:', error);
      throw createAuthError(
        'auth/verification-error',
        error.message || 'Failed to send verification email'
      );
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });

      // Update auth profile if display name or photo changed
      const user = auth.currentUser;
      if (user && (data.displayName || data.photoURL)) {
        await updateProfile(user, {
          displayName: data.displayName || user.displayName,
          photoURL: data.photoURL || user.photoURL,
        });
      }
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw createAuthError(
        'auth/profile-update-error',
        error.message || 'Failed to update profile'
      );
    }
  },

  /**
   * Update user email
   */
  async updateEmail(newEmail: string, password: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw createAuthError(
          'auth/no-user',
          'No user logged in'
        );
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // Update email in Auth
      await updateEmail(user, newEmail);

      // Update email in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        email: newEmail,
        updatedAt: Timestamp.now(),
      });
    } catch (error: any) {
      console.error('Update email error:', error);
      
      if (error.code === 'auth/wrong-password') {
        throw createAuthError(
          'auth/wrong-password',
          'Incorrect password. Please try again.'
        );
      }
      
      throw createAuthError(
        'auth/email-update-error',
        error.message || 'Failed to update email'
      );
    }
  },

  /**
   * Update user password
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw createAuthError(
          'auth/no-user',
          'No user logged in'
        );
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      console.error('Update password error:', error);
      
      if (error.code === 'auth/wrong-password') {
        throw createAuthError(
          'auth/wrong-password',
          'Incorrect password. Please try again.'
        );
      }
      if (error.code === 'auth/weak-password') {
        throw createAuthError(
          'auth/weak-password',
          'Password is too weak. Please use a stronger password.'
        );
      }
      
      throw createAuthError(
        'auth/password-update-error',
        error.message || 'Failed to update password'
      );
    }
  },

  /**
   * Delete user account
   */
  async deleteAccount(password: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw createAuthError(
          'auth/no-user',
          'No user logged in'
        );
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // Delete Firestore data
      await deleteDoc(doc(db, 'users', user.uid));

      // Delete auth user
      await user.delete();
      
      firebaseUtils.logEvent('account_deleted');
    } catch (error: any) {
      console.error('Delete account error:', error);
      
      if (error.code === 'auth/wrong-password') {
        throw createAuthError(
          'auth/wrong-password',
          'Incorrect password. Please try again.'
        );
      }
      
      throw createAuthError(
        'auth/account-delete-error',
        error.message || 'Failed to delete account'
      );
    }
  },

  /**
   * Get user data from Firestore
   */
  async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        return null;
      }
      return userDoc.data() as User;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  },

  /**
   * Get current authenticated user from Firebase Auth
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  /**
   * Observer for authentication state changes
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },
};