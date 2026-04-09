-- Remove the hidden MMR and isRevealed columns now that RR is always public.
-- Season decay is now 2 ranks (RR - 1000, floor 0; capped at 1500 if > 2500).

ALTER TABLE "season_stats" DROP COLUMN IF EXISTS "hidden_mmr";
ALTER TABLE "season_stats" DROP COLUMN IF EXISTS "is_revealed";
