import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-handler';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ShareFreightToCompanyProps {
  freight: {
    id: string;
    cargo_type: string;
    weight?: number;
    origin_address: string;
    destination_address: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    pickup_date: string;
    delivery_date: string;
    price: number;
    minimum_antt_price?: number;
    urgency: string;
    status: string;
    service_type?: string;
    distance_km?: number;
    required_trucks?: number;
    accepted_trucks?: number;
  };
  companyId?: string;
  driverProfile?: {
    id: string;
    full_name?: string;
  };
}

export const ShareFreightToCompany: React.FC<ShareFreightToCompanyProps> = ({
  freight,
  companyId,
  driverProfile
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!companyId) {
      toast.error('Transportadora não encontrada');
      return;
    }

    if (!driverProfile?.id) {
      toast.error('Perfil do motorista não encontrado');
      return;
    }

    setSharing(true);
    
    try {
      // Buscar nome da transportadora
      const { data: companyData, error: companyError } = await supabase
        .from('transport_companies')
        .select('company_name')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      // Construir mensagem estruturada com TODOS os dados do frete
      const freightShareMessage = {
        type: 'FREIGHT_SHARE',
        // Dados completos do frete para renderização do FreightCard
        freight_id: freight.id,
        cargo_type: freight.cargo_type,
        weight: freight.weight || 0,
        origin_address: freight.origin_address,
        destination_address: freight.destination_address,
        origin_city: freight.origin_city,
        origin_state: freight.origin_state,
        destination_city: freight.destination_city,
        destination_state: freight.destination_state,
        pickup_date: freight.pickup_date,
        delivery_date: freight.delivery_date,
        price: freight.price,
        minimum_antt_price: freight.minimum_antt_price || 0,
        distance_km: freight.distance_km || 0,
        urgency: freight.urgency,
        service_type: freight.service_type || 'CARGA',
        status: 'OPEN', // Sempre OPEN quando compartilhado
        required_trucks: freight.required_trucks || 1,
        accepted_trucks: freight.accepted_trucks || 0,
        // Metadados do compartilhamento
        shared_by: driverProfile.full_name || 'Motorista',
        shared_at: new Date().toISOString()
      };

      // Inserir mensagem no chat interno da transportadora
      const { error: messageError } = await supabase
        .from('company_internal_messages')
        .insert({
          company_id: companyId,
          sender_id: driverProfile.id,
          message: JSON.stringify(freightShareMessage),
          message_type: 'SYSTEM'
        });

      if (messageError) throw messageError;

      toast.success(
        `Frete compartilhado com ${companyData.company_name}!`,
        {
          description: 'A transportadora receberá a informação no chat interno e poderá aceitar ou negociar.'
        }
      );
      
      setShowConfirmDialog(false);
    } catch (error: any) {
      console.error('Erro ao compartilhar frete:', error);
      showErrorToast(toast, 'Erro ao compartilhar frete', error);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowConfirmDialog(true)}
        className="flex-1 gradient-primary hover:shadow-lg transition-all duration-300"
        size="sm"
      >
        <Share2 className="h-4 w-4 mr-2" />
        Compartilhar com Transportadora
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compartilhar Frete com Transportadora</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Deseja compartilhar este frete com sua transportadora?
                </p>
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-1 text-sm">
                  <p><strong>Origem:</strong> {freight.origin_address}</p>
                  <p><strong>Destino:</strong> {freight.destination_address}</p>
                  <p><strong>Valor:</strong> R$ {freight.price.toLocaleString('pt-BR')}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  A transportadora receberá esta informação no chat interno e decidirá se aceita o frete ou faz uma contraproposta ao produtor.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sharing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleShare}
              disabled={sharing}
              className="gradient-primary"
            >
              {sharing ? 'Compartilhando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
