
-- ============================================================
-- LIMPEZA COMPLETA: apaga todos os fretes e dados relacionados
-- ============================================================

-- 1. driver_trip_progress
DELETE FROM public.driver_trip_progress
WHERE freight_id IN (
  'e60c5129-4277-4900-ba0b-47ead1dad16c',
  'c18b8288-04cb-415e-874a-27e4a91776ab'
);

-- 2. freight_assignment_history
DELETE FROM public.freight_assignment_history
WHERE freight_id IN (
  'e60c5129-4277-4900-ba0b-47ead1dad16c',
  'c18b8288-04cb-415e-874a-27e4a91776ab'
);

-- 3. freight_history
DELETE FROM public.freight_history
WHERE freight_id IN (
  'e60c5129-4277-4900-ba0b-47ead1dad16c',
  'c18b8288-04cb-415e-874a-27e4a91776ab'
);

-- 4. freight_assignments
DELETE FROM public.freight_assignments
WHERE freight_id IN (
  'e60c5129-4277-4900-ba0b-47ead1dad16c',
  'c18b8288-04cb-415e-874a-27e4a91776ab'
);

-- 5. Fretes principais
DELETE FROM public.freights
WHERE id IN (
  'e60c5129-4277-4900-ba0b-47ead1dad16c',
  'c18b8288-04cb-415e-874a-27e4a91776ab'
);
