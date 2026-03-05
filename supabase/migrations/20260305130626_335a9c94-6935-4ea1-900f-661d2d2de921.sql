
-- Temporarily disable FK checks for this transaction
SET session_replication_role = 'replica';

-- Delete all related data from every table that references profiles
DO $$
DECLARE
  pids uuid[] := ARRAY[
    '06812bbb-212e-4b4c-b4f2-2fc16f9094c5',
    '0d2ea0c3-db0f-491e-993a-8cd27e2f35ed',
    '2d91d20a-1e52-4f50-ad4e-e912a8fb4609',
    '4d62bceb-4c6e-47b5-bb62-7effd9b1ecf1',
    '51514314-a378-41a8-b5ba-5f2c7c29dac1',
    '5273fa36-6729-4c66-b2d4-62eebd313afe',
    '5968c470-b7a8-4c53-90cd-68a2b726f5bb',
    '5aa7455f-2d24-4ab0-ba50-2d9bf50a95a5'
  ];
  fids uuid[];
  tc_ids uuid[];
  fi_ids uuid[];
  spa_ids uuid[];
  sr_ids uuid[];
  v_ids uuid[];
  r record;
BEGIN
  -- Collect intermediate table IDs
  SELECT array_agg(id) INTO fids FROM freights WHERE prospect_user_id = ANY(pids) OR driver_id = ANY(pids);
  SELECT array_agg(id) INTO tc_ids FROM transport_companies WHERE profile_id = ANY(pids);
  SELECT array_agg(id) INTO fi_ids FROM fiscal_issuers WHERE profile_id = ANY(pids);
  SELECT array_agg(id) INTO spa_ids FROM service_provider_areas WHERE provider_id = ANY(pids);
  SELECT array_agg(id) INTO sr_ids FROM service_requests WHERE provider_id = ANY(pids) OR client_id = ANY(pids);
  SELECT array_agg(id) INTO v_ids FROM vehicles WHERE driver_id = ANY(pids) OR assigned_driver_id = ANY(pids);

  -- Delete from ALL referencing tables dynamically
  -- service_matches (references service_provider_areas)
  IF spa_ids IS NOT NULL THEN
    DELETE FROM service_matches WHERE provider_area_id = ANY(spa_ids);
  END IF;

  -- service_request children
  IF sr_ids IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.confrelid = 'public.service_requests'::regclass AND c.contype = 'f'
    LOOP
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING sr_ids;
    END LOOP;
    DELETE FROM service_requests WHERE id = ANY(sr_ids);
  END IF;

  -- vehicle children
  IF v_ids IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.confrelid = 'public.vehicles'::regclass AND c.contype = 'f'
    LOOP
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING v_ids;
    END LOOP;
    DELETE FROM vehicles WHERE id = ANY(v_ids);
  END IF;

  -- fiscal_issuers children
  IF fi_ids IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.confrelid = 'public.fiscal_issuers'::regclass AND c.contype = 'f'
    LOOP
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING fi_ids;
    END LOOP;
  END IF;

  -- freight children
  IF fids IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.confrelid = 'public.freights'::regclass AND c.contype = 'f'
    LOOP
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING fids;
    END LOOP;
  END IF;

  -- transport_companies children
  IF tc_ids IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.confrelid = 'public.transport_companies'::regclass AND c.contype = 'f'
    LOOP
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING tc_ids;
    END LOOP;
  END IF;

  -- ALL direct profile children
  FOR r IN
    SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.confrelid = 'public.profiles'::regclass AND c.contype = 'f'
    AND conrelid::regclass::text != 'profiles'
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING pids;
  END LOOP;

  -- Delete profiles
  DELETE FROM profiles WHERE id = ANY(pids);
END;
$$;

-- Re-enable FK checks
SET session_replication_role = 'origin';
