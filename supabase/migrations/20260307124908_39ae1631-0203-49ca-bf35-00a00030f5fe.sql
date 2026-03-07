
-- Risk assessment levels
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high', 'blocked');
CREATE TYPE public.risk_operation_type AS ENUM (
  'withdrawal', 'advance', 'credit_use', 'pix_key_change', 
  'high_payout', 'admin_financial_action', 'transfer'
);

-- Financial PINs (hashed)
CREATE TABLE public.financial_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);
ALTER TABLE public.financial_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own PIN"
  ON public.financial_pins FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Security cooldown events (tracks sensitive changes)
CREATE TABLE public.security_cooldown_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- password_change, email_change, phone_change, pix_key_change, new_device_login
  device_fingerprint TEXT,
  ip_address INET DEFAULT '0.0.0.0',
  cooldown_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.security_cooldown_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cooldowns"
  ON public.security_cooldown_events FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "System inserts cooldowns"
  ON public.security_cooldown_events FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Operation risk assessment logs (audit trail)
CREATE TABLE public.operation_risk_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type public.risk_operation_type NOT NULL,
  amount NUMERIC(15,2),
  risk_level public.risk_level NOT NULL,
  risk_score INT NOT NULL DEFAULT 0, -- 0-100
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmation_method TEXT, -- 'simple', 'pin', 'pin_plus_review', 'blocked'
  device_fingerprint TEXT,
  ip_address INET DEFAULT '0.0.0.0',
  user_agent TEXT,
  result TEXT NOT NULL DEFAULT 'pending', -- 'approved', 'denied', 'pending_review', 'pending'
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.operation_risk_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own risk logs"
  ON public.operation_risk_logs FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users insert own risk logs"
  ON public.operation_risk_logs FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Admin can read/update all risk logs
CREATE POLICY "Admin read all risk logs"
  ON public.operation_risk_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update risk logs"
  ON public.operation_risk_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Blocked operations queue (for admin review)
CREATE TABLE public.blocked_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  risk_log_id UUID REFERENCES public.operation_risk_logs(id),
  operation_type public.risk_operation_type NOT NULL,
  operation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  amount NUMERIC(15,2),
  reason TEXT NOT NULL,
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'denied'
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own blocked ops"
  ON public.blocked_operations FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Admin manage blocked ops"
  ON public.blocked_operations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper: check active cooldowns for a user
CREATE OR REPLACE FUNCTION public.get_active_cooldowns(p_profile_id UUID)
RETURNS SETOF public.security_cooldown_events
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.security_cooldown_events
  WHERE profile_id = p_profile_id
    AND cooldown_until > now()
  ORDER BY created_at DESC;
$$;

-- Helper: calculate basic risk score server-side
CREATE OR REPLACE FUNCTION public.assess_operation_risk(
  p_profile_id UUID,
  p_operation_type public.risk_operation_type,
  p_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INT := 0;
  v_factors JSONB := '[]'::jsonb;
  v_level public.risk_level;
  v_cooldown_count INT;
  v_avg_amount NUMERIC;
  v_account_age INTERVAL;
  v_recent_disputes INT;
  v_recent_attempts INT;
BEGIN
  -- 1. Check active cooldowns (+30 each)
  SELECT COUNT(*) INTO v_cooldown_count
  FROM public.security_cooldown_events
  WHERE profile_id = p_profile_id AND cooldown_until > now();
  
  IF v_cooldown_count > 0 THEN
    v_score := v_score + (v_cooldown_count * 30);
    v_factors := v_factors || jsonb_build_array(jsonb_build_object(
      'factor', 'active_cooldown', 'impact', v_cooldown_count * 30,
      'detail', v_cooldown_count || ' restrição(ões) ativa(s)'
    ));
  END IF;

  -- 2. Amount anomaly (+25 if > 3x average)
  IF p_amount > 0 THEN
    SELECT COALESCE(AVG(amount), 0) INTO v_avg_amount
    FROM public.wallet_transactions
    WHERE wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = p_profile_id)
      AND transaction_type IN ('withdrawal', 'advance')
      AND status = 'completed'
      AND created_at > now() - INTERVAL '90 days';
    
    IF v_avg_amount > 0 AND p_amount > (v_avg_amount * 3) THEN
      v_score := v_score + 25;
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'factor', 'amount_anomaly', 'impact', 25,
        'detail', 'Valor ' || ROUND(p_amount / GREATEST(v_avg_amount, 1), 1) || 'x acima da média'
      ));
    END IF;
  END IF;

  -- 3. Account age (+15 if < 7 days)
  SELECT (now() - MIN(created_at)) INTO v_account_age
  FROM public.profiles WHERE id = p_profile_id;
  
  IF v_account_age < INTERVAL '7 days' THEN
    v_score := v_score + 15;
    v_factors := v_factors || jsonb_build_array(jsonb_build_object(
      'factor', 'new_account', 'impact', 15,
      'detail', 'Conta criada há menos de 7 dias'
    ));
  END IF;

  -- 4. Recent disputes (+20)
  SELECT COUNT(*) INTO v_recent_disputes
  FROM public.freight_disputes
  WHERE (complainant_id = p_profile_id OR respondent_id = p_profile_id)
    AND created_at > now() - INTERVAL '30 days'
    AND status IN ('open', 'under_review');
  
  IF v_recent_disputes > 0 THEN
    v_score := v_score + 20;
    v_factors := v_factors || jsonb_build_array(jsonb_build_object(
      'factor', 'recent_disputes', 'impact', 20,
      'detail', v_recent_disputes || ' disputa(s) recente(s)'
    ));
  END IF;

  -- 5. Rapid successive attempts (+20 if > 3 in 10 min)
  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.operation_risk_logs
  WHERE profile_id = p_profile_id
    AND operation_type = p_operation_type
    AND created_at > now() - INTERVAL '10 minutes';
  
  IF v_recent_attempts >= 3 THEN
    v_score := v_score + 20;
    v_factors := v_factors || jsonb_build_array(jsonb_build_object(
      'factor', 'rapid_attempts', 'impact', 20,
      'detail', v_recent_attempts || ' tentativas em 10 min'
    ));
  END IF;

  -- Determine level
  IF v_score >= 70 THEN
    v_level := 'blocked';
  ELSIF v_score >= 40 THEN
    v_level := 'high';
  ELSIF v_score >= 20 THEN
    v_level := 'medium';
  ELSE
    v_level := 'low';
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'level', v_level::TEXT,
    'factors', v_factors,
    'confirmation_required', CASE
      WHEN v_level = 'blocked' THEN 'blocked'
      WHEN v_level = 'high' THEN 'pin_plus_review'
      WHEN v_level = 'medium' THEN 'pin'
      ELSE 'simple'
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assess_operation_risk FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assess_operation_risk FROM anon;
GRANT EXECUTE ON FUNCTION public.assess_operation_risk TO authenticated;
