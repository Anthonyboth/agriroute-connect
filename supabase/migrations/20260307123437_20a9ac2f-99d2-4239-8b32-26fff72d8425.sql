
-- Incentive campaigns table (admin-managed)
CREATE TABLE public.incentive_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  incentive_type text NOT NULL CHECK (incentive_type IN ('sequence', 'region', 'time_slot', 'urgent', 'reliability')),
  bonus_amount numeric NOT NULL DEFAULT 0,
  bonus_type text NOT NULL DEFAULT 'cash' CHECK (bonus_type IN ('cash', 'credit', 'cashback')),
  -- Conditions
  required_count integer DEFAULT 1,
  target_region_city_id uuid REFERENCES public.cities(id),
  target_region_name text,
  time_slot_start time,
  time_slot_end time,
  min_trust_score integer,
  -- Budget & limits
  total_budget numeric NOT NULL DEFAULT 0,
  spent_budget numeric NOT NULL DEFAULT 0,
  max_claims_per_driver integer DEFAULT 1,
  -- Period
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  -- Audit
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Driver bonus progress tracking
CREATE TABLE public.driver_bonus_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.incentive_campaigns(id) ON DELETE CASCADE,
  driver_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_count integer NOT NULL DEFAULT 0,
  required_count integer NOT NULL DEFAULT 1,
  is_completed boolean NOT NULL DEFAULT false,
  is_claimed boolean NOT NULL DEFAULT false,
  bonus_amount numeric NOT NULL DEFAULT 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  freight_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, driver_profile_id)
);

-- Enable RLS
ALTER TABLE public.incentive_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_bonus_progress ENABLE ROW LEVEL SECURITY;

-- Campaigns: anyone authenticated can read active campaigns
CREATE POLICY "Anyone can read active campaigns"
  ON public.incentive_campaigns FOR SELECT TO authenticated
  USING (is_active = true AND (ends_at IS NULL OR ends_at > now()));

-- Campaigns: only admins can manage (via service_role / admin panel)
-- No INSERT/UPDATE/DELETE for authenticated role

-- Progress: drivers can read their own progress
CREATE POLICY "Drivers read own progress"
  ON public.driver_bonus_progress FOR SELECT TO authenticated
  USING (driver_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Progress: system inserts via service_role only (no direct user insert)

-- Indexes
CREATE INDEX idx_campaigns_active ON public.incentive_campaigns (is_active, starts_at, ends_at);
CREATE INDEX idx_campaigns_type ON public.incentive_campaigns (incentive_type);
CREATE INDEX idx_bonus_progress_driver ON public.driver_bonus_progress (driver_profile_id, is_completed);
CREATE INDEX idx_bonus_progress_campaign ON public.driver_bonus_progress (campaign_id);

-- Updated_at trigger
CREATE TRIGGER update_incentive_campaigns_updated_at
  BEFORE UPDATE ON public.incentive_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bonus_progress_updated_at
  BEFORE UPDATE ON public.driver_bonus_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
