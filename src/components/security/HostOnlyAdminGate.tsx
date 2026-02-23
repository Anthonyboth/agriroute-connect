/**
 * HostOnlyAdminGate
 * 
 * Quando o hostname é do subdomínio admin (painel-2025.*),
 * BLOQUEIA todas as rotas que NÃO começam com /admin-v2.
 * Redireciona automaticamente para /admin-v2/dashboard.
 * 
 * No domínio principal (agriroute-connect.com.br), não faz nada.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ADMIN_ONLY_HOSTNAMES = [
  'painel-2025.agriroute-connect.com.br',
  'www.painel-2025.agriroute-connect.com.br',
];

export function HostOnlyAdminGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hostname = window.location.hostname;
    if (!ADMIN_ONLY_HOSTNAMES.includes(hostname)) return;

    // Allow /admin-v2/* routes
    if (location.pathname.startsWith('/admin-v2')) return;

    // Allow /auth for login flow
    if (location.pathname === '/auth') return;

    // Everything else → redirect to admin dashboard
    console.warn(`[HostOnlyAdminGate] Bloqueando rota ${location.pathname} no host admin → /admin-v2/dashboard`);
    navigate('/admin-v2/dashboard', { replace: true });
  }, [location.pathname, navigate]);

  return null;
}
