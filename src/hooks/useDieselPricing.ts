import { useQuery } from '@tanstack/react-query';
import { DieselPricingService } from '@/services/dieselPricingService';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const useDieselPricing = () => {
  const { userCategory } = useSubscription();
  
  // Busca preço atual do diesel
  const { data: dieselPrice, isLoading: loadingDiesel } = useQuery({
    queryKey: ['diesel-price'],
    queryFn: () => DieselPricingService.getCurrentDieselPrice(),
    staleTime: 1000 * 60 * 60, // 1 hora
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // ❌ REMOVIDO: refetchInterval - preço de diesel não muda frequentemente
  });

  // Calcula todas categorias
  const { data: allPricing, isLoading: loadingPricing } = useQuery({
    queryKey: ['diesel-pricing-all', dieselPrice],
    queryFn: () => DieselPricingService.calculateAllCategories(),
    enabled: !!dieselPrice,
    staleTime: 1000 * 60 * 60,
  });

  // Categoria do usuário atual
  const userVehicleCategory = userCategory 
    ? DieselPricingService.mapUserCategoryToVehicle(userCategory)
    : 'PICKUP';

  const userPricing = allPricing?.[userVehicleCategory];

  return {
    dieselPrice,
    allPricing,
    userPricing,
    userVehicleCategory,
    isLoading: loadingDiesel || loadingPricing,
  };
};
