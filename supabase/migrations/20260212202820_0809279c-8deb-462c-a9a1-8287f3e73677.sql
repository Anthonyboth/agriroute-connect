-- Remove a política permissiva que permite admins verem seus próprios limites de reset
DROP POLICY IF EXISTS "Admins view own reset limits" ON public.admin_password_reset_limits;

-- A política "admin_password_reset_limits_admin_manage" (ALL com is_admin() OR is_service_role()) 
-- já é suficiente para operações de INSERT/UPDATE feitas pela edge function admin-reset-password.
-- Mas o SELECT não deveria ser visível para admins comuns.
-- Substituir por uma política mais restritiva: apenas service_role pode ler.

-- Remover a política ALL genérica e substituir por políticas granulares
DROP POLICY IF EXISTS "admin_password_reset_limits_admin_manage" ON public.admin_password_reset_limits;

-- INSERT/UPDATE: service_role e admins (necessário para a edge function funcionar)
CREATE POLICY "admin_reset_limits_write"
ON public.admin_password_reset_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SELECT restrito: apenas service_role pode ler (usado internamente pela edge function)
-- Admins NÃO precisam ver seus próprios limites de reset
CREATE POLICY "admin_reset_limits_read_service_only"
ON public.admin_password_reset_limits
FOR SELECT
TO authenticated
USING (false);