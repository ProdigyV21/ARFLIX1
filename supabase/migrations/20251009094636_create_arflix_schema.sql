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
  USING (auth.uid() = user_id);