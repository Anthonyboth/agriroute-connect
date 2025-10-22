-- =====================================================
-- FIX: Sistema de Aprovação para Motoristas Afiliados
-- =====================================================

-- 1. Permitir motoristas solicitarem vínculo com status PENDING
DROP POLICY IF EXISTS "Motoristas podem solicitar vínculo" ON public.company_drivers;

CREATE POLICY "Motoristas podem solicitar vínculo" 
ON public.company_drivers 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Motorista só pode vincular seu próprio profile
  driver_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND status = 'PENDING'  -- Obrigatoriamente PENDING para aprovação
);

-- 2. Permitir motoristas verem dados básicos da transportadora
DROP POLICY IF EXISTS "Motoristas vinculados podem ver dados básicos da transportadora" ON public.transport_companies;

CREATE POLICY "Motoristas vinculados podem ver dados básicos da transportadora"
ON public.transport_companies
FOR SELECT
TO authenticated
USING (
  -- Permite ver se há vínculo (pendente, ativo ou rejeitado)
  id IN (
    SELECT company_id FROM public.company_drivers 
    WHERE driver_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- 3. Permitir transportadoras aprovarem/rejeitarem motoristas
DROP POLICY IF EXISTS "Transportadoras aprovam motoristas" ON public.company_drivers;

CREATE POLICY "Transportadoras aprovam motoristas"
ON public.company_drivers
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT id FROM public.transport_companies 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM public.transport_companies 
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- 4. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_company_drivers_driver_profile_id 
ON public.company_drivers(driver_profile_id);

CREATE INDEX IF NOT EXISTS idx_company_drivers_status 
ON public.company_drivers(status) WHERE status = 'PENDING';

-- 5. Criar trigger para notificar motorista quando aprovado
CREATE OR REPLACE FUNCTION notify_driver_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'PENDING' AND NEW.status = 'ACTIVE' THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    SELECT 
      p.user_id,
      'Vínculo Aprovado! 🎉',
      'Sua solicitação de vínculo com ' || tc.company_name || ' foi aprovada!',
      'driver_approved',
      jsonb_build_object(
        'company_id', NEW.company_id,
        'company_name', tc.company_name
      )
    FROM profiles p
    JOIN transport_companies tc ON tc.id = NEW.company_id
    WHERE p.id = NEW.driver_profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_driver_approval ON public.company_drivers;

CREATE TRIGGER trigger_notify_driver_approval
AFTER UPDATE ON public.company_drivers
FOR EACH ROW
EXECUTE FUNCTION notify_driver_approval();

COMMENT ON POLICY "Motoristas podem solicitar vínculo" 
ON public.company_drivers IS 
'Permite motoristas solicitarem vínculo com transportadoras. Status deve ser PENDING para aprovação manual.';

COMMENT ON POLICY "Motoristas vinculados podem ver dados básicos da transportadora" 
ON public.transport_companies IS 
'Permite motoristas verem dados básicos da transportadora para validação e notificações.';

COMMENT ON POLICY "Transportadoras aprovam motoristas"
ON public.company_drivers IS
'Permite transportadoras aprovarem ou rejeitarem solicitações de vínculo de motoristas.';