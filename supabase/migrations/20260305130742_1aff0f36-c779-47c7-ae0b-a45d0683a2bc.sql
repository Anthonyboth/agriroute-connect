
SET session_replication_role = 'replica';

DO $$
DECLARE
  pids uuid[] := ARRAY[
    '5e3b5718-ebbc-47a7-8735-c75d7ba52763',
    '60f2073c-e7e3-483c-a6e4-2d76fbe6380e',
    '62726b56-b7e1-4724-a618-0991a5e1cb24',
    '8ddbadf3-4187-48fc-b890-59797ef74056',
    'a885f432-99a5-41e9-8b07-f0794ba55af4',
    'ad0f7eeb-5813-4a25-aa76-9af12c951c45',
    'f3cd0df9-28d4-48b9-b07a-20f05951a4b3',
    'fbe2872a-5bf6-4720-b8fd-8b0914ff58a0'
  ];
  fids uuid[];
  tc_ids uuid[];
  fi_ids uuid[];
  spa_ids uuid[];
  sr_ids uuid[];
  v_ids uuid[];
  r record;
BEGIN
  SELECT array_agg(id) INTO fids FROM freights WHERE prospect_user_id = ANY(pids) OR driver_id = ANY(pids);
  SELECT array_agg(id) INTO tc_ids FROM transport_companies WHERE profile_id = ANY(pids);
  SELECT array_agg(id) INTO fi_ids FROM fiscal_issuers WHERE profile_id = ANY(pids);
  SELECT array_agg(id) INTO spa_ids FROM service_provider_areas WHERE provider_id = ANY(pids);
  SELECT array_agg(id) INTO sr_ids FROM service_requests WHERE provider_id = ANY(pids) OR client_id = ANY(pids);
  SELECT array_agg(id) INTO v_ids FROM vehicles WHERE driver_id = ANY(pids) OR assigned_driver_id = ANY(pids);

  IF spa_ids IS NOT NULL THEN
    DELETE FROM service_matches WHERE provider_area_id = ANY(spa_ids);
  END IF;

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

  FOR r IN
    SELECT DISTINCT conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.confrelid = 'public.profiles'::regclass AND c.contype = 'f'
    AND conrelid::regclass::text != 'profiles'
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', r.tbl, r.col) USING pids;
  END LOOP;

  DELETE FROM profiles WHERE id = ANY(pids);
END;
$$;

SET session_replication_role = 'origin';
