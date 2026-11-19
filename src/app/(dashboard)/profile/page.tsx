"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getFirestoreDb } from "@/lib/firebase/client";
import {
  doc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  DocumentReference,
  QuerySnapshot,
} from "firebase/firestore";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";


import { FenInput } from '@/components/analysis/FenInput';
import { StockfishAnalysis } from '@/components/analysis/StockfishAnalysis';

import { useRouter } from "next/navigation";




export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fen, setFen] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({
    bullet: 1500,
    blitz: 1500,
    rapid: 1500,
  });
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState<string | null>(null);
  const [newDisplayName, setNewDisplayName] = useState<string>(user?.displayName ?? "");
  const [stats, setStats] = useState<{ wins: number; losses: number; draws: number; games: number }>({ wins: 0, losses: 0, draws: 0, games: 0 });
  const [ratingHistory, setRatingHistory] = useState<{ category: string; rating: number; at: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileDocId, setProfileDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const db = getFirestoreDb();
    if (!db) {
      setError("Firebase not configured.");
      setLoading(false);
      return;
    }

    // Document reference for the user's profile
    const profileRef = doc(db, "users", user.uid, "profile");
    const profileColRef = collection(db, "users", user.uid, "profile");
    const q = query(profileColRef, orderBy("lastUpdated", "desc"));

    // Listen to user profile doc for ratings + stats + history
    const unsub = onSnapshot(q, (snapshot: QuerySnapshot) => {
      if (snapshot.docs.length === 0) {
        setRatings({ bullet: 1500, blitz: 1500, rapid: 1500 });
        setStats({ wins: 0, losses: 0, draws: 0, games: 0 });
        setRatingHistory([]);
        setProfileDocId(null);
        setLoading(false);
        return;
      }

      const data = snapshot.docs[0].data();
      setRatings({
        bullet: data?.ratings?.bullet ?? 1500,
        blitz: data?.ratings?.blitz ?? 1500,
        rapid: data?.ratings?.rapid ?? 1500,
      });
      const wins = data?.stats?.wins ?? 0;
      const losses = data?.stats?.losses ?? 0;
      const draws = data?.stats?.draws ?? 0;
      const games = wins + losses + draws;
      setStats({ wins, losses, draws, games });

      // Rating history: last 10 rating changes, newest first
      const history = (data?.ratingHistory ?? [])
        .sort((a: any, b: any) => b.at - a.at)
        .slice(0, 10)
        .map((h: any) => ({
          category: h.category,
          rating: h.rating,
          at: h.at,
        }));
      setRatingHistory(history);
      setProfileDocId(snapshot.docs[0].id);
      setLoading(false);
    }, (err) => {
      console.error("[profile] Firestore listen error:", err);
      setError("Failed to load profile data.");
      setLoading(false);
    });

    // Update display name in Firestore when it changes
    useEffect(() => {
      if (!newDisplayName.trim() || user?.displayName === newDisplayName.trim()) return;
      setRenameError(null);
      setRenameSuccess(null);
      if (profileDocId) {
        const docRef = doc(db, "users", user.uid, "profile", profileDocId);
        updateDoc(docRef, { displayName: newDisplayName.trim(), lastUpdated: new Date() })
          .then(() => {
            setRenameSuccess("Display name updated.");
            setNewDisplayName("");
          })
          .catch(() => {
            setRenameError("Failed to update display name.");
          });
      }
    }, [newDisplayName, user?.uid, profileDocId]);

    return () => unsub();
  }, [user?.uid]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-border bg-panel/80 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="size-20 rounded-full bg-border/50 flex items-center justify-center text-muted">
                {user.displayName?.[0] ?? "?"}
              </div>
              <div>
                <p className="text-xl font-semibold">{user.displayName ?? "Player"}</p>
                <p className="text-sm text-muted">Member since</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                ← Back to Dashboard
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Ratings per category */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">
                Ratings by time control
              </p>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {[{ id: "bullet", label: "Bullet" }, { id: "blitz", label: "Blitz" }, { id: "rapid", label: "Rapid" }].map((cat) => (
                  <div key={cat.id} className="p-2 text-center rounded border border-border">
                    <p className="text-xs uppercase tracking-[0.1em] text-muted">{cat.label}</p>
                    <p className="text-3xl font-mono font-bold">{ratings[cat.id]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Game stats */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">
                Game history
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2 rounded border border-border text-center">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted">Wins</p>
                  <p className="text-2xl font-mono font-bold">{stats.wins}</p>
                </div>
                <div className="p-2 rounded border border-border text-center">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted">Losses</p>
                  <p className="text-2xl font-mono font-bold">{stats.losses}</p>
                </div>
                <div className="p-2 rounded border border-border text-center">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted">Draws</p>
                  <p className="text-2xl font-mono font-bold">{stats.draws}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                Total games: {stats.games}
              </p>
            </div>

            {/* Analysis view */
            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">
                Position Analysis
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FenInput
                    onFenChange={setFen}
                    initialFen={fen}
                  />
                </div>
                <div>
                  <StockfishAnalysis fen={fen} />
                </div>
              </div>
            </div>

            /* Rating history chart */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">
                Rating history
              </p>
              {ratingHistory.length > 0 ? (
                <div className="space-y-2">
                  {ratingHistory.map((entry, idx) => (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between rounded border border-border p-2 text-xs"
                    >
                      <span>
                        {entry.category}: {entry.rating}
                      </span>
                      <span className="text-muted">
                        {new Date(entry.at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">
                  No rating history yet. Play rated games to build your rating trail.
                </p>
              )}
            </div>

            {/* Rename display name section */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">
                Display name
              </p>
              {user?.demo ? (
                <p className="mt-2 text-xs text-muted">
                  Demo mode: name is set once when joining
                </p>
              ) : (
                <div className="mt-3 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-muted">Current:</span>
                    <span className="font-medium text-foreground">{user.displayName ?? "Player"}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="flex-1 rounded border border-border px-3 py-2 text-muted"
                      disabled={renameError != null || renameSuccess != null}
                      placeholder="New display name"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        if (!newDisplayName.trim() || renameError != null || renameSuccess != null) return;
                        setRenameError(null);
                        setRenameSuccess(null);
                        try {
                          const db = getFirestoreDb();
                          if (db && profileDocId) {
                            const docRef = doc(db, "users", user.uid, "profile", profileDocId);
                            await updateDoc(docRef, { displayName: newDisplayName.trim(), lastUpdated: new Date() });
                            setRenameSuccess("Display name updated.");
                            setNewDisplayName("");
                          }
                        } catch {
                          setRenameError("Failed to update display name.");
                        }
                      }}
                    >
                      Rename
                    </Button>
                  </div>
                  {renameError && (
                    <p className="mt-2 text-sm text-danger">{renameError}</p>
                  )}
                  {renameSuccess && (
                    <p className="mt-2 text-sm text-success">{renameSuccess}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}