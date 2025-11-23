import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, Loader2, Download, Lock, XCircle, CheckCircle, AlertCircle, Clock, Settings } from 'lucide-react';
import { useManifesto } from '@/hooks/useManifesto';
import { useMdfeConfig } from '@/hooks/useMdfeConfig';
import { MdfeConfigModal } from '@/components/MdfeConfigModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface ManifestoModalProps {
  open: boolean;
  onClose: () => void;
  freightId: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'AUTORIZADO':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'ENCERRADO':
      return <Lock className="h-5 w-5 text-blue-500" />;
    case 'CANCELADO':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'REJEITADO':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'PENDENTE':
    case 'CONTINGENCIA':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente',
    AUTORIZADO: 'Autorizado',
    ENCERRADO: 'Encerrado',
    CANCELADO: 'Cancelado',
    REJEITADO: 'Rejeitado',
    CONTINGENCIA: 'Contingência'
  };
  return labels[status] || status;
};

export const ManifestoModal: React.FC<ManifestoModalProps> = ({ open, onClose, freightId }) => {
  const { profile } = useAuth();
  const { manifesto, loading, error, consultarMDFe, emitirMDFe, encerrarMDFe, cancelarMDFe, baixarXML, baixarDACTE } = useManifesto(freightId);
  const { config: mdfeConfig, hasConfig, loading: loadingConfig } = useMdfeConfig(profile?.id || '');
  const [justificativa, setJustificativa] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    if (open) {
      console.log('[MANIFESTO-MODAL] FASE 4: Modal aberto, verificando config MDFe...');
      console.log('[MANIFESTO-MODAL] hasConfig:', hasConfig, 'loadingConfig:', loadingConfig);
      consultarMDFe();
    }
  }, [open, consultarMDFe]);

  const handleEmitir = async (modo: 'NORMAL' | 'CONTINGENCIA') => {
    await emitirMDFe(modo);
  };

  const handleEncerrar = async () => {
    const result = await encerrarMDFe();
    if (result.success) {
      // Sucesso já tratado no hook
    }
  };

  const handleCancelar = async () => {
    if (!justificativa.trim()) {
      return;
    }
    const result = await cancelarMDFe(justificativa);
    if (result.success) {
      setShowCancelDialog(false);
      setJustificativa('');
    }
  };

  const podeEncerrar = manifesto?.status === 'AUTORIZADO';
  const podeCancelar = manifesto?.status === 'AUTORIZADO' || manifesto?.status === 'CONTINGENCIA';
  
  // Verificar se está dentro das 24h para cancelamento
  const dentroDoLimiteCancelamento = manifesto ? 
    (new Date().getTime() - new Date(manifesto.data_emissao).getTime()) < (24 * 60 * 60 * 1000) : 
    false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Manifesto Eletrônico de Transporte (MDFe)
          </DialogTitle>
          <DialogDescription>
            Sistema de emissão e gerenciamento de MDFe integrado com SEFAZ
          </DialogDescription>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Verificando configuração...</span>
          </div>
        ) : !hasConfig ? (
          <div className="py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>⚠️ Configuração MDFe Incompleta</AlertTitle>
              <AlertDescription className="mt-2">
                Configure CNPJ, Inscrição Estadual e RNTRC para emitir manifestos eletrônicos.
              </AlertDescription>
            </Alert>
            <div className="flex justify-center mt-6">
              <Button onClick={() => setShowConfigModal(true)} size="lg">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Agora
              </Button>
            </div>
          </div>
        ) : loading && !manifesto ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error && !manifesto ? (
          <div className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">MDFe não encontrado</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Este frete ainda não possui um Manifesto Eletrônico emitido.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => handleEmitir('NORMAL')} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                🚀 Emitir MDFe Normal
              </Button>
              <Button onClick={() => handleEmitir('CONTINGENCIA')} variant="outline" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                🔧 Emitir em Contingência
              </Button>
            </div>
          </div>
        ) : manifesto ? (
          <Tabs defaultValue="detalhes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes" className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                {getStatusIcon(manifesto.status)}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-semibold">{getStatusLabel(manifesto.status)}</p>
                </div>
                {manifesto.protocolo_autorizacao && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Protocolo SEFAZ</p>
                    <p className="text-sm font-mono">{manifesto.protocolo_autorizacao}</p>
                  </div>
                )}
              </div>

              {/* Informações Principais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número do MDFe</p>
                  <p className="font-semibold">{manifesto.numero_mdfe}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Emissão</p>
                  <p className="font-semibold">
                    {format(new Date(manifesto.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Chave de Acesso */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Chave de Acesso</p>
                <p className="font-mono text-sm bg-muted p-2 rounded break-all">{manifesto.chave_acesso}</p>
              </div>

              {/* Condutor e Veículo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold">👤 Condutor</h4>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{manifesto.condutor.nome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPF</p>
                    <p className="font-medium">{manifesto.condutor.cpf}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">🚛 Veículo</h4>
                  <div>
                    <p className="text-sm text-muted-foreground">Placa</p>
                    <p className="font-medium">{manifesto.veiculo.placa}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium">{manifesto.veiculo.tipo_rodado}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Renavam</p>
                    <p className="font-medium">{manifesto.veiculo.renavam}</p>
                  </div>
                </div>
              </div>

              {/* Rota */}
              <div>
                <h4 className="font-semibold mb-2">🗺️ Rota</h4>
                <div className="bg-muted p-3 rounded space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Origem:</span>{' '}
                    <span className="font-medium">{manifesto.municipio_carregamento} / {manifesto.uf_inicio}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Destino:</span>{' '}
                    <span className="font-medium">{manifesto.municipio_descarregamento} / {manifesto.uf_fim}</span>
                  </p>
                </div>
              </div>

              {/* Documentos Vinculados */}
              {manifesto.documentos && manifesto.documentos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">📦 Documentos Vinculados ({manifesto.documentos.length})</h4>
                  <div className="space-y-2">
                    {manifesto.documentos.map((doc, idx) => (
                      <div key={idx} className="bg-muted p-2 rounded text-sm">
                        <span className="font-medium">{doc.tipo_documento}:</span>{' '}
                        <span className="font-mono text-xs">{doc.chave_acesso_doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button onClick={baixarXML} variant="outline" size="sm" disabled={!manifesto.xml_content}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar XML
                </Button>
                <Button onClick={baixarDACTE} variant="outline" size="sm" disabled={!manifesto.dacte_url}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar DACTE
                </Button>
                
                {podeEncerrar && (
                  <Button onClick={handleEncerrar} variant="default" size="sm" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Lock className="h-4 w-4 mr-2" />
                    Encerrar MDFe
                  </Button>
                )}
                
                {podeCancelar && dentroDoLimiteCancelamento && (
                  <Button 
                    onClick={() => setShowCancelDialog(true)} 
                    variant="destructive" 
                    size="sm"
                    disabled={loading}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                )}

                {podeCancelar && !dentroDoLimiteCancelamento && (
                  <p className="text-xs text-muted-foreground w-full">
                    ⚠️ Cancelamento disponível apenas nas primeiras 24h após emissão
                  </p>
                )}
              </div>

              {/* Dialog de Cancelamento */}
              {showCancelDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-semibold mb-4">Cancelar MDFe</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Informe a justificativa do cancelamento (mínimo 15 caracteres):
                    </p>
                    <Textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Ex: Erro no cadastro da carga..."
                      className="mb-4"
                      rows={4}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowCancelDialog(false);
                          setJustificativa('');
                        }}
                      >
                        Voltar
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleCancelar}
                        disabled={justificativa.length < 15 || loading}
                      >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirmar Cancelamento
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historico" className="space-y-3">
              <h4 className="font-semibold">📋 Histórico de Operações</h4>
              {manifesto.logs && manifesto.logs.length > 0 ? (
                <div className="space-y-2">
                  {manifesto.logs.map((log, idx) => (
                    <div key={idx} className="bg-muted p-3 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{log.tipo_operacao}</span>
                        <span className={`text-xs px-2 py-1 rounded ${log.sucesso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {log.sucesso ? '✓ Sucesso' : '✗ Falha'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </p>
                      {log.observacao && (
                        <p className="text-sm mt-2">{log.observacao}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma operação registrada ainda
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>

      {/* Modal de Configuração MDFe */}
      <MdfeConfigModal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        userId={profile?.id || ''}
        onConfigSaved={() => {
          console.log('[MANIFESTO-MODAL] Config salva, recarregando...');
          consultarMDFe();
        }}
      />
    </Dialog>
  );
};
