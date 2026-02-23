/**
 * HostOnlyAdminGate
 * 
 * Quando o hostname é do subdomínio admin (painel-2025.*),
 * BLOQUEIA todas as rotas que NÃO começam com /admin-v2 ou /admin-login.
 * - Se não autenticado e fora do /admin-login → redireciona para /admin-login
 * - Se autenticado e fora do /admin-v2 → redireciona para /admin-v2/dashboard
 * 
 * No domínio principal (agriroute-connect.com.br), não faz nada.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ADMIN_ONLY_HOSTNAMES = [
  'painel-2025.agriroute-connect.com.br',
  'www.painel-2025.agriroute-connect.com.br',
];

export function isAdminHostname(hostname: string = window.location.hostname): boolean {
  return ADMIN_ONLY_HOSTNAMES.includes(hostname);
}

export function HostOnlyAdminGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdminHostname()) return;

    const path = location.pathname;

    // Allow admin panel routes
    if (path.startsWith('/admin-v2')) return;

    // Allow admin login page
    if (path === '/admin-login') return;

    // Allow reset-password flow (needed for "Esqueci minha senha")
    if (path === '/reset-password') return;

    // Everything else → redirect to admin login
    console.warn(`[HostOnlyAdminGate] Bloqueando rota ${path} no host admin → /admin-login`);
    navigate('/admin-login', { replace: true });
  }, [location.pathname, navigate]);

  return null;
}
