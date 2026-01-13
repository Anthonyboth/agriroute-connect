import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileSpreadsheet, 
  FileKey,
  Construction
} from 'lucide-react';

interface MdfeEmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalIssuer: any;
}

export const MdfeEmissionWizard: React.FC<MdfeEmissionWizardProps> = ({
  isOpen,
  onClose,
  fiscalIssuer,
}) => {
  const hasCertificate = !!fiscalIssuer?.certificate_uploaded_at;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-purple-600" />
            Emitir MDF-e
          </DialogTitle>
          <DialogDescription>
            Manifesto de Documentos Fiscais Eletrônico
          </DialogDescription>
        </DialogHeader>

        {!hasCertificate ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <FileKey className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <p className="font-medium mb-2">Certificado Digital Necessário</p>
              <p className="text-sm">
                Para emitir MDF-e, é necessário fazer upload do seu certificado digital A1.
                Acesse a aba "Emissor" para configurar.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Construction className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Em Desenvolvimento</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                O wizard de emissão de MDF-e está em desenvolvimento. 
                Por enquanto, utilize o sistema existente de emissão via Focus NFe.
              </p>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
