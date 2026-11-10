-- Row Level Security for the browser's direct Supabase access.
-- Run in the Supabase SQL editor. Safe to run again.
--
-- The app's API routes use Drizzle over DATABASE_URL, which bypasses RLS, so
-- these rules only affect requests made with the public anon key:
--   * components/navbar.tsx reads the signed-in user's own `users` row.
--   * hooks/use-realtime-refresh.ts listens for changes on the five tables in
--     supabase/realtime-publication.sql. Realtime only delivers events for rows
--     the user may SELECT. Events are refresh signals; data is refetched via API.
-- Logged-out visitors get no access, so the public home page refreshes on reload.
-- No INSERT/UPDATE/DELETE policies: all writes go through API routes.

-- Every app table: deny anon-key access unless a policy below allows it.
ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_stats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_changes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_queue_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_pools         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_playoff_games ENABLE ROW LEVEL SECURITY;

-- Navbar: a signed-in user can read only their own profile row (keeps other emails private).
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Realtime: signed-in users can read the live-update tables.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['matches', 'season_stats', 'rr_changes', 'courts', 'court_queue_entries']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_select_authenticated', t
    );
  END LOOP;
END
$$;
