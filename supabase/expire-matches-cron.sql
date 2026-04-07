-- ============================================================
-- Supabase pg_cron: expire PENDING matches after 7 days
-- ============================================================
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor).
-- pg_cron is pre-installed on all Supabase projects; no extension
-- setup is needed.
--
-- The job runs every hour and flips any PENDING match whose
-- expires_at has passed to EXPIRED.
-- ============================================================

SELECT cron.schedule(
  'expire-pending-matches',   -- job name (unique)
  '0 * * * *',                -- every hour at :00
  $$
    UPDATE matches
    SET status = 'EXPIRED'
    WHERE status = 'PENDING'
      AND expires_at < NOW();
  $$
);

-- ── Verify the job was registered ────────────────────────────
-- SELECT * FROM cron.job WHERE jobname = 'expire-pending-matches';

-- ── To remove the job later ──────────────────────────────────
-- SELECT cron.unschedule('expire-pending-matches');
