import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export type AdminContext = {
  app: App;
  db: Firestore | null;
};

let context: AdminContext | null = null;

/**
 * Initializes Firebase Admin from either inline service-account JSON
 * (FIREBASE_SERVICE_ACCOUNT) or application default credentials.
 * Returns null when no credentials are available, which is allowed in local
 * development but means game persistence is disabled.
 */
export function initAdmin(): AdminContext | null {
  if (context) return context;

  let app: App;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    try {
      if (raw) {
        const parsed = JSON.parse(raw) as ServiceAccount;
        app = initializeApp({ credential: cert(parsed) });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        app = initializeApp();
      } else {
        return null;
      }
    } catch (error) {
      console.error("[firebase-admin] Failed to initialize:", error);
      return null;
    }
  }

  let db: Firestore | null = null;
  try {
    db = getFirestore(app);
  } catch (error) {
    console.error("[firebase-admin] Firestore unavailable:", error);
  }

  context = { app, db };
  return context;
}

export function getAdminDb(): Firestore | null {
  return initAdmin()?.db ?? null;
}

export function getAdminAuth() {
  const ctx = initAdmin();
  return ctx ? getAuth(ctx.app) : null;
}
