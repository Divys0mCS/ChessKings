"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase/client";
import {
  clearDemoIdentity,
  createDemoIdentity,
  demoMode,
  demoToken,
  loadDemoIdentity,
} from "@/lib/demo";

export type AppUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  demo: boolean;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  configured: boolean;
  demo: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  enterDemo: (displayName: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fromFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email?.split("@")[0] || "Player",
    email: user.email,
    photoURL: user.photoURL,
    demo: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<AppUser | null>(null);
  userRef.current = user;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (firebaseConfigured) {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
        if (firebaseUser) {
          setUser(fromFirebaseUser(firebaseUser));
        } else {
          const guest = demoMode ? loadDemoIdentity() : null;
          setUser(
            guest
              ? {
                  uid: guest.uid,
                  displayName: guest.displayName,
                  email: null,
                  photoURL: null,
                  demo: true,
                }
              : null,
          );
        }
        setLoading(false);
      });
    } else {
      const guest = demoMode ? loadDemoIdentity() : null;
      if (guest) {
        setUser({
          uid: guest.uid,
          displayName: guest.displayName,
          email: null,
          photoURL: null,
          demo: true,
        });
      }
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signUpWithEmail = useCallback(
    async (displayName: string, email: string, password: string) => {
      const credential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      );
      if (displayName.trim() && credential.user) {
        await updateProfile(credential.user, { displayName: displayName.trim() });
        setUser({
          uid: credential.user.uid,
          displayName: displayName.trim(),
          email: credential.user.email,
          photoURL: credential.user.photoURL,
          demo: false,
        });
      }
    },
    [],
  );

  const signOutUser = useCallback(async () => {
    clearDemoIdentity();
    if (firebaseConfigured) {
      try {
        await signOut(getFirebaseAuth());
      } catch {
        // Already signed out.
      }
    }
    setUser(null);
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    const current = userRef.current;
    if (!current) throw new Error("Not signed in");
    if (current.demo) return demoToken(current);
    const firebaseUser = firebaseConfigured ? getFirebaseAuth().currentUser : null;
    if (!firebaseUser) throw new Error("Not signed in");
    return firebaseUser.getIdToken(forceRefresh);
  }, []);

  const enterDemo = useCallback((displayName: string) => {
    const identity = loadDemoIdentity() ?? createDemoIdentity(displayName);
    setUser({
      uid: identity.uid,
      displayName: identity.displayName,
      email: null,
      photoURL: null,
      demo: true,
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,
      demo: demoMode,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOutUser,
      getIdToken,
      enterDemo,
    }),
    [
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOutUser,
      getIdToken,
      enterDemo,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
