-- Atualizar anúncio existente com novo conteúdo
UPDATE public.system_announcements
SET 
  title = 'Palavras da Salvação',
  message = 'Eles responderam: "Creia no Senhor Jesus, e serão salvos, você e os de sua casa".
Atos 16:31

Período de Testes - Plataforma Gratuita

A plataforma está disponível gratuitamente por um período indeterminado para que você possa testar e verificar seu valor.

Quando for o momento certo, implementaremos uma cobrança mensal ou percentual pelo uso da plataforma.

🚜 Aproveite o período de testes e conheça todos os recursos!

⚠️ Importante: Durante o período de testes, as transações financeiras não estão habilitadas dentro da plataforma. Os acordos de pagamento devem ser feitos externamente. O seguro de frete, caso seja necessário, também deve ser contratado por fora da plataforma por enquanto.',
  updated_at = now()
WHERE id = '037df4cc-7c48-4396-b38f-02b6ae2fa646';

-- Limpar todos os dismissals deste anúncio para que todos vejam novamente
DELETE FROM public.user_announcement_dismissals
WHERE announcement_id = '037df4cc-7c48-4396-b38f-02b6ae2fa646';