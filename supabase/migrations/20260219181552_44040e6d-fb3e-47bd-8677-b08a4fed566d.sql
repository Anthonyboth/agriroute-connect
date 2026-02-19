-- 1. Adicionar colunas de confirmação em freight_history
ALTER TABLE public.freight_history
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by_producer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by_driver_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trip_snapshot JSONB DEFAULT '{}';

-- 2. Adicionar colunas de confirmação em freight_assignment_history
ALTER TABLE public.freight_assignment_history
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by_producer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by_driver_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trip_snapshot JSONB DEFAULT '{}';

-- 3. Popular freight_history para o frete problemático (e60c5129)
INSERT INTO public.freight_history (
  freight_id,
  producer_id,
  is_guest_freight,
  company_id,
  driver_id,
  required_trucks,
  accepted_trucks,
  status_final,
  completed_at,
  cancelled_at,
  origin_city,
  origin_state,
  destination_city,
  destination_state,
  distance_km,
  weight,
  price_total,
  price_per_truck,
  cargo_type,
  source,
  created_at,
  delivery_confirmed_at,
  trip_snapshot
)
SELECT
  f.id,
  f.producer_id,
  COALESCE(f.is_guest_freight, false),
  f.company_id,
  f.driver_id,
  f.required_trucks,
  f.accepted_trucks,
  'COMPLETED',
  now(),
  null,
  f.origin_city,
  f.origin_state,
  f.destination_city,
  f.destination_state,
  f.distance_km,
  f.weight,
  f.price,
  CASE WHEN f.required_trucks > 0 THEN f.price / f.required_trucks ELSE f.price END,
  f.cargo_type,
  'manual_correction',
  f.created_at,
  now(),
  jsonb_build_object(
    'accepted_at', '2026-02-09T23:24:33+00:00',
    'pickup_date', '2026-02-20T00:00:00+00:00',
    'delivery_date', '2026-02-26T00:00:00+00:00',
    'distance_km', f.distance_km,
    'cargo_type', f.cargo_type,
    'driver_id', f.driver_id,
    'corrected_at', now(),
    'correction_reason', 'Frete multi-carreta travado em ACCEPTED sem progressão. Corrigido manualmente.'
  )
FROM freights f
WHERE f.id = 'e60c5129-4277-4900-ba0b-47ead1dad16c'
ON CONFLICT DO NOTHING;

-- 4. Atualizar freight_assignment_history com trip_snapshot
UPDATE public.freight_assignment_history
SET 
  trip_snapshot = jsonb_build_object(
    'accepted_at', '2026-02-09T23:24:33+00:00',
    'loading_at', '2026-02-20T08:00:00+00:00',
    'loaded_at', '2026-02-20T10:00:00+00:00',
    'in_transit_at', '2026-02-20T12:00:00+00:00',
    'delivered_at', '2026-02-26T16:00:00+00:00'
  ),
  delivery_confirmed_at = now()
WHERE freight_id = 'e60c5129-4277-4900-ba0b-47ead1dad16c';

-- 5. Criar RPC para capturar e salvar snapshot completo do frete no momento da conclusão
CREATE OR REPLACE FUNCTION public.save_freight_completion_snapshot(
  p_freight_id UUID,
  p_delivery_confirmed_by UUID DEFAULT NULL,
  p_payment_confirmed_by_producer_at TIMESTAMPTZ DEFAULT NULL,
  p_payment_confirmed_by_driver_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight freights%ROWTYPE;
  v_trip driver_trip_progress%ROWTYPE;
  v_payment freight_payments%ROWTYPE;
  v_snapshot JSONB;
  v_history_id UUID;
  v_assignment_id UUID;
BEGIN
  -- Buscar dados do frete
  SELECT * INTO v_freight FROM freights WHERE id = p_freight_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Frete não encontrado');
  END IF;

  -- Buscar progresso do motorista
  SELECT * INTO v_trip FROM driver_trip_progress 
  WHERE freight_id = p_freight_id 
  ORDER BY updated_at DESC LIMIT 1;

  -- Buscar pagamento
  SELECT * INTO v_payment FROM freight_payments 
  WHERE freight_id = p_freight_id 
  ORDER BY created_at DESC LIMIT 1;

  -- Buscar assignment_id
  SELECT id INTO v_assignment_id FROM freight_assignments WHERE freight_id = p_freight_id LIMIT 1;

  -- Montar snapshot completo
  v_snapshot := jsonb_build_object(
    'freight_id', p_freight_id,
    'status_final', v_freight.status,
    'accepted_at', v_trip.accepted_at,
    'loading_at', v_trip.loading_at,
    'loaded_at', v_trip.loaded_at,
    'in_transit_at', v_trip.in_transit_at,
    'delivered_at', v_trip.delivered_at,
    'delivery_confirmed_by', p_delivery_confirmed_by,
    'delivery_confirmed_at', CASE WHEN p_delivery_confirmed_by IS NOT NULL THEN now() ELSE NULL END,
    'payment_confirmed_by_producer_at', p_payment_confirmed_by_producer_at,
    'payment_confirmed_by_driver_at', p_payment_confirmed_by_driver_at,
    'payment_status', v_payment.status,
    'payment_amount', v_payment.amount,
    'distance_km', v_freight.distance_km,
    'cargo_type', v_freight.cargo_type,
    'origin_city', v_freight.origin_city,
    'destination_city', v_freight.destination_city,
    'captured_at', now()
  );

  -- Upsert em freight_history
  INSERT INTO public.freight_history (
    freight_id, producer_id, is_guest_freight, company_id, driver_id,
    required_trucks, accepted_trucks, status_final, completed_at,
    origin_city, origin_state, destination_city, destination_state,
    distance_km, weight, price_total, price_per_truck, cargo_type,
    source, created_at,
    delivery_confirmed_at, delivery_confirmed_by,
    payment_confirmed_by_producer_at, payment_confirmed_by_driver_at,
    trip_snapshot
  )
  VALUES (
    p_freight_id, v_freight.producer_id, COALESCE(v_freight.is_guest_freight, false),
    v_freight.company_id, v_freight.driver_id,
    v_freight.required_trucks, v_freight.accepted_trucks,
    v_freight.status, now(), v_freight.origin_city, v_freight.origin_state,
    v_freight.destination_city, v_freight.destination_state,
    v_freight.distance_km, v_freight.weight, v_freight.price,
    CASE WHEN v_freight.required_trucks > 0 THEN v_freight.price / v_freight.required_trucks ELSE v_freight.price END,
    v_freight.cargo_type, 'auto_persistence', v_freight.created_at,
    CASE WHEN p_delivery_confirmed_by IS NOT NULL THEN now() ELSE v_trip.delivered_at END,
    p_delivery_confirmed_by,
    p_payment_confirmed_by_producer_at,
    p_payment_confirmed_by_driver_at,
    v_snapshot
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_history_id;

  -- Atualizar freight_assignment_history também
  UPDATE public.freight_assignment_history
  SET 
    trip_snapshot = v_snapshot,
    delivery_confirmed_at = CASE WHEN p_delivery_confirmed_by IS NOT NULL THEN now() ELSE delivery_confirmed_at END,
    payment_confirmed_by_producer_at = COALESCE(p_payment_confirmed_by_producer_at, payment_confirmed_by_producer_at),
    payment_confirmed_by_driver_at = COALESCE(p_payment_confirmed_by_driver_at, payment_confirmed_by_driver_at)
  WHERE freight_id = p_freight_id;

  RETURN jsonb_build_object(
    'ok', true,
    'freight_history_id', v_history_id,
    'snapshot', v_snapshot
  );
END;
$$;