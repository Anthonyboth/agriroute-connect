-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_provider_balance(UUID);

-- Create function to calculate provider balance
CREATE OR REPLACE FUNCTION get_provider_balance(provider_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_earned_amount DECIMAL;
    pending_amount DECIMAL;
    available_amount DECIMAL;
BEGIN
    -- Calculate total earned from completed services
    SELECT COALESCE(SUM(final_price), 0)
    INTO total_earned_amount
    FROM service_requests
    WHERE provider_id = provider_id_param
    AND status = 'COMPLETED'
    AND final_price IS NOT NULL;
    
    -- For now, set pending to 0 (can be enhanced later with payment processing)
    pending_amount := 0;
    
    -- Available balance is total earned minus any withdrawals
    -- Since we don't have withdrawals table yet, available = total earned
    available_amount := total_earned_amount;
    
    -- Build result JSON
    result := json_build_object(
        'available_balance', available_amount,
        'pending_balance', pending_amount,
        'total_earned', total_earned_amount,
        'last_payout_at', NULL
    );
    
    RETURN result;
END;
$$;