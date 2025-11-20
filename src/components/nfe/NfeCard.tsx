import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NFeDocument } from '@/types/nfe';
import { FileText, Building2, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NfeCardProps {
  nfe: NFeDocument;
  onManifest?: () => void;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-500' },
  manifested: { label: 'Manifestada', color: 'bg-green-500' },
  rejected: { label: 'Rejeitada', color: 'bg-red-500' },
  cancelled: { label: 'Cancelada', color: 'bg-gray-500' },
};

export function NfeCard({ nfe, onManifest }: NfeCardProps) {
  const status = statusConfig[nfe.status] || statusConfig.pending;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            NF-e {nfe.number}
          </CardTitle>
          <Badge className={`${status.color} text-white`}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{nfe.issuer_name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            CNPJ: {nfe.issuer_cnpj}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(nfe.issue_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">R$ {nfe.value.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Série: {nfe.series} | Número: {nfe.number}
        </div>

        {nfe.status === 'pending' && onManifest && (
          <Button onClick={onManifest} className="w-full mt-4">
            Manifestar NF-e
          </Button>
        )}

        {nfe.status === 'manifested' && (
          <div className="flex items-center gap-2 text-sm text-green-600 mt-4 p-2 bg-green-50 rounded">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Manifestada em {format(new Date(nfe.manifestation_date!), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
