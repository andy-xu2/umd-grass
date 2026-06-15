-- Run once in the Supabase SQL editor to enable the app's live-update MVP.
-- The script is safe to run again: tables already in the publication are skipped.
--
-- Clients use these events only as invalidation signals. After an event, they
-- refetch authoritative data from the existing authenticated API routes.

DO $$
DECLARE
  realtime_table text;
  realtime_tables text[] := ARRAY[
    'matches',
    'season_stats',
    'rr_changes',
    'courts',
    'court_queue_entries'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  FOREACH realtime_table IN ARRAY realtime_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = realtime_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        realtime_table
      );
    END IF;
  END LOOP;
END
$$;
