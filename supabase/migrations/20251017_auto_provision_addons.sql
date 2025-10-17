-- Auto-provision addons for new users by copying from anonymous user
-- This trigger ensures every new user immediately gets the default Torrentio+Torbox addon

CREATE OR REPLACE FUNCTION auto_provision_user_addons()
RETURNS TRIGGER AS $$
DECLARE
  anon_user_id uuid := '00000000-0000-0000-0000-000000000000';
  addon_record RECORD;
BEGIN
  -- Only run for non-anonymous users
  IF NEW.id != anon_user_id THEN
    -- Copy all enabled addons from anonymous user to the new user
    FOR addon_record IN 
      SELECT addon_id, name, version, url, icon, order_position, last_health, id_prefixes
      FROM addons
      WHERE user_id = anon_user_id
      AND enabled = true
    LOOP
      INSERT INTO addons (
        user_id,
        addon_id,
        name,
        version,
        url,
        icon,
        enabled,
        order_position,
        last_health,
        id_prefixes,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        addon_record.addon_id,
        addon_record.name,
        addon_record.version,
        addon_record.url,
        addon_record.icon,
        true,
        addon_record.order_position,
        addon_record.last_health,
        addon_record.id_prefixes,
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Auto-provisioned addons for user: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after a new user is inserted
DROP TRIGGER IF EXISTS trigger_auto_provision_addons ON users;
CREATE TRIGGER trigger_auto_provision_addons
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_provision_user_addons();

-- Also provision addons for existing users who don't have any yet
DO $$
DECLARE
  user_record RECORD;
  anon_user_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  FOR user_record IN 
    SELECT DISTINCT u.id
    FROM users u
    LEFT JOIN addons a ON u.id = a.user_id
    WHERE u.id != anon_user_id
    AND a.id IS NULL
  LOOP
    -- Call the function for each user without addons
    PERFORM auto_provision_user_addons() FROM users WHERE id = user_record.id;
    
    -- Manually copy addons (since trigger won't fire for existing rows)
    INSERT INTO addons (
      user_id,
      addon_id,
      name,
      version,
      url,
      icon,
      enabled,
      order_position,
      last_health,
      id_prefixes,
      created_at,
      updated_at
    )
    SELECT 
      user_record.id,
      addon_id,
      name,
      version,
      url,
      icon,
      true,
      order_position,
      last_health,
      id_prefixes,
      NOW(),
      NOW()
    FROM addons
    WHERE user_id = anon_user_id
    AND enabled = true
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Provisioned addons for existing user: %', user_record.id;
  END LOOP;
END $$;

COMMENT ON FUNCTION auto_provision_user_addons() IS 
  'Automatically copies enabled addons from anonymous user to new users upon account creation';
