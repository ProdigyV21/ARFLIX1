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
