-- Permitir que usuários autenticados criem notificações para outros usuários
-- (necessário para que o produtor crie notificação ao motorista sobre pagamento)
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Nota: A segurança de quem pode receber notificações é garantida pelo
-- fato de que apenas o destinatário pode VER suas próprias notificações (policy SELECT existente)