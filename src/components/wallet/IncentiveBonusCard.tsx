import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, Flame, MapPin, Clock, Zap, Shield,
  ChevronRight, Gift, Star
} from 'lucide-react';
import { useIncentives, type IncentiveWithProgress } from '@/hooks/useIncentives';

const INCENTIVE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  sequence: { icon: <Flame className="h-4 w-4" />, color: 'text-orange-500', label: 'Sequência' },
  region: { icon: <MapPin className="h-4 w-4" />, color: 'text-blue-500', label: 'Região' },
  time_slot: { icon: <Clock className="h-4 w-4" />, color: 'text-purple-500', label: 'Horário' },
  urgent: { icon: <Zap className="h-4 w-4" />, color: 'text-destructive', label: 'Urgente' },
  reliability: { icon: <Shield className="h-4 w-4" />, color: 'text-primary', label: 'Confiabilidade' },
};

const BONUS_TYPE_LABELS: Record<string, string> = {
  cash: 'Saldo',
  credit: 'Crédito',
  cashback: 'Cashback',
};

interface IncentiveBonusCardProps {
  role: string;
}

export const IncentiveBonusCard: React.FC<IncentiveBonusCardProps> = ({ role }) => {
  const { activeBonuses, completedUnclaimed, totalUnclaimedBonus, loading } = useIncentives();

  // Only show for drivers
  if (role === 'PRODUTOR') return null;
  if (loading) return null;
  if (activeBonuses.length === 0 && completedUnclaimed.length === 0) return null;

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-4.5 w-4.5 text-accent" />
            Incentivos & Bônus
          </CardTitle>
          {totalUnclaimedBonus > 0 && (
            <Badge className="bg-accent/15 text-accent border-accent/25 text-xs font-semibold">
              {formatBRL(totalUnclaimedBonus)} disponível
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Complete metas e ganhe bônus direto na carteira
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Completed unclaimed bonuses */}
        {completedUnclaimed.map(item => (
          <CompletedBonusBanner key={item.campaign.id} item={item} formatBRL={formatBRL} />
        ))}

        {/* Active campaigns with progress */}
        {activeBonuses
          .filter(i => !i.progress?.is_completed)
          .slice(0, 4)
          .map(item => (
            <ActiveCampaignRow key={item.campaign.id} item={item} formatBRL={formatBRL} />
          ))}

        {activeBonuses.length === 0 && completedUnclaimed.length === 0 && (
          <div className="text-center py-4">
            <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum incentivo ativo no momento</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Completed bonus ready to claim ─── */
const CompletedBonusBanner: React.FC<{
  item: IncentiveWithProgress;
  formatBRL: (v: number) => string;
}> = ({ item, formatBRL }) => {
  const config = INCENTIVE_CONFIG[item.campaign.incentive_type] || INCENTIVE_CONFIG.sequence;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/[0.08] border border-accent/20 animate-in slide-in-from-top-1">
      <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
        <Gift className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Bônus desbloqueado!</p>
        <p className="text-xs text-muted-foreground truncate">{item.campaign.name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-accent">{formatBRL(item.progress?.bonus_amount || item.campaign.bonus_amount)}</p>
        <Badge variant="outline" className="text-[10px]">
          {BONUS_TYPE_LABELS[item.campaign.bonus_type] || 'Saldo'}
        </Badge>
      </div>
    </div>
  );
};

/* ─── Active campaign with progress bar ─── */
const ActiveCampaignRow: React.FC<{
  item: IncentiveWithProgress;
  formatBRL: (v: number) => string;
}> = ({ item, formatBRL }) => {
  const { campaign, progress } = item;
  const config = INCENTIVE_CONFIG[campaign.incentive_type] || INCENTIVE_CONFIG.sequence;

  const current = progress?.current_count || 0;
  const required = progress?.required_count || campaign.required_count || 1;
  const pct = Math.min((current / required) * 100, 100);
  const remaining = Math.max(required - current, 0);

  return (
    <div className="p-3 rounded-lg border border-border/40 bg-background hover:bg-muted/20 transition-all space-y-2">
      <div className="flex items-center gap-2.5">
        <div className={`${config.color} shrink-0`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
          {campaign.description && (
            <p className="text-[11px] text-muted-foreground truncate">{campaign.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{formatBRL(campaign.bonus_amount)}</p>
          <Badge variant="outline" className="text-[10px]">
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={pct} className="h-1.5" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {current} / {required} {campaign.incentive_type === 'sequence' ? 'fretes' : 'concluídos'}
          </span>
          {remaining > 0 && (
            <span className="text-[11px] font-medium text-accent">
              Falta{remaining > 1 ? 'm' : ''} {remaining}
            </span>
          )}
        </div>
      </div>

      {/* Region / time context */}
      {campaign.target_region_name && (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{campaign.target_region_name}</span>
        </div>
      )}
      {campaign.time_slot_start && campaign.time_slot_end && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {campaign.time_slot_start.slice(0, 5)} – {campaign.time_slot_end.slice(0, 5)}
          </span>
        </div>
      )}
    </div>
  );
};
