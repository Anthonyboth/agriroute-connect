import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Banknote, CheckCircle, MessageSquare, AlertTriangle, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { PublicProfileModal } from '@/components/profile/PublicProfileModal';
import { supabase } from '@/integrations/supabase/client';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface Payment {
  id: string;
  freight_id: string;
  producer_id: string;
  amount: number;
  payment_method?: string;
  payment_notes?: string;
  created_at?: string;
  freight?: {
    id: string;
    price?: number;
    pricing_type?: string;
    price_per_km?: number;
    price_per_ton?: number;
    required_trucks?: number;
    weight?: number;
    distance_km?: number;
  };
}

interface DriverPaymentsTabProps {
  pendingPayments: Payment[];
  onConfirmPayment: (payment: { id: string; freight_id: string; producer_id: string }) => void;
  onDisputePayment: (paymentId: string) => void;
}

export const DriverPaymentsTab: React.FC<DriverPaymentsTabProps> = ({
  pendingPayments,
  onConfirmPayment,
  onDisputePayment,
}) => {
  const [profileModal, setProfileModal] = useState<{ open: boolean; userId: string; userName: string }>({
    open: false, userId: '', userName: ''
  });
  const [producerProfiles, setProducerProfiles] = useState<Record<string, { full_name: string; profile_photo_url?: string }>>({});

  // Resolve producer profiles via profiles_secure
  useEffect(() => {
    const producerIds = [...new Set(pendingPayments.map(p => p.producer_id).filter(Boolean))];
    if (producerIds.length === 0) return;

    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles_secure' as any)
        .select('id, full_name, profile_photo_url')
        .in('id', producerIds);
      
      if (data) {
        const map: Record<string, { full_name: string; profile_photo_url?: string }> = {};
        (data as any[]).forEach((p: any) => { map[p.id] = { full_name: p.full_name, profile_photo_url: p.profile_photo_url }; });
        setProducerProfiles(map);
      }
    };
    fetchProfiles();
  }, [pendingPayments]);

  const getUnitPrice = (payment: Payment): string => {
    if (payment.freight) {
      const pd = precoPreenchidoDoFrete(payment.freight.id, {
        price: payment.freight.price || 0,
        pricing_type: payment.freight.pricing_type,
        price_per_km: payment.freight.price_per_km,
        price_per_ton: payment.freight.price_per_ton,
        required_trucks: payment.freight.required_trucks,
        weight: payment.freight.weight,
        distance_km: payment.freight.distance_km,
      }, { unitOnly: true });
      return pd.primaryText;
    }
    return 'Preço indisponível';
  };

  return (
    <SafeListWrapper>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Pagamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum pagamento pendente</h3>
              <p className="text-muted-foreground">
                Quando um produtor confirmar pagamento por fora da plataforma, aparecerá aqui para você confirmar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirme apenas pagamentos já recebidos</AlertTitle>
                <AlertDescription>
                  Verifique se o valor foi realmente creditado antes de confirmar. Se houver problema, use "Contestar".
                </AlertDescription>
              </Alert>
              
              <Separator />
              
              <SafeListWrapper fallback={<div className="p-4 text-muted-foreground">Carregando pagamentos...</div>}>
                {pendingPayments.map((payment) => (
                  <Card key={payment.id} className="bg-card border transition-all hover:shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      {/* Producer info + price */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-transform hover:scale-105"
                            onClick={() => setProfileModal({ 
                              open: true, 
                              userId: payment.producer_id, 
                              userName: producerProfiles[payment.producer_id]?.full_name || 'Produtor' 
                            })}
                            title="Ver perfil do produtor"
                          >
                            <Avatar className="h-11 w-11 ring-2 ring-background shadow-sm cursor-pointer">
                              <SignedAvatarImage src={producerProfiles[payment.producer_id]?.profile_photo_url} />
                              <AvatarFallback className="bg-emerald-500/[0.08] text-emerald-700 text-sm font-semibold">
                                <User className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                          </button>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="font-semibold text-sm text-foreground truncate block hover:text-primary hover:underline transition-colors focus:outline-none"
                              onClick={() => setProfileModal({ 
                                open: true, 
                                userId: payment.producer_id, 
                                userName: producerProfiles[payment.producer_id]?.full_name || 'Produtor' 
                              })}
                              title="Ver perfil do produtor"
                            >
                              {producerProfiles[payment.producer_id]?.full_name || 'Produtor'}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              ID do frete: #{payment.freight_id?.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-foreground shrink-0">
                          {getUnitPrice(payment)}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10"
                          onClick={() => setProfileModal({ 
                            open: true, 
                            userId: payment.producer_id, 
                            userName: producerProfiles[payment.producer_id]?.full_name || 'Produtor' 
                          })}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Ver Perfil
                        </Button>
                        <Button 
                          className="flex-1 h-10"
                          onClick={() => onConfirmPayment({
                            id: payment.id,
                            freight_id: payment.freight_id,
                            producer_id: payment.producer_id
                          })}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirmar Recebimento
                        </Button>
                        <Button 
                          variant="outline"
                          className="h-10"
                          onClick={() => onDisputePayment(payment.id)}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Contestar
                        </Button>
                      </div>

                      {payment.payment_method && (
                        <p className="text-xs text-muted-foreground">
                          Método: {payment.payment_method === 'PIX' ? '💳 PIX' : 
                                  payment.payment_method === 'TED' ? '🏦 TED' : 
                                  payment.payment_method === 'MONEY' ? '💵 Dinheiro' : payment.payment_method}
                          {payment.created_at && ` • ${new Date(payment.created_at).toLocaleDateString('pt-BR')}`}
                        </p>
                      )}

                      {payment.payment_notes && (
                        <div className="bg-muted/30 p-3 rounded-lg border border-border/30">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                          <p className="text-sm text-foreground/80 leading-relaxed">{payment.payment_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </SafeListWrapper>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de perfil público do produtor */}
      <PublicProfileModal
        isOpen={profileModal.open}
        onClose={() => setProfileModal(prev => ({ ...prev, open: false }))}
        userId={profileModal.userId}
        userType="producer"
        userName={profileModal.userName}
      />
    </SafeListWrapper>
  );
};
