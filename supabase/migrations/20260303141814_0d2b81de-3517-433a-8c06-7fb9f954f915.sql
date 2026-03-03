-- Fix RLS policies for fiscal tables: use profiles.user_id = auth.uid() instead of profile_id = auth.uid()

-- ===================== empresas_fiscais =====================
DROP POLICY IF EXISTS "empresas_fiscais_select" ON public.empresas_fiscais;
DROP POLICY IF EXISTS "empresas_fiscais_insert" ON public.empresas_fiscais;
DROP POLICY IF EXISTS "empresas_fiscais_update" ON public.empresas_fiscais;

CREATE POLICY "empresas_fiscais_select" ON public.empresas_fiscais
FOR SELECT TO authenticated
USING (
  transport_company_id IN (
    SELECT tc.id FROM public.transport_companies tc
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'carrier'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "empresas_fiscais_insert" ON public.empresas_fiscais
FOR INSERT TO authenticated
WITH CHECK (
  transport_company_id IN (
    SELECT tc.id FROM public.transport_companies tc
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "empresas_fiscais_update" ON public.empresas_fiscais
FOR UPDATE TO authenticated
USING (
  transport_company_id IN (
    SELECT tc.id FROM public.transport_companies tc
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
);

-- ===================== ctes =====================
DROP POLICY IF EXISTS "ctes_select" ON public.ctes;
DROP POLICY IF EXISTS "ctes_insert" ON public.ctes;
DROP POLICY IF EXISTS "ctes_update" ON public.ctes;

CREATE POLICY "ctes_select" ON public.ctes
FOR SELECT TO authenticated
USING (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'carrier'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "ctes_insert" ON public.ctes
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "ctes_update" ON public.ctes
FOR UPDATE TO authenticated
USING (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
);

-- ===================== auditoria_eventos =====================
DROP POLICY IF EXISTS "auditoria_eventos_select" ON public.auditoria_eventos;
DROP POLICY IF EXISTS "auditoria_eventos_update" ON public.auditoria_eventos;

CREATE POLICY "auditoria_eventos_select" ON public.auditoria_eventos
FOR SELECT TO authenticated
USING (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'carrier'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "auditoria_eventos_update" ON public.auditoria_eventos
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'carrier'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
);