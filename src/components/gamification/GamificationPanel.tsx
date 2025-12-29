import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDriverGamification, Badge as BadgeType, Reward } from '@/hooks/useDriverGamification';
import { Trophy, Star, Gift, Lock, ChevronRight, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface GamificationPanelProps {
  driverId?: string;
  compact?: boolean;
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({ driverId, compact = false }) => {
  const {
    badges,
    levelData,
    rewards,
    earnedBadgesCount,
    totalBadgesCount,
    availableRewardsCount,
    isLoading,
    redeemReward,
    isRedeeming,
  } = useDriverGamification(driverId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (compact) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Nível {levelData.level}</p>
                <p className="text-xs text-muted-foreground">{levelData.total_xp} XP total</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="mb-1">
                {earnedBadgesCount}/{totalBadgesCount} medalhas
              </Badge>
              {availableRewardsCount > 0 && (
                <p className="text-xs text-primary font-medium">
                  {availableRewardsCount} recompensa(s) disponível(is)
                </p>
              )}
            </div>
          </div>
          <Progress value={levelData.progress_percentage} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {levelData.xp_to_next_level} XP para o próximo nível
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Level Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Seu Progresso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white shadow-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{levelData.level}</p>
                <p className="text-xs opacity-80">Nível</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{levelData.total_xp} XP</span>
                <span className="text-xs text-muted-foreground">
                  {levelData.xp_to_next_level} XP para nível {levelData.level + 1}
                </span>
              </div>
              <Progress value={levelData.progress_percentage} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Medalhas
            <Badge variant="outline" className="ml-auto">
              {earnedBadgesCount}/{totalBadgesCount}
            </Badge>
          </CardTitle>
          <CardDescription>Conquiste medalhas completando objetivos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {badges.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rewards Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Recompensas
            {availableRewardsCount > 0 && (
              <Badge className="ml-auto bg-green-500">
                {availableRewardsCount} disponível
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Resgate recompensas com seu progresso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rewards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma recompensa disponível ainda
              </p>
            ) : (
              rewards.map((reward) => (
                <RewardItem 
                  key={reward.id} 
                  reward={reward} 
                  currentLevel={levelData.level}
                  onRedeem={() => redeemReward(reward.id)}
                  isRedeeming={isRedeeming}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const BadgeItem: React.FC<{ badge: BadgeType }> = ({ badge }) => {
  return (
    <div 
      className={`relative flex flex-col items-center p-2 rounded-lg transition-all ${
        badge.is_earned 
          ? 'bg-primary/10 hover:bg-primary/20' 
          : 'bg-muted/50 opacity-50'
      }`}
      title={`${badge.name}: ${badge.description}`}
    >
      <span className="text-2xl">{badge.icon}</span>
      <p className="text-xs text-center mt-1 font-medium truncate w-full">
        {badge.name}
      </p>
      {badge.is_earned && (
        <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center">
          <Star className="h-3 w-3" />
        </Badge>
      )}
    </div>
  );
};

const RewardItem: React.FC<{ 
  reward: Reward; 
  currentLevel: number;
  onRedeem: () => void;
  isRedeeming: boolean;
}> = ({ reward, currentLevel, onRedeem, isRedeeming }) => {
  const isLocked = !reward.is_available;
  const isRedeemed = reward.is_redeemed;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      isRedeemed 
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
        : isLocked 
          ? 'bg-muted/50 border-muted' 
          : 'bg-background border-primary/20 hover:border-primary/40'
    }`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
        isRedeemed ? 'bg-green-100 text-green-600' : isLocked ? 'bg-muted' : 'bg-primary/10'
      }`}>
        {isLocked ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Gift className="h-5 w-5 text-primary" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{reward.name}</p>
        <p className="text-xs text-muted-foreground truncate">{reward.description}</p>
        {isLocked && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Requer nível {reward.required_level}
          </p>
        )}
      </div>

      {!isRedeemed && !isLocked && (
        <Button 
          size="sm" 
          onClick={onRedeem}
          disabled={isRedeeming}
          className="shrink-0"
        >
          Resgatar
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}

      {isRedeemed && (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          Resgatado
        </Badge>
      )}
    </div>
  );
};
