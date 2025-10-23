-- Popular affiliated_drivers_tracking com motoristas PENDING e INACTIVE que faltam
INSERT INTO affiliated_drivers_tracking (
  driver_profile_id,
  company_id,
  current_freight_id,
  is_available,
  tracking_status,
  can_accept_autonomous_freights
)
SELECT DISTINCT
  cd.driver_profile_id,
  cd.company_id,
  NULL::uuid, -- current_freight_id
  CASE 
    WHEN cd.status = 'ACTIVE' THEN TRUE
    ELSE FALSE
  END, -- is_available
  'IDLE', -- tracking_status
  TRUE -- can_accept_autonomous_freights
FROM company_drivers cd
WHERE NOT EXISTS (
  SELECT 1 
  FROM affiliated_drivers_tracking adt
  WHERE adt.driver_profile_id = cd.driver_profile_id
    AND adt.company_id = cd.company_id
)
AND cd.status IN ('PENDING', 'ACTIVE', 'INACTIVE');