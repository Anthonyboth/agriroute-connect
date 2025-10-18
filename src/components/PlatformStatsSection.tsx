import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOptimizedStats } from '@/hooks/useOptimizedStats';
import { formatTonsCompactFromKg } from '@/lib/utils';
import { Users, Truck, Package, Star } from 'lucide-react';

export const PlatformStatsSection: React.FC = () => {
  const { stats, isLoading } = useOptimizedStats();

  if (isLoading) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Números</h2>
            <p className="text-muted-foreground text-lg">
              O impacto da AgriRoute no agronegócio brasileiro
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-sm p-5 md:p-6">
                <Skeleton className="h-8 w-8 mb-3" />
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const statsData = [
    {
      icon: <Users className="h-8 w-8" />,
      label: 'Produtores Conectados',
      value: stats.activeProducers || 0,
      iconColor: 'text-emerald-600',
    },
    {
      icon: <Truck className="h-8 w-8" />,
      label: 'Motoristas Ativos',
      value: stats.activeDrivers || 0,
      iconColor: 'text-blue-600',
    },
    {
      icon: <Package className="h-8 w-8" />,
      label: 'Toneladas Transportadas',
      value: formatTonsCompactFromKg(stats.totalWeight || 0),
      iconColor: 'text-purple-600',
    },
    {
      icon: <Star className="h-8 w-8" />,
      label: 'Avaliação Média',
      value: `${(stats.averageRating || 0).toFixed(1)}★`,
      iconColor: 'text-amber-500',
    },
  ];

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Números</h2>
          <p className="text-muted-foreground text-lg">
            O impacto da AgriRoute no agronegócio brasileiro
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto animate-fade-in">
          {statsData.map((stat, index) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-all p-5 md:p-6 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`mb-3 ${stat.iconColor}`}>
                {stat.icon}
              </div>
              <p className="text-4xl md:text-5xl font-extrabold text-emerald-600 leading-tight">
                {stat.value}
              </p>
              <p className="mt-1 text-sm md:text-base font-medium text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
