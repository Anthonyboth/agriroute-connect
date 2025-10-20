// src/components/PlatformStatsSection.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOptimizedStats } from '@/hooks/useOptimizedStats';
import { formatTonsCompactFromKg } from '@/lib/utils';

export const PlatformStatsSection: React.FC = () => {
  const { stats, isLoading } = useOptimizedStats();

  if (isLoading) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Números</h2>
            <p className="text-muted-foreground text-lg">
              Resultados que comprovam nossa excelência
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-6 md:p-8">
                <div className="flex flex-col items-center text-center space-y-2">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const statsData = [
    {
      label: 'Produtores Conectados',
      value: stats.activeProducers || 0,
    },
    {
      label: 'Motoristas Ativos',
      value: stats.activeDrivers || 0,
    },
    {
      label: 'Toneladas Transportadas',
      value: formatTonsCompactFromKg(stats.totalWeight || 0),
    },
    {
      label: 'Avaliação Média',
      value: `${(stats.averageRating || 0).toFixed(1)}★`,
    },
  ];

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Números</h2>
          <p className="text-muted-foreground text-lg">
            Resultados que comprovam nossa excelência
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
          {statsData.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-6 md:p-8"
            >
              <div className="flex flex-col items-center text-center">
                {/* Removido font-extrabold -> font-normal para números */}
                <p className="text-4xl md:text-5xl font-normal text-primary leading-tight mb-2">
                  {stat.value}
                </p>
                <p className="text-sm md:text-base font-medium text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
