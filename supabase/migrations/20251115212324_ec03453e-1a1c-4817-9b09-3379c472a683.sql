-- Deletar anúncio antigo com conteúdo misturado
DELETE FROM system_announcements WHERE id = '037df4cc-7c48-4396-b38f-02b6ae2fa646'; 

-- Criar anúncio 1: Período de Testes
INSERT INTO system_announcements (id, title, message, type, is_active, priority, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Período de Testes - Plataforma Gratuita',
  'A plataforma está disponível gratuitamente por um período indeterminado para que você possa testar e verificar seu valor.

Quando for o momento certo, implementaremos uma cobrança mensal ou percentual pelo uso da plataforma.

🚜 Aproveite o período de testes e conheça todos os recursos!

⚠️ Importante: Durante o período de testes, as transações financeiras não estão habilitadas dentro da plataforma. Os acordos de pagamento devem ser feitos externamente. O seguro de frete, caso seja necessário, também deve ser contratado por fora da plataforma por enquanto.',
  'info',
  true,
  100,
  now(),
  now()
);

-- Criar anúncio 2: Palavras da Salvação
INSERT INTO system_announcements (id, title, message, type, is_active, priority, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Palavras da Salvação',
  'Eles responderam: "Creia no Senhor Jesus, e serão salvos, você e os de sua casa".
Atos 16:31',
  'info',
  true,
  90,
  now(),
  now()
);