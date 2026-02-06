-- Criar pagamento retroativo para o motorista que já teve entrega confirmada
-- sem criação automática de pagamento (bug corrigido nesta sessão)
INSERT INTO public.external_payments (
  freight_id,
  producer_id,
  driver_id,
  amount,
  status,
  notes,
  proposed_at
) VALUES (
  '80d056ae-89c7-4356-9d99-a4a947e2fa4f',
  '5968c470-b7a8-4c53-90cd-68a2b726f5bb',
  '60f2073c-e7e3-483c-a6e4-2d76fbe6380e',
  10800.00,
  'proposed',
  'Pagamento retroativo: entrega individual confirmada anteriormente sem criação automática de pagamento',
  now()
);