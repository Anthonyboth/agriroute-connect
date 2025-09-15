-- Adicionar coluna fixed_address à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fixed_address text;