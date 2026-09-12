import { logger } from '../../lib/logger.js';

interface PushNotificationPayload {
  token?: string;
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

let isInitialized = false;

/**
 * Sends a push notification via Firebase Cloud Messaging (FCM).
 *
 * Adheres to the repo's architectural rule: "wired but inert without credentials".
 * If Firebase credentials (FIREBASE_PROJECT_ID / FIREBASE_SERVICE_ACCOUNT_KEY)
 * are not provided in backend/.env, it gracefully logs and skips without crashing.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey && !process.env.FIREBASE_PROJECT_ID) {
    logger.debug({ payload }, 'FCM push notification skipped: Firebase credentials not set');
    return false;
  }

  try {
    // Dynamic runtime loader to avoid compile-time failure if firebase-admin package is not yet installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin: any = await (new Function('return import("firebase-admin")')().catch(() => null));
    if (!admin) {
      logger.debug('firebase-admin package not installed, skipping push notification');
      return false;
    }

    if (!isInitialized) {
      if (serviceAccountKey) {
        let certObj;
        try {
          certObj = JSON.parse(serviceAccountKey);
        } catch {
          // If it's a file path
          certObj = serviceAccountKey;
        }
        admin.default.initializeApp({
          credential: admin.default.credential.cert(certObj),
        });
      } else {
        admin.default.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }
      isInitialized = true;
    }

    if (payload.token) {
      await admin.default.messaging().send({
        token: payload.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
      logger.info({ token: payload.token, title: payload.title }, 'FCM push notification sent successfully');
      return true;
    } else if (payload.topic) {
      await admin.default.messaging().send({
        topic: payload.topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
      logger.info({ topic: payload.topic, title: payload.title }, 'FCM topic push notification sent successfully');
      return true;
    }

    return false;
  } catch (err) {
    logger.warn({ err }, 'Failed to send FCM push notification');
    return false;
  }
}
