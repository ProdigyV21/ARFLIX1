/*
  # ArFlix Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - User identifier
      - `created_at` (timestamptz) - Account creation timestamp
      - `rd_access_token` (text, encrypted) - Real-Debrid access token
      - `rd_refresh_token` (text, encrypted) - Real-Debrid refresh token
      - `rd_expires_at` (timestamptz) - Token expiration
      - `settings` (jsonb) - User preferences (theme, language, etc.)
    
    - `addons`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key) - Owner of the addon
      - `manifest_url` (text) - Stremio addon manifest URL
      - `name` (text) - Addon name from manifest
      - `description` (text) - Addon description
      - `logo` (text) - Addon logo URL
      - `enabled` (boolean) - Whether addon is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `watch_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `content_id` (text) - Unique content identifier (addon:type:id)
      - `content_type` (text) - movie or series
      - `title` (text)
      - `poster` (text) - Poster image URL
      - `season` (int) - For series
      - `episode` (int) - For series
      - `position` (int) - Playback position in seconds
      - `duration` (int) - Total duration in seconds
      - `last_watched` (timestamptz)
      - `created_at` (timestamptz)
    
    - `sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `token` (text, unique) - Session token
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Restrict Real-Debrid tokens to server-side access only
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  rd_access_token text,
  rd_refresh_token text,
  rd_expires_at timestamptz,
  settings jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create addons table
CREATE TABLE IF NOT EXISTS addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  manifest_url text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  logo text,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_addons_user_enabled ON addons(user_id, enabled);

-- Create watch_history table
CREATE TABLE IF NOT EXISTS watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content_id text NOT NULL,
  content_type text NOT NULL,
  title text NOT NULL,
  poster text,
  season int,
  episode int,
  position int DEFAULT 0,
  duration int DEFAULT 0,
  last_watched timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, content_id)
);

ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched ON watch_history(user_id, last_watched DESC);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- RLS Policies for users
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for addons
CREATE POLICY "Users can view own addons"
  ON addons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addons"
  ON addons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addons"
  ON addons FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addons"
  ON addons FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for watch_history
CREATE POLICY "Users can view own watch history"
  ON watch_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watch history"
  ON watch_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watch history"
  ON watch_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watch history"
  ON watch_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for sessions
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);/*
  # Remove Real-Debrid Fields from Users Table

  1. Changes
    - Remove `rd_access_token` column from users table
    - Remove `rd_refresh_token` column from users table
    - Remove `rd_expires_at` column from users table
  
  2. Notes
    - This migration removes Real-Debrid integration from the database
    - Users will rely on Stremio add-ons for streaming sources
    - No data loss for other user settings
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'rd_access_token'
  ) THEN
    ALTER TABLE users DROP COLUMN rd_access_token;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'rd_refresh_token'
  ) THEN
    ALTER TABLE users DROP COLUMN rd_refresh_token;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'rd_expires_at'
  ) THEN
    ALTER TABLE users DROP COLUMN rd_expires_at;
  END IF;
END $$;/*
  # Update Add-ons Schema

  1. Changes
    - Add addon_id column (manifest.id)
    - Add version column
    - Rename manifest_url to url
    - Rename logo to icon
    - Add order_position column
    - Add last_health column
    - Add last_health_check column
    - Remove description column (not needed)

  2. Notes
    - Uses IF NOT EXISTS checks to avoid errors
    - Preserves existing data where possible
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'addon_id'
  ) THEN
    ALTER TABLE addons ADD COLUMN addon_id text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'version'
  ) THEN
    ALTER TABLE addons ADD COLUMN version text DEFAULT '1.0.0';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'order_position'
  ) THEN
    ALTER TABLE addons ADD COLUMN order_position integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'last_health'
  ) THEN
    ALTER TABLE addons ADD COLUMN last_health text DEFAULT 'ok';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'last_health_check'
  ) THEN
    ALTER TABLE addons ADD COLUMN last_health_check timestamptz DEFAULT now();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'manifest_url'
  ) THEN
    ALTER TABLE addons RENAME COLUMN manifest_url TO url;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'logo'
  ) THEN
    ALTER TABLE addons RENAME COLUMN logo TO icon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'description'
  ) THEN
    ALTER TABLE addons DROP COLUMN description;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_addons_user_url;
CREATE UNIQUE INDEX IF NOT EXISTS idx_addons_user_url ON addons(user_id, url);/*
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
  EXECUTE FUNCTION public.handle_new_user();/*
  # Add ID Prefixes Support to Add-ons

  1. Changes
    - Add `id_prefixes` column to `addons` table to store supported ID formats (IMDB, TMDB, TVDB, etc.)
    - This allows the streams endpoint to intelligently probe add-ons with compatible ID formats
  
  2. Notes
    - Column stores JSON array of strings like ["tt", "tmdb", "tvdb", "anilist", "kitsu"]
    - Defaults to null, which means the system will try common formats (IMDB → TMDB → TVDB)
*/

-- Add id_prefixes column to addons table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addons' AND column_name = 'id_prefixes'
  ) THEN
    ALTER TABLE addons ADD COLUMN id_prefixes jsonb DEFAULT NULL;
  END IF;
END $$;
/*
  # Add Subtitle Preferences

  1. Changes
    - Add preferred_subtitle_language column to users table
    - Add default value 'en' for English

  2. Notes
    - Stores user's preferred subtitle language code (e.g., 'en', 'es', 'fr')
    - Defaults to 'en' (English)
    - Used to auto-select subtitles in player
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_subtitle_language'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_subtitle_language text DEFAULT 'en';
  END IF;
END $$;
/*
  # Add Subtitle Preferences

  1. Changes
    - Add preferred_subtitle_language column to users table
    - Add default value 'en' for English

  2. Notes
    - Stores user's preferred subtitle language code (e.g., 'en', 'es', 'fr')
    - Defaults to 'en' (English)
    - Used to auto-select subtitles in player
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_subtitle_language'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_subtitle_language text DEFAULT 'en';
  END IF;
END $$;
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


-- All migrations combined for easy setup
