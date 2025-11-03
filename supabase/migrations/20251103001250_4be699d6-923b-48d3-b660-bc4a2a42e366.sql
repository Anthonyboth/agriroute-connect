-- =========================================
-- CORREÇÃO: Segurança da migration de pesos
-- =========================================

-- 1. Adicionar RLS na tabela de backup
ALTER TABLE freights_weight_backup ENABLE ROW LEVEL SECURITY;

-- 2. Políticas RLS para tabela de backup (apenas admins)
CREATE POLICY "Apenas admins podem ver backup de pesos"
ON freights_weight_backup
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- 3. Corrigir search_path da função de validação
CREATE OR REPLACE FUNCTION validate_freight_weight()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.weight < 100 THEN
    RAISE EXCEPTION 'Peso mínimo: 100kg (0.1 toneladas)';
  END IF;
  
  IF NEW.weight > 50000 THEN
    RAISE EXCEPTION 'Peso máximo: 50.000kg (50 toneladas)';
  END IF;
  
  IF NEW.weight > 45000 THEN
    RAISE WARNING 'Peso muito alto: % kg. Confirme se está correto.', NEW.weight;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Comentário explicativo
COMMENT ON TABLE freights_weight_backup IS 'Backup de correções de peso aplicadas automaticamente. Apenas admins têm acesso.';