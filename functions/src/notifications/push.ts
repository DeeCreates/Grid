// functions/src/notifications/push.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as webpush from 'web-push';

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:notifications@gridsecurity.com',
  functions.config().vapid.public_key,
  functions.config().vapid.private_key
);

// Send push notification to a user
export const sendPushNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, title, body, data: payloadData, ...options } = data;

  try {
    // Get user's FCM tokens
    const tokensSnapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('userId', '==', userId)
      .get();

    if (tokensSnapshot.empty) {
      console.log('No FCM tokens found for user:', userId);
      return { success: false, message: 'No tokens found' };
    }

    const results = [];
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    // Send to all tokens
    for (const token of tokens) {
      try {
        const result = await webpush.sendNotification(
          token,
          JSON.stringify({
            title,
            body,
            icon: options.icon || '/icon-192.png',
            badge: options.badge || '/badge-icon.png',
            data: payloadData || {},
            actions: options.actions || [],
            vibrate: options.vibrate || [200, 100, 200],
            requireInteraction: options.requireInteraction || false,
            silent: options.silent || false,
          })
        );
        results.push({ success: true, token });
      } catch (error) {
        // Remove invalid tokens
        if (error.statusCode === 410 || error.statusCode === 404) {
          await admin.firestore().doc(`fcmTokens/${token}`).delete();
          console.log('Removed invalid token:', token);
        }
        results.push({ success: false, token, error: error.message });
      }
    }

    return {
      success: true,
      results,
      totalTokens: tokens.length,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send push notification');
  }
});

// Trigger: Send notification on incident creation
export const onIncidentCreated = functions.firestore
  .document('incidents/{incidentId}')
  .onCreate(async (snap, context) => {
    const incident = snap.data();
    const { customerId, severity, type, location } = incident;

    // Get customer
    const customerDoc = await admin.firestore().doc(`users/${customerId}`).get();
    const customer = customerDoc.data();

    if (!customer) return;

    // Determine notification priority
    const priority = severity === 'critical' || severity === 'high' ? 'high' : 'medium';

    // Send notification
    await sendPushNotification(customerId, {
      title: `🚨 ${severity.toUpperCase()} - ${type} Detected`,
      body: `Incident at ${location?.address || 'Unknown location'}`,
      data: {
        incidentId: snap.id,
        type: 'incident',
        severity,
        timestamp: new Date().toISOString(),
      },
      requireInteraction: true,
      vibrate: severity === 'critical' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    });

    // Create in-app notification
    await admin.firestore().collection('notifications').add({
      userId: customerId,
      title: `🚨 ${severity.toUpperCase()} - ${type}`,
      body: `Incident at ${location?.address || 'Unknown location'}`,
      category: 'incident',
      priority,
      type: 'alert',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actionUrl: `/incidents/${snap.id}`,
      actionLabel: 'View Incident',
      data: {
        incidentId: snap.id,
        severity,
      },
    });
  });

// Trigger: Send notification on booking confirmation
export const onBookingConfirmed = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;
    if (after.status !== 'confirmed') return;

    const { customerId, customerName, type, scheduledDate, location } = after;

    // Send notification to customer
    await sendPushNotification(customerId, {
      title: `✅ Booking Confirmed - ${type}`,
      body: `Your ${type} booking for ${scheduledDate.toDate().toLocaleString()} has been confirmed.`,
      data: {
        bookingId: context.params.bookingId,
        type: 'booking',
        status: 'confirmed',
      },
    });

    // Create in-app notification
    await admin.firestore().collection('notifications').add({
      userId: customerId,
      title: `✅ Booking Confirmed`,
      body: `Your ${type} booking has been confirmed.`,
      category: 'booking',
      priority: 'medium',
      type: 'success',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actionUrl: `/bookings/${context.params.bookingId}`,
      actionLabel: 'View Booking',
    });
  });

// Trigger: Send notification on service status change
export const onServiceStatusChanged = functions.firestore
  .document('services/{serviceId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;

    const { customerId, name, type, status } = after;

    const statusMessages: Record<string, string> = {
      active: 'Your service is now active',
      suspended: 'Your service has been suspended',
      cancelled: 'Your service has been cancelled',
      completed: 'Your service has been completed',
      pending: 'Your service is pending approval',
    };

    const message = statusMessages[status] || `Service status changed to ${status}`;

    // Send notification
    await sendPushNotification(customerId, {
      title: `📋 Service ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      body: `${name}: ${message}`,
      data: {
        serviceId: context.params.serviceId,
        type: 'service',
        status,
      },
    });

    // Create in-app notification
    await admin.firestore().collection('notifications').add({
      userId: customerId,
      title: `📋 ${type} Service ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      body: `${name} - ${message}`,
      category: 'service',
      priority: 'medium',
      type: 'info',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actionUrl: `/services/${context.params.serviceId}`,
      actionLabel: 'View Service',
    });
  });