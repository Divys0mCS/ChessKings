export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export type DemoIdentity = {
  uid: string;
  displayName: string;
};

const STORAGE_KEY = "chesskings:demo-identity";

export function loadDemoIdentity(): DemoIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoIdentity>;
    if (!parsed.uid || !parsed.displayName) return null;
    return { uid: parsed.uid, displayName: parsed.displayName };
  } catch {
    return null;
  }
}

export function createDemoIdentity(displayName: string): DemoIdentity {
  const suffix = Math.random().toString(36).slice(2, 8);
  const identity: DemoIdentity = {
    uid: `guest${suffix}`,
    displayName: displayName.trim() || `Guest ${suffix.slice(0, 4)}`,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Storage may be unavailable in private browsing; the in-memory session still works.
  }
  return identity;
}

export function clearDemoIdentity(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

export function demoToken(identity: DemoIdentity): string {
  return `dev:${identity.uid}:${encodeURIComponent(identity.displayName)}`;
}
