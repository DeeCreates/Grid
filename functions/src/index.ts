/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// ==================== ROLE SYNC FUNCTIONS ====================

/**
 * Sync user role from Firestore to Firebase Authentication custom claims
 * Triggered when a user document is created
 */
export const syncUserRoleOnCreate = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();

    if (!userData) {
      logger.warn(`No data found for user: ${userId}`);
      return;
    }

    const role = userData.role;
    if (!role) {
      logger.warn(`No role found for user: ${userId}`);
      return;
    }

    try {
      await admin.auth().setCustomUserClaims(userId, { role });
      logger.info(`✅ Synced role "${role}" for new user: ${userId}`);
    } catch (error) {
      logger.error(`❌ Failed to sync role for user: ${userId}`, error);
    }
  }
);

/**
 * Sync user role from Firestore to Firebase Authentication custom claims
 * Triggered when a user document is updated
 */
export const syncUserRoleOnUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!afterData) {
      logger.warn(`No data found for user: ${userId}`);
      return;
    }

    const newRole = afterData.role;
    const oldRole = beforeData?.role;

    // Only update if role has changed
    if (newRole === oldRole) {
      logger.info(`Role unchanged for user: ${userId} (${newRole})`);
      return;
    }

    if (!newRole) {
      logger.warn(`No role found for user: ${userId}, skipping update`);
      return;
    }

    try {
      await admin.auth().setCustomUserClaims(userId, { role: newRole });
      logger.info(`✅ Updated role for user: ${userId} from "${oldRole}" to "${newRole}"`);
    } catch (error) {
      logger.error(`❌ Failed to update role for user: ${userId}`, error);
    }
  }
);

/**
 * Delete user custom claims when user document is deleted
 */
export const deleteUserClaimsOnDelete = onDocumentDeleted(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;

    try {
      await admin.auth().setCustomUserClaims(userId, null);
      logger.info(`✅ Cleared custom claims for deleted user: ${userId}`);
    } catch (error) {
      logger.error(`❌ Failed to clear claims for user: ${userId}`, error);
    }
  }
);

// ==================== ADMIN UTILITY FUNCTIONS ====================

/**
 * HTTP endpoint to manually set a user's role
 * Example: POST /setUserRole with body: { "email": "user@example.com", "role": "admin" }
 * This is useful for testing or manual role assignments
 */
export const setUserRole = onRequest(
  { cors: true, maxInstances: 5 },
  async (request, response) => {
    // Basic security - check for an API key or use Firebase Auth
    // For production, add proper authentication
    const apiKey = request.headers["x-api-key"];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { email, role } = request.body;

    if (!email || !role) {
      response.status(400).json({ 
        error: "Missing required fields: email and role" 
      });
      return;
    }

    // Validate role
    const validRoles = ["admin", "technician", "guard", "customer", "partner", "sales"];
    if (!validRoles.includes(role)) {
      response.status(400).json({ 
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}` 
      });
      return;
    }

    try {
      // Get user by email
      const user = await admin.auth().getUserByEmail(email);
      
      // Set custom claims
      await admin.auth().setCustomUserClaims(user.uid, { role });
      
      // Update or create user document in Firestore
      const db = admin.firestore();
      await db.collection("users").doc(user.uid).set({
        email: email,
        role: role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      logger.info(`✅ Manually set role "${role}" for user: ${email}`);
      
      response.status(200).json({
        success: true,
        message: `Role "${role}" assigned to ${email}`,
        user: {
          uid: user.uid,
          email: user.email,
          role: role
        }
      });
    } catch (error: any) {
      logger.error(`❌ Failed to set role for user: ${email}`, error);
      response.status(500).json({
        error: error.message || "Failed to set user role"
      });
    }
  }
);

/**
 * HTTP endpoint to get a user's role
 * Example: GET /getUserRole?email=user@example.com
 */
export const getUserRole = onRequest(
  { cors: true, maxInstances: 5 },
  async (request, response) => {
    // Basic security - check for an API key or use Firebase Auth
    const apiKey = request.headers["x-api-key"];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const email = request.query.email as string;

    if (!email) {
      response.status(400).json({ 
        error: "Missing required query parameter: email" 
      });
      return;
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      
      // Get custom claims
      const claims = user.customClaims || {};
      const role = claims.role || null;

      // Also get from Firestore
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(user.uid).get();
      const firestoreData = userDoc.exists ? userDoc.data() : null;

      response.status(200).json({
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          role: role,
          firestoreRole: firestoreData?.role || null
        }
      });
    } catch (error: any) {
      logger.error(`❌ Failed to get user role for: ${email}`, error);
      response.status(500).json({
        error: error.message || "Failed to get user role"
      });
    }
  }
);

/**
 * HTTP endpoint to sync ALL users' roles from Firestore to Authentication
 * Use this to fix any inconsistencies
 */
export const syncAllUserRoles = onRequest(
  { cors: true, maxInstances: 3, timeoutSeconds: 300 },
  async (request, response) => {
    // Basic security - check for an API key or use Firebase Auth
    const apiKey = request.headers["x-api-key"];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const db = admin.firestore();
      
      // Get all users from Firestore
      const usersSnapshot = await db.collection("users").get();
      
      if (usersSnapshot.empty) {
        response.status(200).json({
          success: true,
          message: "No users found to sync",
          synced: 0
        });
        return;
      }

      let syncedCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      // Process each user
      for (const doc of usersSnapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        const role = userData.role;

        if (!role) {
          logger.warn(`No role found for user: ${userId}, skipping`);
          errorCount++;
          errors.push({ userId, error: "No role found" });
          continue;
        }

        try {
          await admin.auth().setCustomUserClaims(userId, { role });
          syncedCount++;
          logger.info(`✅ Synced role "${role}" for user: ${userId}`);
        } catch (error: any) {
          errorCount++;
          errors.push({ 
            userId, 
            error: error.message || "Unknown error" 
          });
          logger.error(`❌ Failed to sync role for user: ${userId}`, error);
        }
      }

      response.status(200).json({
        success: true,
        message: `Synced ${syncedCount} users, ${errorCount} errors`,
        stats: {
          total: usersSnapshot.size,
          synced: syncedCount,
          errors: errorCount
        },
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      logger.error("❌ Failed to sync all user roles", error);
      response.status(500).json({
        error: error.message || "Failed to sync all user roles"
      });
    }
  }
);

// ==================== SAMPLE FUNCTION (Keep for reference) ====================

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });