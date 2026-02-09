-- FIX: Corrigir policy de notifications com bug de referência
-- A policy anterior tinha "p.id = p.user_id" (auto-referência da tabela profiles)
-- quando deveria ser "p.id = user_id" (referenciando a coluna da tabela notifications)

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = notifications.user_id
  )
);