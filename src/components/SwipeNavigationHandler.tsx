import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

/**
 * Global component that enables swipe-to-go-back navigation on mobile.
 * Must be placed inside BrowserRouter.
 */
export function SwipeNavigationHandler() {
  useSwipeNavigation({
    enabled: true,
    threshold: 80,
    maxVerticalMovement: 100,
    disabledRoutes: [
      '/',
      '/landing',
      '/auth',
      '/complete-profile',
      '/cadastro-motorista',
      '/cadastro-motorista-afiliado',
      '/cadastro-prestador'
    ]
  });

  return null;
}

export default SwipeNavigationHandler;
