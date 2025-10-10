/*
  # Auto-create user record on signup

  1. Changes
    - Create a trigger function to automatically create a user record when someone signs up
    - This ensures the foreign key constraint on addons.user_id is satisfied

  2. Notes
    - Runs on INSERT to auth.users
    - Creates corresponding record in public.users
    - Prevents foreign key violations
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, created_at)
  VALUES (NEW.id, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();