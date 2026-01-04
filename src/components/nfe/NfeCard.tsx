import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NFeDocument, ManifestationType } from '@/types/nfe';
import { FileText, Building2, Calendar, DollarSign, CheckCircle2, Eye, HelpCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const manifestationTypeConfig: Record<ManifestationType, { 
  label: string; 
  icon: typeof Eye; 
  color: string;
  bgColor: string;
}> = {
  ciencia: { 
    label: 'Ciência', 
    icon: Eye, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  confirmacao: { 
    label: 'Confirmada', 
    icon: CheckCircle2, 
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  desconhecimento: { 
    label: 'Desconhecida', 
    icon: HelpCircle, 
    color: 'text-warning',
    bgColor: 'bg-warning/10'
  },
  nao_realizada: { 
    label: 'Não Realizada', 
    icon: XCircle, 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  },
};

export function NfeCard({ nfe, onManifest }: NfeCardProps) {
  const status = statusConfig[nfe.status] || statusConfig.pending;
  
  // Obter configuração do tipo de manifestação
  const manifestConfig = nfe.manifestation_type 
    ? manifestationTypeConfig[nfe.manifestation_type as ManifestationType] 
    : null;

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

        {nfe.status === 'manifested' && manifestConfig && (
          <div className={cn(
            "flex items-center gap-2 text-sm mt-4 p-3 rounded-lg",
            manifestConfig.bgColor,
            manifestConfig.color
          )}>
            <manifestConfig.icon className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{manifestConfig.label}</span>
              {nfe.manifestation_date && (
                <span className="text-xs opacity-80">
                  {format(new Date(nfe.manifestation_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fallback para manifestações sem tipo específico */}
        {nfe.status === 'manifested' && !manifestConfig && nfe.manifestation_date && (
          <div className="flex items-center gap-2 text-sm text-green-600 mt-4 p-2 bg-green-50 rounded">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Manifestada em {format(new Date(nfe.manifestation_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Justificativa se existir */}
        {nfe.manifestation_justification && (
          <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
            <span className="font-medium">Justificativa:</span> {nfe.manifestation_justification}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
