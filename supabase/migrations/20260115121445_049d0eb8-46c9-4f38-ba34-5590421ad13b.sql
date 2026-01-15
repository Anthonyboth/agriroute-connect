-- Fix broken issuer wallet triggers: functions were referencing non-existent table public.issuer_emission_wallets

CREATE OR REPLACE FUNCTION public.create_wallet_for_issuer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- fiscal_wallet is the actual wallet table in this schema (one wallet per profile)
  INSERT INTO public.fiscal_wallet (
    profile_id,
    issuer_id,
    available_balance,
    reserved_balance,
    total_credited,
    total_debited,
    emissions_count,
    created_at,
    updated_at
  ) VALUES (
    NEW.profile_id,
    NEW.id,
    0,
    0,
    0,
    0,
    0,
    now(),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE
  SET issuer_id = EXCLUDED.issuer_id,
      updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_wallet_stats_after_emission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update wallet statistics after emission status change
  IF NEW.status = 'authorized' AND (OLD.status IS NULL OR OLD.status <> 'authorized') THEN
    UPDATE public.fiscal_wallet
    SET
      emissions_count = emissions_count + 1,
      last_emission_at = now(),
      updated_at = now()
    WHERE issuer_id = NEW.issuer_id;
  END IF;

  RETURN NEW;
END;
$$;