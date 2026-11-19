import { LobbyView } from "@/components/lobby/LobbyView";

// The lobby is an auth-gated client view, so it may block during navigation.
export const instant = false;

export default function LobbyPage() {
  return <LobbyView />;
}
