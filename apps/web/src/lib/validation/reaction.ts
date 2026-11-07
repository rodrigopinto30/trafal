import { z } from "zod";

export const REACTION_TARGETS = ["game", "post"] as const;
export const REACTION_KINDS = ["like", "save"] as const;

export type ReactionTarget = (typeof REACTION_TARGETS)[number];
export type ReactionKind = (typeof REACTION_KINDS)[number];

/** What a person asks for: have (or not have) a like or a save on a game or a post. Asking for the same state twice is harmless. */
export const reactionSchema = z.object({
  target: z.enum(REACTION_TARGETS),
  kind: z.enum(REACTION_KINDS),
  id: z.uuid(),
  active: z.boolean(),
});

export type ReactionInput = z.infer<typeof reactionSchema>;
