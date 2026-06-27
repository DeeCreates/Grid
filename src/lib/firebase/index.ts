// src/lib/firebase/index.ts
// Re-export everything from config
export {
  app,
  auth,
  db,
  storage,
  functions,
  analytics,
  performance,
  messaging,
  firebaseUtils,
  performanceUtils,
  errorUtils,
} from './config';

// Export types
export type {
  FirebaseApp,
  Auth,
  Firestore,
  FirebaseStorage,
  Functions,
  Analytics,
  Messaging,
  User,
} from 'firebase/app';

// Default export
export { default } from './config';