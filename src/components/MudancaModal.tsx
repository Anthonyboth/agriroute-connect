import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, Building2 } from 'lucide-react';
import { ServiceWizard } from './service-wizard/ServiceWizard';
import { ServiceType } from './service-wizard/types';

interface MudancaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MudancaModal: React.FC<MudancaModalProps> = ({ isOpen, onClose }) => {
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);

  const handleBack = () => {
    if (selectedType) {
      setSelectedType(null);
    } else {
      onClose();
    }
  };

  // Se já selecionou o tipo, mostrar o wizard
  if (selectedType) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <ServiceWizard
            serviceType={selectedType}
            onClose={onClose}
            onSuccess={() => {
              setSelectedType(null);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Senão, mostrar seleção de tipo de mudança
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="absolute left-4 top-4 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <DialogTitle className="flex items-center gap-2 pt-6">
            🏠 Solicitar Mudança
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de mudança que você precisa
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
            onClick={() => setSelectedType('MUDANCA_RESIDENCIAL')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Mudança Residencial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Casa, apartamento ou kitnet. Inclui desmontagem e montagem de móveis.
              </p>
              <Badge variant="secondary">A partir de R$ 200</Badge>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
            onClick={() => setSelectedType('MUDANCA_COMERCIAL')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Mudança Comercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Escritório, loja ou empresa. Profissionais especializados.
              </p>
              <Badge variant="secondary">A partir de R$ 300</Badge>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="text-xs">✓ Embalagem inclusa</Badge>
          <Badge variant="outline" className="text-xs">✓ Seguro opcional</Badge>
          <Badge variant="outline" className="text-xs">✓ Montagem/desmontagem</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MudancaModal;
