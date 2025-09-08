-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.user_role AS ENUM ('PRODUTOR', 'MOTORISTA', 'ADMIN');
CREATE TYPE public.user_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.freight_status AS ENUM ('OPEN', 'IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
CREATE TYPE public.urgency_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  document TEXT,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create freights table
CREATE TABLE public.freights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cargo_type TEXT NOT NULL,
  weight DECIMAL NOT NULL,
  origin_address TEXT NOT NULL,
  origin_lat DECIMAL,
  origin_lng DECIMAL,
  destination_address TEXT NOT NULL,
  destination_lat DECIMAL,
  destination_lng DECIMAL,
  distance_km DECIMAL,
  price DECIMAL NOT NULL,
  minimum_antt_price DECIMAL,
  toll_cost DECIMAL,
  pickup_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  status freight_status NOT NULL DEFAULT 'OPEN',
  urgency urgency_level NOT NULL DEFAULT 'MEDIUM',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create freight_proposals table
CREATE TABLE public.freight_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freight_id UUID REFERENCES public.freights(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  proposed_price DECIMAL NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(freight_id, driver_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_proposals ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql 
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin());

-- RLS Policies for freights
CREATE POLICY "Producers can view their own freights"
ON public.freights FOR SELECT
USING (producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can view open freights and their accepted ones"
ON public.freights FOR SELECT
USING (
  status = 'OPEN' OR 
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  public.is_admin()
);

CREATE POLICY "Producers can create freights"
ON public.freights FOR INSERT
WITH CHECK (producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'PRODUTOR'));

CREATE POLICY "Producers can update their own freights"
ON public.freights FOR UPDATE
USING (producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all freights"
ON public.freights FOR ALL
USING (public.is_admin());

-- RLS Policies for freight_proposals
CREATE POLICY "Drivers can create proposals"
ON public.freight_proposals FOR INSERT
WITH CHECK (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA'));

CREATE POLICY "Users can view proposals for their freights or their own proposals"
ON public.freight_proposals FOR SELECT
USING (
  freight_id IN (SELECT id FROM public.freights WHERE producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  public.is_admin()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_freights_updated_at
  BEFORE UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'PRODUTOR')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();