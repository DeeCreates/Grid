// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  setPersistence, 
  browserLocalPersistence,
  Auth,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  Firestore,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { 
  getStorage, 
  connectStorageEmulator, 
  FirebaseStorage 
} from 'firebase/storage';
import { 
  getFunctions, 
  connectFunctionsEmulator, 
  Functions 
} from 'firebase/functions';
import { 
  getMessaging, 
  getToken, 
  onMessage, 
  deleteToken,
  Messaging,
  isSupported as isMessagingSupported 
} from 'firebase/messaging';
import { 
  getAnalytics, 
  logEvent, 
  setUserId, 
  setUserProperties,
  isSupported as isAnalyticsSupported,
  Analytics 
} from 'firebase/analytics';
import { 
  getPerformance, 
  trace 
} from 'firebase/performance';

// ==================== Environment Validation ====================
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

if (import.meta.env.PROD) {
  const missingVars = requiredEnvVars.filter(
    (key) => !import.meta.env[key]
  );
  if (missingVars.length > 0) {
    console.warn(
      `Missing Firebase environment variables: ${missingVars.join(', ')}`
    );
  }
}

// ==================== Firebase Configuration ====================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// ==================== App Initialization ====================
let firebaseApp: FirebaseApp;

try {
  firebaseApp = getApp();
} catch {
  firebaseApp = initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized');
}

// ==================== Export App ====================
export const app = firebaseApp;

// ==================== Initialize Services ====================
export const auth: Auth = getAuth(app);
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
});
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'europe-west1');

// ==================== Analytics ====================
let analyticsInstance: Analytics | null = null;
let performanceInstance: any = null;
let messagingInstance: Messaging | null = null;

// Initialize analytics
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analyticsInstance = getAnalytics(app);
        console.log('📊 Analytics initialized');
        
        if (import.meta.env.PROD) {
          setUserProperties(analyticsInstance, {
            app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
            environment: import.meta.env.MODE,
          });
          logEvent(analyticsInstance, 'app_loaded');
        }
      }
    })
    .catch((err) => {
      console.warn('⚠️ Analytics not supported:', err);
    });

  // Performance
  try {
    performanceInstance = getPerformance(app);
    console.log('🚀 Performance monitoring initialized');
  } catch (err) {
    console.warn('⚠️ Performance monitoring not supported:', err);
  }

  // Messaging
  isMessagingSupported()
    .then((supported) => {
      if (supported) {
        messagingInstance = getMessaging(app);
        console.log('📨 Messaging initialized');
      }
    })
    .catch((err) => {
      console.warn('⚠️ Messaging not supported:', err);
    });
}

// ==================== Export Services ====================
export const analytics = analyticsInstance;
export const performance = performanceInstance;
export const messaging = messagingInstance;

// ==================== Offline Persistence ====================
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log('💾 Firestore multi-tab persistence enabled');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open, persistence in single tab mode');
        enableIndexedDbPersistence(db).catch((e) => {
          console.warn('⚠️ Could not enable persistence:', e);
        });
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser doesn\'t support persistence');
      } else {
        console.warn('⚠️ Persistence error:', err);
      }
    });
}

// ==================== Emulator Configuration ====================
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('🔥 Firebase emulators connected');
  } catch (err) {
    console.warn('⚠️ Error connecting to emulators:', err);
  }
}

// ==================== Development Helpers ====================
if (import.meta.env.DEV) {
  (window as any).__FIREBASE = {
    app,
    auth,
    db,
    storage,
    functions,
    analytics: analyticsInstance,
    performance: performanceInstance,
    messaging: messagingInstance,
  };
  console.log('🐞 Firebase debug tools available: window.__FIREBASE');
}

