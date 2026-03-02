import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Calendar, User, TrendingUp, MessageSquare, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Rating {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  rater_name?: string;
  service_type?: string;
  rating_type: string;
}

interface RatingStats {
  average: number;
  total: number;
  distribution: Record<number, number>;
  totalPending: number;
}

export const RatingsHistoryPanel: React.FC = () => {
  const { profile } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<RatingStats>({
    average: 0,
    total: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    totalPending: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('received');

  useEffect(() => {
    if (!profile) return;
    fetchRatings();
  }, [profile]);

  const fetchRatings = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      // Buscar avaliações recebidas (service_ratings)
      const { data: serviceRatings, error: serviceError } = await supabase
        .from('service_ratings')
        .select('id, rating, comment, created_at, rating_type, rater_id, service_request_id')
        .eq('rated_user_id', profile.id)
        .order('created_at', { ascending: false });

      if (serviceError) throw serviceError;

      // Buscar avaliações de frete recebidas
      const { data: freightRatings, error: freightError } = await supabase
        .from('freight_ratings')
        .select('id, rating, comment, created_at, rating_type, rater_id, freight_id')
        .eq('rated_user_id', profile.id)
        .order('created_at', { ascending: false });

      if (freightError) throw freightError;

      // Combinar e mapear
      const allRaterIds = [
        ...(serviceRatings || []).map(r => r.rater_id),
        ...(freightRatings || []).map(r => r.rater_id)
      ].filter(Boolean);

      const { data: raterProfiles } = await supabase
        .from('profiles_secure')
        .select('id, full_name')
        .in('id', allRaterIds);

      const ratersMap = new Map((raterProfiles || []).map(p => [p.id, p.full_name]));

      // Buscar tipos de serviço
      const serviceIds = (serviceRatings || []).map(r => r.service_request_id).filter(Boolean);
      const { data: services } = await supabase
        .from('service_requests')
        .select('id, service_type')
        .in('id', serviceIds);
      
      const servicesMap = new Map((services || []).map(s => [s.id, s.service_type]));

      const combinedRatings: Rating[] = [
        ...(serviceRatings || []).map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          rater_name: ratersMap.get(r.rater_id) || 'Cliente',
          service_type: servicesMap.get(r.service_request_id) || 'Serviço',
          rating_type: r.rating_type
        })),
        ...(freightRatings || []).map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          rater_name: ratersMap.get(r.rater_id) || 'Cliente',
          service_type: 'Frete',
          rating_type: r.rating_type
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRatings(combinedRatings);

      // Calcular estatísticas
      const total = combinedRatings.length;
      const sum = combinedRatings.reduce((acc, r) => acc + r.rating, 0);
      const average = total > 0 ? sum / total : 0;

      const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      combinedRatings.forEach(r => {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
      });

      setStats({
        average,
        total,
        distribution,
        totalPending: 0
      });

    } catch (error) {
      console.error('Erro ao buscar avaliações:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Média Geral */}
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/10 border-yellow-200/50">
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-bold text-yellow-600 mb-2">
              {stats.average.toFixed(1)}
            </div>
            <div className="flex justify-center mb-2">
              {renderStars(Math.round(stats.average), 'lg')}
            </div>
            <p className="text-sm text-muted-foreground">Média geral</p>
          </CardContent>
        </Card>

        {/* Total de Avaliações */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold mb-2">{stats.total}</div>
            <p className="text-sm text-muted-foreground mb-4">Total de avaliações</p>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.distribution[rating] || 0;
                const perc = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-2">
                    <span className="w-6 text-sm text-muted-foreground">{rating}★</span>
                    <Progress value={perc} className="flex-1 h-2" />
                    <span className="w-8 text-xs text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Reputação</p>
                <p className="text-xs text-muted-foreground">
                  {stats.average >= 4.5 ? 'Excelente' : 
                   stats.average >= 4.0 ? 'Muito Boa' : 
                   stats.average >= 3.0 ? 'Boa' : 'Em construção'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Com comentários</p>
                <p className="text-xs text-muted-foreground">
                  {ratings.filter(r => r.comment).length} avaliações
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Avaliações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Histórico de Avaliações
          </CardTitle>
          <CardDescription>
            Todas as avaliações que você recebeu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ratings.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Nenhuma avaliação recebida ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete serviços para receber avaliações dos clientes
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {ratings.map((rating) => (
                <div key={rating.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1.5 rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{rating.rater_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rating.rating_type?.includes('CLIENT') ? 'Cliente' : 
                             rating.rating_type?.includes('PRODUCER') ? 'Produtor' :
                             rating.rating_type?.includes('DRIVER') ? 'Motorista' :
                             rating.rating_type?.includes('COMPANY') ? 'Transportadora' : 'Usuário'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {rating.service_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-2 ml-9">
                        {renderStars(rating.rating)}
                        <span className="text-sm font-medium">{rating.rating.toFixed(1)}</span>
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg ml-9">
                          "{rating.comment}"
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(rating.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
