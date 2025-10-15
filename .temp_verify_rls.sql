-- Verify RLS is enabled
SELECT 
  relrowsecurity AS rls_enabled,
  'watch_history' AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'watch_history';

-- List all policies
SELECT 
  policyname,
  cmd AS operation,
  roles,
  qual::text AS using_clause,
  with_check::text AS with_check_clause
FROM pg_policies
WHERE schemaname='public' AND tablename='watch_history'
ORDER BY policyname;

