import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { FileText, Download, ExternalLink, Clock, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface FiscalHistoryTabProps {
  fiscalIssuerId: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  authorized: { label: 'Autorizada', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  autorizado: { label: 'Autorizada', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  processing: { label: 'Processando', variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  processando_autorizacao: { label: 'Processando', variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pending: { label: 'Pendente', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  rejected: { label: 'Rejeitada', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  erro_autorizacao: { label: 'Erro', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  canceled: { label: 'Cancelada', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

const getStatus = (status: string) => statusConfig[status] || { label: status, variant: 'outline' as const, icon: <AlertTriangle className="h-3 w-3" /> };

export const FiscalHistoryTab: React.FC<FiscalHistoryTabProps> = ({ fiscalIssuerId }) => {
  const { profile } = useAuth();

  const { data: emissions, isLoading } = useQuery({
    queryKey: ['fiscal-history', fiscalIssuerId],
    queryFn: async () => {
      if (!fiscalIssuerId) return [];

      const { data, error } = await supabase
        .from('nfe_emissions')
        .select('id, internal_ref, status, created_at, issue_date, number, series, recipient_name, recipient_document, totals, danfe_url, xml_url, access_key, model, operation_nature, error_message, fiscal_environment')
        .eq('issuer_id', fiscalIssuerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao buscar histórico fiscal:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!fiscalIssuerId,
    refetchInterval: 15000, // Polling a cada 15s para atualizar status
  });

  const handleDownloadDanfe = async (danfeUrl: string) => {
    if (!danfeUrl) {
      toast.error('DANFE não disponível ainda');
      return;
    }
    window.open(danfeUrl, '_blank');
  };

  const handleDownloadXml = async (xmlUrl: string) => {
    if (!xmlUrl) {
      toast.error('XML não disponível ainda');
      return;
    }
    window.open(xmlUrl, '_blank');
  };

  if (!fiscalIssuerId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Configure seu emissor fiscal para ver o histórico</p>
      </div>
    );
  }

  if (isLoading) {
    return <CenteredSpinner className="py-12" />;
  }

  if (!emissions || emissions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum documento emitido</p>
        <p className="text-sm mt-2">Seus documentos fiscais aparecerão aqui após a emissão</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Histórico de Emissões</h3>
        <Badge variant="outline">{emissions.length} documento(s)</Badge>
      </div>

      <div className="space-y-3">
        {emissions.map((emission) => {
          const st = getStatus(emission.status);
          const totals = emission.totals as any;
          const totalValue = totals?.icms_tot?.v_nf || totals?.vNF || totals?.total || 0;

          return (
            <Card key={emission.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        NF-e {emission.number ? `#${emission.number}` : `(${emission.internal_ref?.slice(0, 8)}...)`}
                      </span>
                      <Badge variant={st.variant} className="flex items-center gap-1 text-xs">
                        {st.icon}
                        {st.label}
                      </Badge>
                      {emission.fiscal_environment === 'homologacao' && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          Homologação
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground truncate">
                      <span className="font-medium">Para:</span> {emission.recipient_name}
                      {emission.recipient_document && (
                        <span className="ml-2 text-xs">({emission.recipient_document})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(emission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {totalValue > 0 && (
                        <span className="font-medium text-foreground">
                          R$ {Number(totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    {emission.error_message && (
                      <p className="text-xs text-destructive mt-1">
                        ⚠️ {emission.error_message}
                      </p>
                    )}

                    {emission.access_key && (
                      <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                        Chave: {emission.access_key}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {emission.danfe_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadDanfe(emission.danfe_url!)}
                        className="text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        DANFE
                      </Button>
                    )}
                    {emission.xml_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadXml(emission.xml_url!)}
                        className="text-xs"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        XML
                      </Button>
                    )}
                    {!emission.danfe_url && !emission.xml_url && emission.status !== 'rejected' && emission.status !== 'erro_autorizacao' && (
                      <span className="text-xs text-muted-foreground italic">
                        Aguardando SEFAZ...
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
