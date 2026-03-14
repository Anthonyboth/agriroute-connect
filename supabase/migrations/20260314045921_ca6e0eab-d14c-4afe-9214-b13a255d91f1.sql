
-- Insurance Products catalog
CREATE TABLE public.insurance_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  coverage_details text NOT NULL DEFAULT '',
  exclusions text NOT NULL DEFAULT '',
  min_price numeric NOT NULL DEFAULT 0,
  max_price numeric NOT NULL DEFAULT 0,
  max_coverage numeric,
  pricing_model text NOT NULL DEFAULT 'percentage',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insurance_products_select_authenticated"
  ON public.insurance_products FOR SELECT
  TO authenticated
  USING (active = true);

-- User Insurances (policies purchased)
CREATE TABLE public.user_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_product_id uuid NOT NULL REFERENCES public.insurance_products(id),
  coverage_value numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_insurances_own"
  ON public.user_insurances FOR ALL
  TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Freight Insurances (per-freight protection)
CREATE TABLE public.freight_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id uuid NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_product_id uuid NOT NULL REFERENCES public.insurance_products(id),
  coverage_value numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freight_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freight_insurances_own"
  ON public.freight_insurances FOR ALL
  TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Insurance Claims
CREATE TABLE public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_insurance_id uuid REFERENCES public.user_insurances(id),
  freight_insurance_id uuid REFERENCES public.freight_insurances(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  resolution_notes text,
  amount_claimed numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insurance_claims_own"
  ON public.insurance_claims FOR ALL
  TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
