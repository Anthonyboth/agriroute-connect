-- Enable RLS on freights table
ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;

-- Policy 1: Transportadoras podem ver fretes do marketplace (OPEN, IN_NEGOTIATION, ACCEPTED com vagas)
CREATE POLICY "transportadoras_select_marketplace" ON public.freights
FOR SELECT
USING (
  company_id IS NULL
  AND status IN ('OPEN', 'IN_NEGOTIATION', 'ACCEPTED')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'TRANSPORTADORA'
    AND p.status = 'APPROVED'
  )
);

-- Policy 2: Produtores podem ver seus próprios fretes
CREATE POLICY "producer_own_freights_select" ON public.freights
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.id = freights.producer_id
  )
);

-- Policy 3: Empresas podem ver fretes atribuídos a elas
CREATE POLICY "company_own_freights_select" ON public.freights
FOR SELECT
USING (
  freights.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.transport_companies c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = auth.uid()
    AND c.id = freights.company_id
  )
);

-- Policy 4: Motoristas podem ver fretes que aceitaram via assignments
CREATE POLICY "driver_assigned_freights_select" ON public.freights
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.freight_assignments fa
    JOIN public.profiles p ON p.id = fa.driver_id
    WHERE p.user_id = auth.uid()
    AND fa.freight_id = freights.id
  )
);

-- Policy 5: Produtores podem inserir seus próprios fretes
CREATE POLICY "producer_insert_own_freights" ON public.freights
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.id = freights.producer_id
  )
);

-- Policy 6: Produtores podem atualizar seus próprios fretes
CREATE POLICY "producer_update_own_freights" ON public.freights
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.id = freights.producer_id
  )
);

-- Policy 7: Empresas podem atualizar fretes atribuídos a elas
CREATE POLICY "company_update_assigned_freights" ON public.freights
FOR UPDATE
USING (
  freights.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.transport_companies c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = auth.uid()
    AND c.id = freights.company_id
  )
);