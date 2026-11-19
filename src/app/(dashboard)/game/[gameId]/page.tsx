import { GameRoom } from "@/components/game/GameRoom";

// The game room is an interactive client shell and may block during navigation.
export const instant = false;

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return <GameRoom gameId={gameId} />;
}