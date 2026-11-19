const CLIENT_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

export function SetupNotice() {
  return (
    <div className="w-full rounded-2xl border border-border bg-panel/80 p-6 text-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-2 rounded-full bg-amber-400" />
        <h2 className="font-semibold text-foreground">Firebase isn&apos;t configured yet</h2>
      </div>
      <p className="text-muted">
        Authentication and game persistence use Firebase. Add the following to{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">.env.local</code>{" "}
        and restart the dev servers:
      </p>
      <ul className="mt-3 grid gap-1 font-mono text-xs text-muted sm:grid-cols-2">
        {CLIENT_VARS.map((name) => (
          <li key={name} className="rounded bg-black/30 px-2 py-1">
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-muted">
        The Socket.IO process also needs{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
          FIREBASE_SERVICE_ACCOUNT
        </code>{" "}
        (service-account JSON on one line) to verify ID tokens and save games.
      </p>
      <p className="mt-4 rounded-xl border border-brand/25 bg-brand/10 px-3 py-2 text-xs text-brand">
        Want to try the app first? Run{" "}
        <code className="font-mono">npm run dev:demo</code> — it starts a local guest
        session with in-memory games, no Firebase needed.
      </p>
    </div>
  );
}
