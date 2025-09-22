-- Add payment deadline tracking for matched freights
CREATE TABLE IF NOT EXISTS freight_payment_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  deadline_at TIMESTAMP WITH TIME ZONE NOT NULL,
  minimum_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FULFILLED', 'OVERDUE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(freight_id)
);

-- Enable RLS
ALTER TABLE freight_payment_deadlines ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their payment deadlines" ON freight_payment_deadlines
  FOR SELECT USING (
    freight_id IN (
      SELECT f.id FROM freights f 
      JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
      WHERE p.user_id = auth.uid()
    ) OR is_admin()
  );

CREATE POLICY "System can manage payment deadlines" ON freight_payment_deadlines
  FOR ALL USING (true);

-- Create trigger to automatically create payment deadline when freight status changes to ACCEPTED
CREATE OR REPLACE FUNCTION create_payment_deadline_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- When freight status changes from not-ACCEPTED to ACCEPTED
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    -- Create payment deadline: 50% of freight value due by pickup_date
    INSERT INTO freight_payment_deadlines (
      freight_id,
      deadline_at,
      minimum_amount,
      status
    ) VALUES (
      NEW.id,
      (NEW.pickup_date::date || ' ' || COALESCE(EXTRACT(hour FROM NEW.pickup_date::time), 9) || ':00:00')::timestamp with time zone,
      NEW.price * 0.5,
      'PENDING'
    ) ON CONFLICT (freight_id) DO UPDATE SET
      deadline_at = (NEW.pickup_date::date || ' ' || COALESCE(EXTRACT(hour FROM NEW.pickup_date::time), 9) || ':00:00')::timestamp with time zone,
      minimum_amount = NEW.price * 0.5,
      status = 'PENDING',
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_create_payment_deadline
  AFTER UPDATE ON freights
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_deadline_on_accept();

-- Create function to check and update payment deadline status
CREATE OR REPLACE FUNCTION update_payment_deadline_status(p_freight_id UUID)
RETURNS void AS $$
DECLARE
  deadline_record RECORD;
  total_paid NUMERIC := 0;
BEGIN
  -- Get deadline info
  SELECT * INTO deadline_record 
  FROM freight_payment_deadlines 
  WHERE freight_id = p_freight_id;
  
  IF deadline_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate total payments made for this freight
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM freight_payments
  WHERE freight_id = p_freight_id 
    AND status = 'COMPLETED';
  
  -- Also include approved freight advances
  SELECT total_paid + COALESCE(SUM(approved_amount), 0) INTO total_paid
  FROM freight_advances
  WHERE freight_id = p_freight_id 
    AND status IN ('APPROVED', 'PAID');
  
  -- Update deadline status
  IF total_paid >= deadline_record.minimum_amount THEN
    UPDATE freight_payment_deadlines 
    SET status = 'FULFILLED', updated_at = now()
    WHERE freight_id = p_freight_id;
  ELSIF now() > deadline_record.deadline_at THEN
    UPDATE freight_payment_deadlines 
    SET status = 'OVERDUE', updated_at = now()
    WHERE freight_id = p_freight_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update payment deadline when payments are made
CREATE OR REPLACE FUNCTION check_payment_deadline_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_payment_deadline_status(NEW.freight_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_payment_deadline_status(OLD.freight_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
CREATE TRIGGER trigger_check_deadline_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON freight_payments
  FOR EACH ROW
  EXECUTE FUNCTION check_payment_deadline_on_payment();

CREATE TRIGGER trigger_check_deadline_on_advance
  AFTER INSERT OR UPDATE OR DELETE ON freight_advances
  FOR EACH ROW
  EXECUTE FUNCTION check_payment_deadline_on_payment();