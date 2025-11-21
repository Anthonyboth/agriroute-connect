-- Criar tabela para preços do diesel
CREATE TABLE IF NOT EXISTS diesel_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price NUMERIC(10,2) NOT NULL,
  source TEXT DEFAULT 'manual',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_effective_date UNIQUE (effective_date)
);

-- Inserir preço inicial: R$ 6,00 em 11/11/2025
INSERT INTO diesel_prices (price, source, effective_date)
VALUES (6.00, 'manual', '2025-11-11')
ON CONFLICT (effective_date) DO NOTHING;

-- RLS Policies
ALTER TABLE diesel_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem visualizar preços do diesel"
ON diesel_prices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins podem inserir preços"
ON diesel_prices FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Inserir aviso no mural com texto exato do usuário
INSERT INTO system_announcements (
  title,
  message,
  type,
  category,
  priority,
  is_active,
  starts_at
) VALUES (
  '⛽ O Sistema de Mensalidade Será Baseado no Diesel',
  '🚛 Fórmula: (Litros do Veículo × Preço Diesel)

Exemplos (diesel a R$ 6,00/L):
• Moto (10L): R$ 60,00/mês
• Pickup (40L): R$ 240,00/mês
• Carretas (70L): R$ 420,00/mês
• Transportadora (100L): R$ 600,00/mês

Vantagens: Transparência e justiça - veículos maiores pagam mais.

⚠️ A cobrança ainda NÃO está ativa. Este é apenas um aviso informativo.',
  'info',
  'financeiro',
  90,
  true,
  NOW()
);