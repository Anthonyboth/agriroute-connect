import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star, Gift, Trophy, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserLoyalty {
  total_points: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  completed_freights: number;
}

interface LoyaltyPoint {
  id: string;
  points: number;
  action_type: string;
  description: string;
  created_at: string;
}

interface ReferralCode {
  id: string;
  code: string;
  referral_bonus: number;
  uses: number;
  max_uses: number;
  active: boolean;
}

export const LoyaltyProgram = () => {
  const [userLoyalty, setUserLoyalty] = useState<UserLoyalty | null>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyPoint[]>([]);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const tierColors = {
    BRONZE: 'bg-amber-600',
    SILVER: 'bg-gray-400',
    GOLD: 'bg-yellow-500'
  };

  const tierRequirements = {
    BRONZE: { points: 0, name: 'Bronze' },
    SILVER: { points: 500, name: 'Prata' },
    GOLD: { points: 1000, name: 'Ouro' }
  };

  const fetchLoyaltyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Fetch user loyalty status
      const { data: loyaltyData } = await supabase
        .from('user_loyalty')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (loyaltyData) {
        setUserLoyalty(loyaltyData as UserLoyalty);
      }

      // Fetch loyalty points history
      const { data: pointsHistory } = await supabase
        .from('loyalty_points')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (pointsHistory) {
        setLoyaltyHistory(pointsHistory);
      }

      // Fetch referral code
      const { data: referralData } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', profile.id)
        .eq('active', true)
        .single();

      if (referralData) {
        setReferralCode(referralData);
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    }
  };

  const createReferralCode = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Generate unique referral code
      const code = `${profile.full_name.split(' ')[0].toUpperCase()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const { error } = await supabase
        .from('referral_codes')
        .insert([{
          user_id: profile.id,
          code: code,
          referral_bonus: 100,
          max_uses: 10
        }]);

      if (error) throw error;

      fetchLoyaltyData();
      toast({
        title: "Sucesso",
        description: "Código de indicação criado com sucesso!",
      });
    } catch (error) {
      console.error('Error creating referral code:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar código de indicação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode.code);
      toast({
        title: "Sucesso",
        description: "Código copiado para a área de transferência!",
      });
    }
  };

  const getNextTier = (currentTier: string) => {
    if (currentTier === 'BRONZE') return 'SILVER';
    if (currentTier === 'SILVER') return 'GOLD';
    return null;
  };

  const getProgressToNextTier = () => {
    if (!userLoyalty) return 0;
    
    const nextTier = getNextTier(userLoyalty.tier);
    if (!nextTier) return 100;
    
    const currentPoints = userLoyalty.total_points;
    const nextTierPoints = tierRequirements[nextTier as keyof typeof tierRequirements].points;
    const currentTierPoints = tierRequirements[userLoyalty.tier].points;
    
    return ((currentPoints - currentTierPoints) / (nextTierPoints - currentTierPoints)) * 100;
  };

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  if (!userLoyalty) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Carregando informações do programa de fidelidade...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextTier = getNextTier(userLoyalty.tier);
  const progress = getProgressToNextTier();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Programa de Fidelidade</h1>
      </div>

      {/* Status do Usuário */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Seu Nível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-3">
              <Badge className={`${tierColors[userLoyalty.tier]} text-white text-lg px-4 py-2`}>
                {tierRequirements[userLoyalty.tier].name}
              </Badge>
              <div>
                <p className="text-2xl font-bold">{userLoyalty.total_points}</p>
                <p className="text-sm text-muted-foreground">pontos acumulados</p>
              </div>
              {nextTier && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Próximo nível: {tierRequirements[nextTier as keyof typeof tierRequirements].name}</span>
                    <span>{tierRequirements[nextTier as keyof typeof tierRequirements].points - userLoyalty.total_points} pontos</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{userLoyalty.completed_freights}</p>
                <p className="text-sm text-muted-foreground">fretes concluídos</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {Math.round(userLoyalty.total_points / Math.max(userLoyalty.completed_freights, 1))}
                </p>
                <p className="text-sm text-muted-foreground">pontos por frete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Indicações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referralCode ? (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Seu código:</p>
                  <p className="text-lg font-mono font-bold">{referralCode.code}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyReferralCode}
                    className="mt-2"
                  >
                    Copiar Código
                  </Button>
                </div>
                <div className="text-center">
                  <p className="text-sm">
                    <span className="font-semibold">{referralCode.uses}</span>
                    <span className="text-muted-foreground">/{referralCode.max_uses} usos</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{referralCode.referral_bonus} pontos por indicação
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Crie seu código de indicação e ganhe pontos!
                </p>
                <Button 
                  onClick={createReferralCode} 
                  disabled={loading}
                  size="sm"
                >
                  {loading ? 'Criando...' : 'Criar Código'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Pontos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Histórico de Pontos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loyaltyHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma atividade de pontos encontrada
              </p>
            ) : (
              loyaltyHistory.map((point) => (
                <div key={point.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{point.description || point.action_type}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(point.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </p>
                  </div>
                  <Badge 
                    variant={point.points > 0 ? "default" : "destructive"}
                    className="font-bold"
                  >
                    {point.points > 0 ? '+' : ''}{point.points} pts
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informações sobre o Programa */}
      <Card>
        <CardHeader>
          <CardTitle>Como Funciona o Programa de Fidelidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Como Ganhar Pontos:</h3>
              <ul className="space-y-2 text-sm">
                <li>• <strong>Frete concluído:</strong> 50 pontos</li>
                <li>• <strong>Indicação bem-sucedida:</strong> 100 pontos</li>
                <li>• <strong>Primeira viagem:</strong> 25 pontos bônus</li>
                <li>• <strong>Avaliação 5 estrelas:</strong> 10 pontos</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Benefícios por Nível:</h3>
              <ul className="space-y-2 text-sm">
                <li>• <strong>Bronze:</strong> Acesso básico</li>
                <li>• <strong>Prata:</strong> 5% desconto em taxas</li>
                <li>• <strong>Ouro:</strong> 10% desconto + suporte prioritário</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};