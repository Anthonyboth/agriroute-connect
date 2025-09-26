-- Add COMPLETED status to freight_status enum
ALTER TYPE freight_status ADD VALUE 'COMPLETED';

-- Create ratings table for mutual evaluations
CREATE TABLE public.freight_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL,
  rater_id UUID NOT NULL,
  rated_user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  rating_type TEXT NOT NULL CHECK (rating_type IN ('PRODUCER_TO_DRIVER', 'DRIVER_TO_PRODUCER')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_freight_ratings_freight FOREIGN KEY (freight_id) REFERENCES freights(id) ON DELETE CASCADE,
  CONSTRAINT fk_freight_ratings_rater FOREIGN KEY (rater_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_freight_ratings_rated FOREIGN KEY (rated_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Unique constraint to prevent duplicate ratings
  UNIQUE(freight_id, rater_id, rating_type)
);

-- Enable RLS on ratings table
ALTER TABLE public.freight_ratings ENABLE ROW LEVEL SECURITY;

-- Policies for ratings
CREATE POLICY "Users can create ratings for their freights" 
ON public.freight_ratings 
FOR INSERT 
WITH CHECK (
  rater_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND freight_id IN (
    SELECT f.id FROM freights f 
    JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view ratings for their freights" 
ON public.freight_ratings 
FOR SELECT 
USING (
  freight_id IN (
    SELECT f.id FROM freights f 
    JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid()
  ) 
  OR is_admin()
);

-- Create function to check if both parties have rated
CREATE OR REPLACE FUNCTION check_mutual_ratings_complete(freight_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  producer_rated BOOLEAN;
  driver_rated BOOLEAN;
BEGIN
  -- Check if producer rated the driver
  SELECT EXISTS(
    SELECT 1 FROM freight_ratings fr
    JOIN freights f ON fr.freight_id = f.id
    WHERE fr.freight_id = freight_id_param 
    AND fr.rater_id = f.producer_id
    AND fr.rating_type = 'PRODUCER_TO_DRIVER'
  ) INTO producer_rated;
  
  -- Check if driver rated the producer
  SELECT EXISTS(
    SELECT 1 FROM freight_ratings fr
    JOIN freights f ON fr.freight_id = f.id
    WHERE fr.freight_id = freight_id_param 
    AND fr.rater_id = f.driver_id
    AND fr.rating_type = 'DRIVER_TO_PRODUCER'
  ) INTO driver_rated;
  
  RETURN producer_rated AND driver_rated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;