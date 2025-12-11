import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook para lidar com o botão de voltar do Android/navegador
 * Permite navegação consistente com gesture de voltar
 */
export const useAndroidBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Função que lida com o evento popstate (voltar do navegador/Android)
    const handlePopState = (event: PopStateEvent) => {
      // Se há estado anterior, deixar o navegador lidar
      if (event.state) {
        return;
      }
      
      // Se estamos numa página que não é a inicial, voltar
      const currentPath = window.location.pathname;
      
      // Se estiver num dashboard, não voltar para auth
      if (currentPath.includes('/dashboard')) {
        // Já está no dashboard - não fazer nada especial
        return;
      }
      
      // Se estiver em auth, ir para landing
      if (currentPath === '/auth') {
        navigate('/', { replace: true });
        return;
      }
    };

    // Adicionar listener para o evento popstate
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, location.pathname]);

  // Função para fechar modais via botão voltar
  const handleBackForModal = (closeModal: () => void) => {
    // Adicionar estado ao histórico quando modal abre
    window.history.pushState({ modal: true }, '');
    
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.modal) {
        closeModal();
      }
    };

    window.addEventListener('popstate', handlePopState, { once: true });

    // Retornar função para limpar quando modal fechar
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Se o estado atual é do modal, voltar ao estado anterior
      if (window.history.state?.modal) {
        window.history.back();
      }
    };
  };

  return { handleBackForModal };
};

export default useAndroidBackButton;
