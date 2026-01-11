-- Fix all database functions missing search_path
-- This addresses the "Function Search Path Mutable" security warning

-- 1. classify_stop - SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.classify_stop(
    p_duration_minutes integer, 
    p_is_authorized boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF p_is_authorized THEN
        IF p_duration_minutes < 15 THEN
            RETURN 'parada_curta_autorizada';
        ELSIF p_duration_minutes < 60 THEN
            RETURN 'parada_media_autorizada';
        ELSE
            RETURN 'parada_longa_autorizada';
        END IF;
    ELSE
        IF p_duration_minutes < 15 THEN
            RETURN 'parada_curta';
        ELSIF p_duration_minutes < 60 THEN
            RETURN 'parada_media';
        ELSE
            RETURN 'parada_longa_nao_autorizada';
        END IF;
    END IF;
END;
$$;

-- 2. create_wallet_for_issuer - SECURITY DEFINER (critical - needs search_path)
CREATE OR REPLACE FUNCTION public.create_wallet_for_issuer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.issuer_emission_wallets (issuer_id, balance, created_at, updated_at)
    VALUES (NEW.id, 0, now(), now())
    ON CONFLICT (issuer_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 3. haversine_km - SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.haversine_km(
    lat1 double precision, 
    lon1 double precision, 
    lat2 double precision, 
    lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    R constant double precision := 6371;
    dlat double precision;
    dlon double precision;
    a double precision;
    c double precision;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
    c := 2 * asin(sqrt(a));
    RETURN R * c;
END;
$$;

-- 4. trigger_antifraud_on_cte_authorized - SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.trigger_antifraud_on_cte_authorized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'autorizado' AND (OLD.status IS NULL OR OLD.status <> 'autorizado') THEN
        -- Trigger antifraud checks when CTE is authorized
        PERFORM pg_notify('antifraud_check', json_build_object(
            'cte_id', NEW.id,
            'empresa_id', NEW.empresa_id,
            'type', 'cte_authorized'
        )::text);
    END IF;
    RETURN NEW;
END;
$$;

-- 5. update_ctes_updated_at - SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.update_ctes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 6. update_empresas_fiscais_updated_at - SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.update_empresas_fiscais_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 7. update_wallet_stats_after_emission - SECURITY DEFINER (critical - needs search_path)
CREATE OR REPLACE FUNCTION public.update_wallet_stats_after_emission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update wallet statistics after emission status change
    IF NEW.status = 'authorized' AND (OLD.status IS NULL OR OLD.status <> 'authorized') THEN
        UPDATE public.issuer_emission_wallets
        SET 
            total_emissions = total_emissions + 1,
            last_emission_at = now(),
            updated_at = now()
        WHERE issuer_id = NEW.issuer_id;
    END IF;
    RETURN NEW;
END;
$$;