/*
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
END $$;