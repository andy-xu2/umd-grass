ALTER TABLE "season_stats" ADD COLUMN "starting_rr" integer;
--> statement-breakpoint
UPDATE "season_stats" AS stats
SET "starting_rr" = COALESCE(
  (
    SELECT changes."rr_before"
    FROM "rr_changes" AS changes
    INNER JOIN "matches" AS match ON match."id" = changes."match_id"
    WHERE changes."user_id" = stats."user_id"
      AND changes."season_id" = stats."season_id"
    ORDER BY match."played_at", match."submitted_at", match."id"
    LIMIT 1
  ),
  CASE WHEN stats."games_played" = 0 THEN stats."rr" ELSE 800 END
);
--> statement-breakpoint
ALTER TABLE "season_stats" ALTER COLUMN "starting_rr" SET DEFAULT 800;
--> statement-breakpoint
ALTER TABLE "season_stats" ALTER COLUMN "starting_rr" SET NOT NULL;
