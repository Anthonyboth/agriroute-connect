-- Atualizar o saldo disponível do emissor para permitir emissões
-- Este é um crédito manual para fase de testes
UPDATE fiscal_wallet
SET 
  available_balance = 100,
  total_credited = 100,
  last_credit_at = now(),
  updated_at = now()
WHERE issuer_id = '9f47d96f-e9f2-4ffa-829f-1c2a8ee2f9e8';

-- Também atualizar o segundo emissor se necessário
UPDATE fiscal_wallet
SET 
  available_balance = 100,
  total_credited = 100,
  last_credit_at = now(),
  updated_at = now()
WHERE issuer_id = 'd7ace860-210d-4cab-957e-2357023c9eeb';