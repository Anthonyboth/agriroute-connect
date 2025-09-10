-- Add farm and vehicle information to profiles
ALTER TABLE public.profiles ADD COLUMN farm_name text;
ALTER TABLE public.profiles ADD COLUMN farm_address text;
ALTER TABLE public.profiles ADD COLUMN farm_lat numeric;
ALTER TABLE public.profiles ADD COLUMN farm_lng numeric;
ALTER TABLE public.profiles ADD COLUMN cpf_cnpj text;
ALTER TABLE public.profiles ADD COLUMN rntrc text;
ALTER TABLE public.profiles ADD COLUMN antt_number text;
ALTER TABLE public.profiles ADD COLUMN cooperative text;

-- Add vehicle information table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL, -- 'TRUCK', 'BITREM', 'RODOTREM', etc.
  axle_count integer NOT NULL DEFAULT 2,
  max_capacity_tons numeric NOT NULL,
  license_plate text NOT NULL,
  crlv_url text,
  vehicle_photo_url text,
  status text NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Vehicle policies
CREATE POLICY "Drivers can view their own vehicles" 
ON public.vehicles FOR SELECT 
USING (driver_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Drivers can insert their own vehicles" 
ON public.vehicles FOR INSERT 
WITH CHECK (driver_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'MOTORISTA'
));

CREATE POLICY "Drivers can update their own vehicles" 
ON public.vehicles FOR UPDATE 
USING (driver_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage all vehicles" 
ON public.vehicles FOR ALL 
USING (is_admin());

-- Add more freight details
ALTER TABLE public.freights ADD COLUMN vehicle_type_required text;
ALTER TABLE public.freights ADD COLUMN pickup_observations text;
ALTER TABLE public.freights ADD COLUMN delivery_observations text;
ALTER TABLE public.freights ADD COLUMN payment_method text; -- 'PIX', 'BOLETO', 'CARTAO', 'DIRETO'
ALTER TABLE public.freights ADD COLUMN fiscal_documents_url text;

-- Create freight bids/proposals enhancement
ALTER TABLE public.freight_proposals ADD COLUMN justification text;
ALTER TABLE public.freight_proposals ADD COLUMN delivery_estimate_days integer;

-- Add freight filters and search
CREATE INDEX idx_freights_service_type ON public.freights(service_type);
CREATE INDEX idx_freights_cargo_type ON public.freights(cargo_type);
CREATE INDEX idx_freights_status ON public.freights(status);
CREATE INDEX idx_freights_weight ON public.freights(weight);
CREATE INDEX idx_freights_distance ON public.freights(distance_km);

-- Add vehicle type enum for consistency
CREATE TYPE vehicle_type AS ENUM ('TRUCK', 'BITREM', 'RODOTREM', 'CARRETA', 'VUC', 'TOCO');

-- Update vehicles table to use enum
ALTER TABLE public.vehicles ALTER COLUMN vehicle_type TYPE vehicle_type USING vehicle_type::vehicle_type;
ALTER TABLE public.freights ALTER COLUMN vehicle_type_required TYPE vehicle_type USING vehicle_type_required::vehicle_type;

-- Add payment methods enum
CREATE TYPE payment_method AS ENUM ('PIX', 'BOLETO', 'CARTAO', 'DIRETO');
ALTER TABLE public.freights ALTER COLUMN payment_method TYPE payment_method USING payment_method::payment_method;

-- Add trigger for vehicle updated_at
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();