import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getFreightStatusLabel } from '@/lib/freight-status';
import { format, differenceInHours } from 'date-fns';

interface DeliveryConfirmationModalProps {
  freight: {
    id: string;
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    status: string;
    updated_at: string;
    metadata?: any;
    driver?: {
      full_name: string;
      contact_phone: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeliveryConfirmationModal: React.FC<DeliveryConfirmationModalProps> = ({
  freight,
  isOpen,
  onClose,
  onConfirm
}) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Debug do frete recebido
  console.log('DeliveryConfirmationModal - freight recebido:', {
    id: freight.id,
    status: freight.status,
    metadata: freight.metadata,
    updated_at: freight.updated_at
  });

  const confirmDelivery = async () => {
    console.log('=== INICIANDO CONFIRMAÇÃO DE ENTREGA ===');
    console.log('Freight ID:', freight.id);
    console.log('Status atual:', freight.status);
    
    setLoading(true);
    try {
      // Atualizar diretamente o status do frete
      const { error: updateError } = await supabase
        .from('freights')
        .update({ 
          status: 'DELIVERED',
          updated_at: new Date().toISOString(),
          metadata: {
            ...freight.metadata,
            delivery_confirmed_at: new Date().toISOString(),
            confirmed_by_producer: true,
            confirmation_notes: notes
          }
        })
        .eq('id', freight.id)
        .eq('status', 'DELIVERED_PENDING_CONFIRMATION');

      console.log('Resultado da atualização:', updateError);

      if (updateError) {
        console.error('Erro na atualização:', updateError);
        throw new Error(`Erro ao confirmar entrega: ${updateError.message}`);
      }
      
      console.log('=== ENTREGA CONFIRMADA COM SUCESSO ===');

      toast({
        title: "Entrega Confirmada",
        description: "A entrega foi confirmada com sucesso.",
      });
      
      onConfirm();
      onClose();
      
    } catch (error: any) {
      console.error('=== ERRO NA CONFIRMAÇÃO ===', error);
      toast({
        title: "Erro ao confirmar entrega",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!freight.metadata?.confirmation_deadline) {
      console.log('Sem deadline definido no metadata:', freight.metadata);
      return null;
    }
    
    const deadline = new Date(freight.metadata.confirmation_deadline);
    const now = new Date();
    const hoursRemaining = differenceInHours(deadline, now);
    
    console.log('Cálculo de tempo:', {
      deadline: freight.metadata.confirmation_deadline,
      deadlineDate: deadline,
      now,
      hoursRemaining
    });
    
    return {
      hours: Math.max(0, hoursRemaining),
      isUrgent: hoursRemaining <= 24,
      isExpired: hoursRemaining <= 0
    };
  };

  const timeInfo = getTimeRemaining();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle className="h-6 w-6 text-primary" />
            Confirmar Entrega
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status Atual */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Status Atual</p>
                <p className="text-sm text-muted-foreground">
                  {getFreightStatusLabel(freight.status)}
                </p>
              </div>
            </div>
            <Badge variant="secondary">
              Aguardando Sua Confirmação
            </Badge>
          </div>

          {/* Tempo Restante */}
          {timeInfo && (
            <div className={`flex items-center justify-between p-4 rounded-lg ${
              timeInfo.isExpired 
                ? 'bg-destructive/10 border border-destructive/20' 
                : timeInfo.isUrgent 
                  ? 'bg-orange-50 border border-orange-200'
                  : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-5 w-5 ${
                  timeInfo.isExpired 
                    ? 'text-destructive' 
                    : timeInfo.isUrgent 
                      ? 'text-orange-600'
                      : 'text-blue-600'
                }`} />
                <div>
                  <p className="font-medium">
                    {timeInfo.isExpired 
                      ? 'Prazo Expirado' 
                      : `${timeInfo.hours}h restantes`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {timeInfo.isExpired 
                      ? 'O sistema confirmará automaticamente' 
                      : 'Para confirmação manual'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Detalhes do Frete */}
          <div className="space-y-4">
            <h3 className="font-semibold">Detalhes da Entrega</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tipo de Carga</label>
                <p className="font-medium">{freight.cargo_type}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Motorista</label>
                <p className="font-medium">{freight.driver?.full_name || 'N/A'}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Origem</label>
              <p className="font-medium">{freight.origin_address}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Destino</label>
              <p className="font-medium">{freight.destination_address}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Reportado em</label>
              <p className="font-medium">
                {format(new Date(freight.updated_at), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Observações (opcional)
            </label>
            <Textarea
              placeholder="Adicione observações sobre o recebimento da carga..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Importante */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">⚠️ Importante</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Confirme apenas se a carga foi realmente recebida</li>
              <li>• Após a confirmação, o pagamento será processado para o motorista</li>
              <li>• Se não confirmar em 72h, o sistema confirmará automaticamente</li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={confirmDelivery} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Confirmando...' : 'Confirmar Entrega'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};