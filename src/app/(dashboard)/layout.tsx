import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { SiteHeader } from "@/components/SiteHeader";

// The dashboard is an auth-gated client shell, so Next's instant-navigation
// validation cannot prerender it meaningfully.
export const instant = false;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </AuthGate>
  );
}
