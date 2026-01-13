import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NfeManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalIssuer: any;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'authorized':
      return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Autorizada</Badge>;
    case 'rejected':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejeitada</Badge>;
    case 'cancelled':
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Cancelada</Badge>;
    case 'pending':
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    case 'processing':
      return <Badge variant="outline" className="border-blue-500 text-blue-600"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Processando</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const NfeManagementPanel: React.FC<NfeManagementPanelProps> = ({
  isOpen,
  onClose,
  fiscalIssuer,
}) => {
  const { data: nfes, isLoading, refetch } = useQuery({
    queryKey: ['nfe-list', fiscalIssuer?.id],
    queryFn: async () => {
      if (!fiscalIssuer?.id) return [];
      
      const { data, error } = await supabase
        .from('nfe_emissions')
        .select('*')
        .eq('issuer_id', fiscalIssuer.id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!fiscalIssuer?.id && isOpen,
  });

  const handleDownloadXml = async (nfe: any) => {
    if (nfe.xml_url) {
      window.open(nfe.xml_url, '_blank');
    }
  };

  const handleDownloadPdf = async (nfe: any) => {
    if (nfe.danfe_url) {
      window.open(nfe.danfe_url, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Gerenciar NF-es
          </DialogTitle>
          <DialogDescription>
            Visualize e gerencie suas Notas Fiscais Eletrônicas
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !nfes || nfes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma NF-e emitida ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nfes.map((nfe: any) => (
                <Card key={nfe.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">
                            NF-e {nfe.numero || 'S/N'}
                          </span>
                          {nfe.serie && (
                            <span className="text-sm text-muted-foreground">
                              Série {nfe.serie}
                            </span>
                          )}
                          {getStatusBadge(nfe.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Valor:</span>{' '}
                            <span className="font-medium">
                              R$ {(nfe.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data:</span>{' '}
                            <span>
                              {format(new Date(nfe.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {nfe.chave && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Chave:</span>{' '}
                              <span className="font-mono text-xs">{nfe.chave}</span>
                            </div>
                          )}
                        </div>

                        {nfe.status === 'rejected' && nfe.mensagem_erro && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                            {nfe.mensagem_erro}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {nfe.danfe_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDownloadPdf(nfe)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            DANFE
                          </Button>
                        )}
                        {nfe.xml_url && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDownloadXml(nfe)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
