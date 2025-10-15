-- Ensure RLS is enabled and minimal owner-only policies exist on public.watch_history
-- This migration is idempotent and safe to re-run.

-- Enable RLS on watch_history (no-op if already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables t
    WHERE t.schemaname = 'public' AND t.tablename = 'watch_history'
  ) THEN
    RAISE NOTICE 'Table public.watch_history does not exist; skipping RLS enable.';
  ELSE
    EXECUTE 'ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Create composite index for common filters (noop if exists)
CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched ON public.watch_history(user_id, last_watched DESC);

-- Helper: create policy if not exists
DO $body$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_history' AND policyname = 'watch_history_select_owner'
  ) THEN
    EXECUTE 'CREATE POLICY "watch_history_select_owner" ON public.watch_history FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_history' AND policyname = 'watch_history_insert_owner'
  ) THEN
    EXECUTE 'CREATE POLICY "watch_history_insert_owner" ON public.watch_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_history' AND policyname = 'watch_history_update_owner'
  ) THEN
    EXECUTE 'CREATE POLICY "watch_history_update_owner" ON public.watch_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watch_history' AND policyname = 'watch_history_delete_owner'
  ) THEN
    EXECUTE 'CREATE POLICY "watch_history_delete_owner" ON public.watch_history FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
END$body$;


