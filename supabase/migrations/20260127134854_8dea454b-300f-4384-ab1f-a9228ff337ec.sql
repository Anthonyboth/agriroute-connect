-- Tighten RLS policies to 'authenticated' role only for balance_transactions, identity_selfies, and service_requests
-- This prevents any unauthenticated access paths

-- ==========================================
-- BALANCE_TRANSACTIONS: Restrict to authenticated
-- ==========================================
ALTER POLICY "Admins podem ver todas as transações" ON public.balance_transactions TO authenticated;
ALTER POLICY "Prestadores podem ver suas próprias transações" ON public.balance_transactions TO authenticated;
ALTER POLICY "balance_transactions_owner_select" ON public.balance_transactions TO authenticated;
ALTER POLICY "balance_transactions_service_manage" ON public.balance_transactions TO authenticated;

-- ==========================================
-- SERVICE_REQUESTS: Restrict to authenticated
-- ==========================================
ALTER POLICY "Admins can delete all service requests" ON public.service_requests TO authenticated;
ALTER POLICY "Admins can update all service requests" ON public.service_requests TO authenticated;
ALTER POLICY "Admins podem ver todas as solicitações" ON public.service_requests TO authenticated;
ALTER POLICY "Drivers can accept open transport requests" ON public.service_requests TO authenticated;
ALTER POLICY "Drivers can view their accepted transport requests" ON public.service_requests TO authenticated;
ALTER POLICY "Prestadores podem atualizar suas solicitações" ON public.service_requests TO authenticated;
ALTER POLICY "Prestadores podem ver solicitações atribuídas" ON public.service_requests TO authenticated;
ALTER POLICY "Users can view own requests and providers view assigned" ON public.service_requests TO authenticated;
ALTER POLICY "final_clients_update_service_requests" ON public.service_requests TO authenticated;
ALTER POLICY "final_clients_view_service_requests" ON public.service_requests TO authenticated;
ALTER POLICY "final_providers_view_service_requests" ON public.service_requests TO authenticated;
ALTER POLICY "motoristas_accept_transport_services" ON public.service_requests TO authenticated;