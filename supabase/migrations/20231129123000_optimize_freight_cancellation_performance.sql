-- Optimization for freight cancellation performance
-- This migration adds indexes and optimizes the update operation

-- Step 1: Add index on freight ID for faster lookups
CREATE INDEX IF NOT EXISTS idx_freights_id ON public.freights(id);

-- Step 2: Add index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_freights_status ON public.freights(status);

-- Step 3: Add composite index for producer queries
CREATE INDEX IF NOT EXISTS idx_freights_producer_status ON public.freights(producer_id, status);

-- Step 4: Add index on pickup_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_freights_pickup_date ON public.freights(pickup_date);

-- Step 5: Increase statement timeout for freight updates (30 seconds)
ALTER DATABASE postgres SET statement_timeout = '30s';

-- Step 6: Create optimized function for freight cancellation
CREATE OR REPLACE FUNCTION public.cancel_freight_optimized(
  p_freight_id UUID,
  p_new_pickup_date TIMESTAMP WITH TIME ZONE,
  p_cancellation_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_current_metadata JSONB;
BEGIN
  -- Get current metadata
  SELECT metadata INTO v_current_metadata
  FROM public.freights
  WHERE id = p_freight_id;

  -- Update freight with new status and pickup date
  UPDATE public.freights
  SET 
    status = 'CANCELLED',
    pickup_date = p_new_pickup_date::date,
    updated_at = now(),
    metadata = COALESCE(v_current_metadata, '{}'::jsonb) || jsonb_build_object('cancellation_reason', p_cancellation_reason)
  WHERE id = p_freight_id;

  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_freight_optimized(UUID, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;