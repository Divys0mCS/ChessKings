import { z } from "zod";

export const gameModeSchema = z.enum(["rated", "casual"]);

export const timeControlSchema = z.object({
  initialSec: z.number().int().min(30).max(10_800),
  incrementSec: z.number().int().min(0).max(180),
});

export const gameIdSchema = z
  .string()
  .trim()
  .min(6)
  .max(64)
  .regex(/^[a-z0-9]+$/, "Invalid game id");

const squareSchema = z.string().regex(/^[a-h][1-8]$/, "Invalid square");

export const createGameSchema = z.object({
  timeControl: timeControlSchema,
  mode: gameModeSchema,
});

export const joinGameSchema = z.object({
  gameId: gameIdSchema,
});

export const moveSchema = z.object({
  gameId: gameIdSchema,
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).nullish(),
});

export const gameActionSchema = z.object({
  gameId: gameIdSchema,
});

export const findMatchSchema = z.object({
  timeControl: timeControlSchema,
  mode: gameModeSchema,
});

export const challengeColorSchema = z.enum(["white", "black", "random"]);

export const challengeCreateSchema = z.object({
  toUid: z.string().trim().min(1).max(128),
  timeControl: timeControlSchema,
  mode: gameModeSchema,
  color: challengeColorSchema,
});

export const challengeActionSchema = z.object({
  challengeId: z.string().trim().min(6).max(64),
});

export const emptyPayloadSchema = z.object({});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type GameActionInput = z.infer<typeof gameActionSchema>;
export type FindMatchInput = z.infer<typeof findMatchSchema>;
export type ChallengeCreateInput = z.infer<typeof challengeCreateSchema>;
export type ChallengeActionInput = z.infer<typeof challengeActionSchema>;
