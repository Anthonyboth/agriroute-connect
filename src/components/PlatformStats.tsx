import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatTonsCompactFromKg } from '@/lib/utils';

interface PlatformStatsData {
  totalProducers: number;
  totalDrivers: number;
  totalWeight: number; // in kg (as returned by RPC)
  averageRating: number;
  loading: boolean;
}

const PlatformStats: React.FC = () => {
  const [stats, setStats] = useState<PlatformStatsData>({
    totalProducers: 0,
    totalDrivers: 0,
    totalWeight: 0,
    averageRating: 0,
    loading: true,
  });

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_platform_stats');
      
      if (!error && data && data.length > 0) {
        const row = data[0] as any;
        setStats({
          totalProducers: Number(row.produtores) || 0,
          totalDrivers: Number(row.motoristas) || 0,
          totalWeight: Math.round(Number(row.peso_total) || 0),
          averageRating: Math.round(((Number(row.avaliacao_media) || 0) * 10)) / 10,
          loading: false,
        });
      } else {
        console.error('Erro ao buscar estatísticas:', error);
        setStats({
          totalProducers: 0,
          totalDrivers: 0,
          totalWeight: 0,
          averageRating: 0,
          loading: false,
        });
      }
    } catch (e) {
      console.error('Erro ao buscar estatísticas:', e);
      setStats({
        totalProducers: 0,
        totalDrivers: 0,
        totalWeight: 0,
        averageRating: 0,
        loading: false,
      });
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');
  const formatWeight = (kg: number) => formatTonsCompactFromKg(kg);

  if (stats.loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[...Array(4)].map((_, i) => (
          <Card key={`loading-skeleton-${i}`}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    { value: formatNumber(stats.totalProducers), label: 'Produtores Conectados' },
    { value: formatNumber(stats.totalDrivers), label: 'Motoristas Ativos' },
    { value: formatWeight(stats.totalWeight), label: 'Toneladas Transportadas' },
    { value: `${stats.averageRating.toFixed(1)}★`, label: 'Avaliação Média' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {items.map((stat) => (
        <Card key={stat.label} className="text-center shadow-card">
          <CardContent className="p-6">
            <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
              {stat.value}
            </div>
            <div className="text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PlatformStats;

