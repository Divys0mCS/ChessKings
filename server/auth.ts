import "./env";
import { getAdminAuth, initAdmin } from "../src/lib/firebase/admin";
import type { AuthUser } from "../src/shared/events";

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

initAdmin();

/**
 * Dev-only auth bypass. It is hard-disabled in production and must be opted
 * into with ALLOW_DEV_AUTH=1. Tokens take the form `dev:<uid>:<displayName>`.
 */
export const devAuthEnabled =
  process.env.ALLOW_DEV_AUTH === "1" && process.env.NODE_ENV !== "production";

export async function verifyToken(token: string): Promise<AuthUser> {
  if (!token) throw new AuthError("unauthorized", "Please sign in.");

  if (devAuthEnabled && token.startsWith("dev:")) {
    const [, uid, rawName] = token.split(":");
    if (!uid) throw new AuthError("unauthorized", "Malformed development token.");
    const displayName = rawName ? decodeURIComponent(rawName) : "Guest";
    return { uid, displayName };
  }

  const auth = getAdminAuth();
  if (!auth) {
    throw new AuthError(
      "server_not_configured",
      "The game server has no Firebase Admin credentials configured.",
    );
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const displayName =
      decoded.name || decoded.email?.split("@")[0] || "Player";
    return { uid: decoded.uid, displayName };
  } catch {
    throw new AuthError("unauthorized", "Session expired. Please sign in again.");
  }
}
