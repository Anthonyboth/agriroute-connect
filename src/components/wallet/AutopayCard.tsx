import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, CheckCircle2, Clock, ArrowDownCircle, Info, ShieldCheck } from 'lucide-react';
import { useAutopay } from '@/hooks/useAutopay';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const AutopayCard: React.FC = () => {
  const { settings, logs, loading, toggleAutopay, updateSettings } = useAutopay();
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    try {
      setToggling(true);
      await toggleAutopay(enabled);
      toast.success(enabled ? 'Autopay ativado!' : 'Autopay desativado');
    } catch {
      toast.error('Erro ao alterar autopay');
    } finally {
      setToggling(false);
    }
  };

  const handleMaxPercentChange = async (value: number[]) => {
    try {
      await updateSettings({ max_auto_deduct_percent: value[0] } as any);
    } catch {
      toast.error('Erro ao atualizar configuração');
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  const isEnabled = settings?.enabled ?? false;
  const maxPercent = settings?.max_auto_deduct_percent ?? 50;
  const totalAutoDeducted = logs.reduce((s, l) => s + l.amount, 0);

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-warning/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-warning/15 p-2">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Autopay Inteligente</CardTitle>
              <CardDescription className="text-xs">Pagamento automático de parcelas</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isEnabled ? 'default' : 'secondary'} className="text-[10px]">
              {isEnabled ? 'Ativo' : 'Inativo'}
            </Badge>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Explanation */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Quando ativado, parcelas de crédito são pagas automaticamente ao receber valores liberados de fretes, evitando inadimplência.
          </p>
        </div>

        {isEnabled && (
          <>
            {/* Max deduction slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Limite de dedução automática</Label>
                <span className="text-xs font-semibold text-foreground">{maxPercent}%</span>
              </div>
              <Slider
                value={[maxPercent]}
                onValueCommit={handleMaxPercentChange}
                min={10}
                max={80}
                step={10}
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground">
                Até {maxPercent}% de cada valor liberado será usado para pagar parcelas automaticamente
              </p>
            </div>

            <Separator />

            {/* Security badge */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                Deduções registradas no ledger financeiro com auditoria completa
              </p>
            </div>

            {/* Recent autopay logs */}
            {logs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Pagamentos automáticos recentes
                </p>
                <div className="space-y-1">
                  {logs.slice(0, 5).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                        <div>
                          <p className="text-[11px] font-medium text-foreground">
                            {log.deduction_type === 'credit_installment' ? 'Parcela de crédito' : 'Taxa'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-destructive">-{formatBRL(log.amount)}</span>
                    </div>
                  ))}
                </div>
                {totalAutoDeducted > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Total deduzido automaticamente: <strong>{formatBRL(totalAutoDeducted)}</strong>
                  </p>
                )}
              </div>
            )}

            {logs.length === 0 && (
              <div className="text-center py-3">
                <Clock className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1" />
                <p className="text-[11px] text-muted-foreground">Nenhum pagamento automático realizado ainda</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
