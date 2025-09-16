import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

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
      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0] as any;
        setStats({
          totalProducers: Number(row.produtores) || 0,
          totalDrivers: Number(row.motoristas) || 0,
          totalWeight: Math.round(Number(row.peso_total) || 0),
          averageRating: Math.round(((Number(row.avaliacao_media) || 0) * 10)) / 10,
          loading: false,
        });
      } else {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    } catch (e) {
      console.error('Erro ao buscar estatísticas da plataforma:', e);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, 30000);

    const channel = supabase
      .channel('platform-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, fetchStats)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');
  const formatWeight = (kg: number) => {
    if (kg <= 0) return '0 ton';
    // Keep the same UX used na landing: exibir em "k ton"
    return `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k ton`;
  };

  if (stats.loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
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
      {items.map((stat, index) => (
        <Card key={index} className="text-center shadow-card">
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

