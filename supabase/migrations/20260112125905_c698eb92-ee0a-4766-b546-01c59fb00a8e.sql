
-- ============================================================
-- FIX: Corrigir recursão infinita nas policies RLS
-- Problema: policies em freight_assignments consultam freights
--           e freights consulta freight_assignments, causando 42P17
-- ============================================================

-- 1. Recriar is_current_user_producer_of_freight SEM consultar freights diretamente
-- (ela vai receber producer_id diretamente ao invés de freight_id)
CREATE OR REPLACE FUNCTION public.is_producer_of_freight(p_freight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.profiles p ON p.id = f.producer_id
    WHERE f.id = p_freight_id
      AND p.user_id = auth.uid()
  );
$$;

-- 2. Criar helper para verificar se usuário é dono da transportadora
CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.transport_companies tc
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE tc.id = p_company_id
      AND p.user_id = auth.uid()
  );
$$;

-- 3. Criar helper para pegar profile_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 4. Criar helper para verificar se usuário é motorista do assignment
CREATE OR REPLACE FUNCTION public.is_driver_of_assignment(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_driver_id
      AND p.user_id = auth.uid()
  );
$$;

-- ============================================================
-- 5. REMOVER policies problemáticas de freight_assignments
-- ============================================================

DROP POLICY IF EXISTS "freight_assignments_participant_select" ON public.freight_assignments;
DROP POLICY IF EXISTS "Companies, drivers and producers can view assignments" ON public.freight_assignments;
DROP POLICY IF EXISTS "Companies and drivers can update their assignments" ON public.freight_assignments;
DROP POLICY IF EXISTS "Drivers can update their assignment status" ON public.freight_assignments;
DROP POLICY IF EXISTS "Companies can create assignments" ON public.freight_assignments;

-- ============================================================
-- 6. CRIAR novas policies SEM recursão
-- ============================================================

-- SELECT: Motoristas podem ver seus próprios assignments
CREATE POLICY "drivers_view_own_assignments" ON public.freight_assignments
FOR SELECT TO authenticated
USING (
  public.is_driver_of_assignment(driver_id)
);

-- SELECT: Transportadoras podem ver assignments de sua empresa
CREATE POLICY "companies_view_own_assignments" ON public.freight_assignments
FOR SELECT TO authenticated
USING (
  public.is_company_owner(company_id)
);

-- SELECT: Produtores podem ver assignments dos seus fretes
CREATE POLICY "producers_view_freight_assignments" ON public.freight_assignments
FOR SELECT TO authenticated
USING (
  public.is_producer_of_freight(freight_id)
);

-- UPDATE: Motoristas podem atualizar seus próprios assignments
CREATE POLICY "drivers_update_own_assignments" ON public.freight_assignments
FOR UPDATE TO authenticated
USING (
  public.is_driver_of_assignment(driver_id)
)
WITH CHECK (
  public.is_driver_of_assignment(driver_id)
);

-- UPDATE: Transportadoras podem atualizar assignments de sua empresa
CREATE POLICY "companies_update_own_assignments" ON public.freight_assignments
FOR UPDATE TO authenticated
USING (
  public.is_company_owner(company_id)
)
WITH CHECK (
  public.is_company_owner(company_id)
);

-- UPDATE: Produtores podem atualizar assignments dos seus fretes
CREATE POLICY "producers_update_freight_assignments" ON public.freight_assignments
FOR UPDATE TO authenticated
USING (
  public.is_producer_of_freight(freight_id)
)
WITH CHECK (
  public.is_producer_of_freight(freight_id)
);

-- INSERT: Transportadoras podem criar assignments
CREATE POLICY "companies_insert_assignments" ON public.freight_assignments
FOR INSERT TO authenticated
WITH CHECK (
  public.is_company_owner(company_id)
);

-- INSERT: Motoristas podem criar assignments para si mesmos
CREATE POLICY "drivers_insert_own_assignments" ON public.freight_assignments
FOR INSERT TO authenticated
WITH CHECK (
  public.is_driver_of_assignment(driver_id)
);

-- ============================================================
-- 7. CORRIGIR policy de freights que consulta freight_assignments
-- ============================================================

DROP POLICY IF EXISTS "driver_assigned_freights_select" ON public.freights;
DROP POLICY IF EXISTS "affiliated_driver_update_freight_location" ON public.freights;

-- Criar helper para verificar se motorista está assigned ao frete
CREATE OR REPLACE FUNCTION public.is_driver_assigned_to_freight(p_freight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.freight_assignments fa
    JOIN public.profiles p ON p.id = fa.driver_id
    WHERE fa.freight_id = p_freight_id
      AND p.user_id = auth.uid()
  );
$$;

-- Criar helper para verificar se motorista pode atualizar localização
CREATE OR REPLACE FUNCTION public.can_driver_update_freight_location(p_freight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.freight_assignments fa
    JOIN public.profiles p ON p.id = fa.driver_id
    WHERE fa.freight_id = p_freight_id
      AND p.user_id = auth.uid()
      AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  );
$$;

-- SELECT: Motoristas assigned podem ver o frete
CREATE POLICY "drivers_view_assigned_freights" ON public.freights
FOR SELECT TO public
USING (
  public.is_driver_assigned_to_freight(id)
);

-- UPDATE: Motoristas assigned podem atualizar localização
CREATE POLICY "drivers_update_freight_location" ON public.freights
FOR UPDATE TO public
USING (
  public.can_driver_update_freight_location(id)
)
WITH CHECK (
  public.is_driver_assigned_to_freight(id)
);
