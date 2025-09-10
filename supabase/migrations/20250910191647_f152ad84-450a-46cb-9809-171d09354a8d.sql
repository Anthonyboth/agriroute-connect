-- Add rating fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN rating NUMERIC(2,1) DEFAULT 0.0,
ADD COLUMN total_ratings INTEGER DEFAULT 0,
ADD COLUMN rating_sum INTEGER DEFAULT 0;

-- Add comment for rating calculation
COMMENT ON COLUMN public.profiles.rating IS 'Average rating calculated from rating_sum/total_ratings';
COMMENT ON COLUMN public.profiles.total_ratings IS 'Total number of ratings received';
COMMENT ON COLUMN public.profiles.rating_sum IS 'Sum of all rating values for average calculation';

-- Create ratings table for individual ratings
CREATE TABLE public.ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rated_user_id UUID NOT NULL,
  rater_user_id UUID NOT NULL,
  freight_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rated_user_id, rater_user_id, freight_id)
);

-- Enable RLS on ratings table
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Create policies for ratings
CREATE POLICY "Users can view ratings for any user" 
ON public.ratings 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create ratings for completed freights" 
ON public.ratings 
FOR INSERT 
WITH CHECK (
  rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND
  freight_id IN (
    SELECT id FROM freights 
    WHERE status = 'DELIVERED' AND 
    (producer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR 
     driver_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);

-- Create function to update profile rating when a new rating is added
CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the rated user's profile
  UPDATE public.profiles 
  SET 
    total_ratings = (SELECT COUNT(*) FROM public.ratings WHERE rated_user_id = NEW.rated_user_id),
    rating_sum = (SELECT SUM(rating) FROM public.ratings WHERE rated_user_id = NEW.rated_user_id),
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.ratings WHERE rated_user_id = NEW.rated_user_id)
  WHERE id = NEW.rated_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for rating updates
CREATE TRIGGER update_profile_rating_trigger
AFTER INSERT OR UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_rating();

-- Create trigger for automatic timestamp updates on ratings
CREATE TRIGGER update_ratings_updated_at
BEFORE UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();