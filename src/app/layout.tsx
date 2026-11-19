import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ChallengesProvider } from "@/components/providers/ChallengesProvider";
import { SocketProvider } from "@/components/providers/SocketProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChessKings — real-time multiplayer chess",
  description:
    "Play fast, server-authoritative chess against friends in real time. Bullet, blitz and rapid with accurate clocks.",
};

export const viewport: Viewport = {
  themeColor: "#0a0d12",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <AuthProvider>
          <SocketProvider>
            <ChallengesProvider>{children}</ChallengesProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
