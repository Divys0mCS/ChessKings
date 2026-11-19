"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Mode = "signin" | "signup";

function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Passwords need at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled in your Firebase project yet.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return (error as Error)?.message || "Something went wrong. Try again.";
  }
}

export default function LoginPage() {
  const { user, loading, configured, demo, signInWithGoogle, signInWithEmail, signUpWithEmail, enterDemo } =
    useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email" | "guest">(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function run(kind: "google" | "email", action: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await action();
      router.replace("/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signin") {
      void run("email", () => signInWithEmail(email.trim(), password));
    } else {
      void run("email", () => signUpWithEmail(name.trim(), email.trim(), password));
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <section className="relative hidden flex-1 overflow-hidden border-r border-border lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "conic-gradient(var(--board-light) 0 25%, var(--board-dark) 0 50%, var(--board-light) 0 75%, var(--board-dark) 0)",
            backgroundSize: "96px 96px",
            maskImage: "radial-gradient(circle at 30% 35%, black, transparent 72%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-2 text-xl font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand">
              <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="currentColor">
                <path d="M3 8.2 6.6 11l2.2-4.6a3.5 3.5 0 0 1 6.4 0L17.4 11 21 8.2l-1.5 10.1A2 2 0 0 1 17.5 20h-11a2 2 0 0 1-2-1.7L3 8.2Zm6 9.3h6v-1.4H9v1.4Z" />
              </svg>
            </span>
            Chess<span className="-ml-1 text-brand">Kings</span>
          </div>

          <div className="max-w-md animate-rise">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Real-time chess,
              <br />
              <span className="text-brand">server-authoritative.</span>
            </h1>
            <p className="mt-4 text-muted">
              Bullet, blitz and rapid with precise clocks, legal-move validation and a
              60-second reconnect window. Challenge a friend with one link.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted">
              {[
                "Clocks and move legality enforced on the server",
                "Drag-and-drop or click-to-move on any device",
                "Draw offers, resignation and automatic timeout detection",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-brand/15 text-[10px] text-brand">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted/70">Built for players who care about the clock.</p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-8 flex items-center gap-2 text-lg font-semibold lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-brand/15 text-brand">
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
                <path d="M3 8.2 6.6 11l2.2-4.6a3.5 3.5 0 0 1 6.4 0L17.4 11 21 8.2l-1.5 10.1A2 2 0 0 1 17.5 20h-11a2 2 0 0 1-2-1.7L3 8.2Zm6 9.3h6v-1.4H9v1.4Z" />
              </svg>
            </span>
            Chess<span className="-ml-1 text-brand">Kings</span>
          </div>

          {!configured && !demo ? (
            <SetupNotice />
          ) : (
            <div className="rounded-2xl border border-border bg-panel/70 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-7">
              {configured ? (
                <>
                  <div className="mb-6 flex rounded-xl border border-border bg-background/60 p-1">
                    {(["signin", "signup"] as Mode[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setMode(value);
                          setError("");
                        }}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          mode === value
                            ? "bg-panel text-foreground shadow-sm"
                            : "text-muted hover:text-foreground",
                        )}
                      >
                        {value === "signin" ? "Sign in" : "Create account"}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={() => void run("google", signInWithGoogle)}
                    loading={busy === "google"}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                      <path
                        fill="#4285F4"
                        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted/60">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    {mode === "signup" ? (
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Display name
                        </span>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                          maxLength={32}
                          placeholder="Magnus"
                          autoComplete="nickname"
                          className="h-11 w-full rounded-xl border border-border bg-background/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted/50 focus:border-brand/60"
                        />
                      </label>
                    ) : null}
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="h-11 w-full rounded-xl border border-border bg-background/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted/50 focus:border-brand/60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={6}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        placeholder="••••••••"
                        className="h-11 w-full rounded-xl border border-border bg-background/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted/50 focus:border-brand/60"
                      />
                    </label>

                    {error ? (
                      <p
                        role="alert"
                        className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
                      >
                        {error}
                      </p>
                    ) : null}

                    <Button type="submit" size="lg" className="w-full" loading={busy === "email"}>
                      {mode === "signin" ? "Sign in" : "Create account"}
                    </Button>
                  </form>

                  {demo ? (
                    <button
                      type="button"
                      onClick={() => enterDemo("")}
                      className="mt-4 w-full text-center text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Continue as guest (demo mode)
                    </button>
                  ) : null}
                </>
              ) : (
                <GuestSignIn
                  onEnter={(displayName) => {
                    enterDemo(displayName);
                    router.replace("/");
                  }}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function GuestSignIn({ onEnter }: { onEnter: (displayName: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          Demo mode
        </span>
      </div>
      <h2 className="text-xl font-semibold">Jump into a game</h2>
      <p className="mt-1.5 text-sm text-muted">
        Firebase isn&apos;t configured, so you&apos;ll play as a local guest. Games live in
        server memory and disappear when the server restarts.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onEnter(name);
        }}
        className="mt-6 space-y-3"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Display name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            placeholder="Guest"
            autoComplete="nickname"
            className="h-11 w-full rounded-xl border border-border bg-background/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted/50 focus:border-brand/60"
          />
        </label>
        <Button type="submit" size="lg" className="w-full">
          Play as guest
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted">
        To enable real accounts, add your Firebase keys to{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono">.env.local</code>.
      </p>
    </div>
  );
}
