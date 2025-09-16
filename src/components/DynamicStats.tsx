import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, Truck, Package, MapPin } from 'lucide-react';

export const DynamicStats: React.FC = () => {
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalProducers: 0,
    totalFreights: 0,
    activeFreights: 0,
    loading: true
  });

  useEffect(() => {
    fetchStats();
    
    // Set up real-time listeners for stats updates
    const driversChannel = supabase
      .channel('drivers-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStats();
      })
      .subscribe();

    const freightsChannel = supabase
      .channel('freights-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(driversChannel);
      supabase.removeChannel(freightsChannel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Use RPC function to bypass RLS and get accurate stats
      const { data, error } = await supabase.rpc('get_public_stats');

      if (!error && data && data.length > 0) {
        const stats = data[0];
        setStats({
          totalDrivers: Number(stats.total_drivers) || 0,
          totalProducers: Number(stats.total_producers) || 0,
          totalFreights: Number(stats.total_freights) || 0,
          activeFreights: Number(stats.active_freights) || 0,
          loading: false
        });
      } else {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  if (stats.loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

  const statsData = [
    {
      title: 'Motoristas',
      value: formatNumber(stats.totalDrivers),
      icon: Truck,
      color: 'text-blue-600'
    },
    {
      title: 'Produtores',
      value: formatNumber(stats.totalProducers),
      icon: Users,
      color: 'text-green-600'
    },
    {
      title: 'Total Fretes',
      value: formatNumber(stats.totalFreights),
      icon: Package,
      color: 'text-purple-600'
    },
    {
      title: 'Fretes Ativos',
      value: formatNumber(stats.activeFreights),
      icon: MapPin,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DynamicStats;