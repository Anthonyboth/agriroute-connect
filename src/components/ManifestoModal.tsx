import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface ManifestoModalProps {
  open: boolean;
  onClose: () => void;
  freightId: string;
}

export const ManifestoModal: React.FC<ManifestoModalProps> = ({ open, onClose, freightId }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Manifesto
          </DialogTitle>
          <DialogDescription>
            Área reservada para integração futura do MDFe (Manifesto Eletrônico de Documentos Fiscais).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            O sistema de emissão de MDFe será implementado em breve. Este espaço permitirá:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> Emissão automática de MDFe
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> Consulta de protocolo SEFAZ
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> Encerramento e cancelamento
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> Download de XML e DACTE
            </li>
          </ul>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
