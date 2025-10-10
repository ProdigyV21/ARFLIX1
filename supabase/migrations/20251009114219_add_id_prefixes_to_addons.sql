/*
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
