import { useLocation, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '': 'Início',
  'dashboard': 'Painel',
  'driver': 'Motorista',
  'producer': 'Produtor',
  'company': 'Transportadora',
  'service-provider': 'Prestador de Serviços',
  'complete-profile': 'Completar Perfil',
  'auth': 'Autenticação',
  'services': 'Serviços',
  'plans': 'Planos',
  'about': 'Sobre',
  'privacidade': 'Privacidade',
  'termos': 'Termos de Uso',
  'cookies': 'Cookies',
  'help': 'Ajuda',
  'status': 'Status',
  'careers': 'Carreiras',
};

interface AppBreadcrumbProps {
  className?: string;
  showHome?: boolean;
}

export function AppBreadcrumb({ className, showHome = true }: AppBreadcrumbProps) {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Não mostrar breadcrumb na landing page OU em páginas de dashboard (segurança - esconder tipo de usuário)
  if (pathnames.length === 0 || pathnames[0] === 'dashboard') {
    return null;
  }

  const breadcrumbItems = pathnames.map((value, index) => {
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    const isLast = index === pathnames.length - 1;
    const label = routeLabels[value] || value.charAt(0).toUpperCase() + value.slice(1);

    return { to, label, isLast };
  });

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {showHome && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="flex items-center gap-1.5" aria-label="Ir para página inicial">
                  <Home className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">Início</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        
        {breadcrumbItems.map((item, index) => (
          <BreadcrumbItem key={item.to}>
            {item.isLast ? (
              <BreadcrumbPage>{item.label}</BreadcrumbPage>
            ) : (
              <>
                <BreadcrumbLink asChild>
                  <Link to={item.to}>{item.label}</Link>
                </BreadcrumbLink>
                <BreadcrumbSeparator />
              </>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
