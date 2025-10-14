-- Garantir que TRANSPORTADORA existe no enum user_role
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'TRANSPORTADORA' 
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'TRANSPORTADORA';
    END IF;
END $$;

-- Adicionar MOTORISTA_AFILIADO ao enum user_role
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'MOTORISTA_AFILIADO' 
        AND enumtypid = 'user_role'::regtype
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'MOTORISTA_AFILIADO';
    END IF;
END $$;

-- Criar função helper para identificar motoristas afiliados
CREATE OR REPLACE FUNCTION public.is_affiliated_driver(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM company_drivers 
    WHERE driver_profile_id = p_profile_id 
    AND status = 'ACTIVE'
  );
$$;