// ==================== Utility Functions ====================
export const firebaseUtils = {
  logEvent: (eventName: string, params?: Record<string, any>) => {
    if (analyticsInstance && import.meta.env.PROD) {
      try {
        logEvent(analyticsInstance, eventName, params);
      } catch (err) {
        console.warn('⚠️ Failed to log event:', err);
      }
    }
  },

  setUserId: (uid: string) => {
    if (analyticsInstance) {
      try {
        setUserId(analyticsInstance, uid);
      } catch (err) {
        console.warn('⚠️ Failed to set user ID:', err);
      }
    }
  },

  setUserProperties: (properties: Record<string, any>) => {
    if (analyticsInstance) {
      try {
        setUserProperties(analyticsInstance, properties);
      } catch (err) {
        console.warn('⚠️ Failed to set user properties:', err);
      }
    }
  },

  requestNotificationPermission: async (): Promise<string | null> => {
    if (!messagingInstance) {
      console.warn('⚠️ Messaging not available');
      return null;
    }

    try {
      if (Notification.permission === 'granted') {
        const token = await getToken(messagingInstance, {
          vapidKey: import.meta.env.VITE_VAPID_KEY,
        });
        if (token) {
          console.log('📨 Existing notification token:', token);
          return token;
        }
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messagingInstance, {
          vapidKey: import.meta.env.VITE_VAPID_KEY,
        });
        if (token) {
          console.log('📨 New notification token:', token);
          return token;
        }
      } else {
        console.warn('⚠️ Notification permission denied');
      }
    } catch (err) {
      console.error('❌ Notification permission error:', err);
    }
    return null;
  },

  deleteNotificationToken: async (): Promise<void> => {
    if (!messagingInstance) return;
    try {
      await deleteToken(messagingInstance);
      console.log('📨 Notification token deleted');
    } catch (err) {
      console.error('❌ Failed to delete token:', err);
    }
  },

  onMessage: (callback: (payload: any) => void) => {
    if (messagingInstance) {
      return onMessage(messagingInstance, callback);
    }
    return () => {};
  },

  startTrace: (name: string) => {
    if (performanceInstance) {
      return trace(performanceInstance, name);
    }
    return null;
  },

  getApp: () => app,
  isInitialized: () => !!app,
  getAuth: () => auth,
  getFirestore: () => db,
  getStorage: () => storage,
  getFunctions: () => functions,
  getAnalytics: () => analyticsInstance,
  getPerformance: () => performanceInstance,
  getMessaging: () => messagingInstance,
};

// ==================== Performance Utils ====================
export const performanceUtils = {
  traceFunction: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const traceInstance = performanceInstance ? trace(performanceInstance, name) : null;
    traceInstance?.start();
    try {
      const result = await fn();
      traceInstance?.stop();
      return result;
    } catch (error) {
      traceInstance?.stop();
      throw error;
    }
  },

  traceRender: (componentName: string) => {
    if (performanceInstance) {
      const traceInstance = trace(performanceInstance, `render_${componentName}`);
      traceInstance.start();
      return () => traceInstance.stop();
    }
    return () => {};
  },
};

// ==================== Error Utils ====================
export const errorUtils = {
  logError: (error: Error, context?: Record<string, any>) => {
    console.error('❌ Error:', error, context);
    
    if (analyticsInstance && import.meta.env.PROD) {
      try {
        logEvent(analyticsInstance, 'error', {
          error_message: error.message,
          error_stack: error.stack,
          error_name: error.name,
          ...context,
        });
      } catch (err) {
        console.warn('⚠️ Failed to log error to analytics:', err);
      }
    }
  },

  logWarning: (message: string, context?: Record<string, any>) => {
    console.warn('⚠️ Warning:', message, context);
    
    if (analyticsInstance && import.meta.env.PROD) {
      try {
        logEvent(analyticsInstance, 'warning', {
          warning_message: message,
          ...context,
        });
      } catch (err) {
        console.warn('⚠️ Failed to log warning to analytics:', err);
      }
    }
  },
};

// ==================== Default Export ====================
export default {
  app,
  auth,
  db,
  storage,
  functions,
  analytics: analyticsInstance,
  performance: performanceInstance,
  messaging: messagingInstance,
  firebaseUtils,
  performanceUtils,
  errorUtils,
};

console.log('✅ Firebase configuration loaded successfully');

// ==================== Type Exports ====================
export type { 
  FirebaseApp,
  Auth,
  Firestore,
  FirebaseStorage,
  Functions,
  Analytics,
  Messaging,
  User,
};