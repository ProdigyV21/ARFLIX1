/*
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_addons_user_url ON addons(user_id, url);