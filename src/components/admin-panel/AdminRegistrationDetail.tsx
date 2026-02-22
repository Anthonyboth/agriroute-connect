import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, FileText, Clock, User, Phone, CreditCard, MapPin, Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SignedStorageImage } from '@/components/ui/signed-storage-image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ROLE_LABELS: Record<string, string> = {
  MOTORISTA: 'Motorista',
  MOTORISTA_AFILIADO: 'Mot. Afiliado',
  PRODUTOR: 'Produtor',
  PRESTADOR_SERVICOS: 'Prestador de Serviços',
  TRANSPORTADORA: 'Transportadora',
};

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REJECTED: { label: 'Reprovado', color: 'bg-red-100 text-red-800', icon: XCircle },
  NEEDS_FIX: { label: 'Aguardando Correção', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
};

const AdminRegistrationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { callApi } = useAdminApi();
  const [profile, setProfile] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Action dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'APPROVE' | 'REJECT' | 'NEEDS_FIX'>('APPROVE');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [messageToUser, setMessageToUser] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await callApi<any>('registration', { entityId: id });
    if (data) {
      setProfile(data.profile);
      setActions(data.actions || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const handleAction = async () => {
    if (!id) return;
    if (dialogAction === 'REJECT' && !reason) {
      toast.error('Motivo é obrigatório para reprovação');
      return;
    }
    if (dialogAction === 'NEEDS_FIX' && !messageToUser) {
      toast.error('Mensagem para o usuário é obrigatória');
      return;
    }

    setSubmitting(true);
    const { data, error } = await callApi('registration', {
      method: 'POST',
      entityId: id,
      body: {
        action: dialogAction,
        reason,
        reason_category: reasonCategory,
        message_to_user: messageToUser,
        internal_notes: internalNotes,
      },
    });

    if (error) {
      toast.error(`Erro: ${error}`);
    } else {
      const labels = { APPROVE: 'aprovado', REJECT: 'reprovado', NEEDS_FIX: 'correção solicitada' };
      toast.success(`Cadastro ${labels[dialogAction]} com sucesso`);
      setDialogOpen(false);
      setReason('');
      setReasonCategory('');
      setMessageToUser('');
      setInternalNotes('');
      fetchDetail();
    }
    setSubmitting(false);
  };

  const openDialog = (action: 'APPROVE' | 'REJECT' | 'NEEDS_FIX') => {
    setDialogAction(action);
    setDialogOpen(true);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;
  if (!profile) return <div className="flex-1 flex items-center justify-center"><p>Cadastro não encontrado</p></div>;

  const statusInfo = STATUS_INFO[profile.status] || STATUS_INFO.PENDING;
  const StatusIcon = statusInfo.icon;

  const docFields = [
    { key: 'selfie_url', label: 'Selfie' },
    { key: 'document_photo_url', label: 'Documento' },
    { key: 'cnh_photo_url', label: 'CNH' },
    { key: 'address_proof_url', label: 'Comprovante de Endereço' },
    { key: 'truck_photo_url', label: 'Foto do Veículo' },
    { key: 'license_plate_photo_url', label: 'Placa' },
  ];

  return (
    <div className="flex-1">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-gray-100 rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-v2/cadastros')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-xl font-semibold text-gray-800">Detalhe do Cadastro</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* Status + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-6 w-6" />
            <Badge className={`${statusInfo.color} text-sm px-3 py-1`}>{statusInfo.label}</Badge>
            <Badge variant="outline">{ROLE_LABELS[profile.role] || profile.role}</Badge>
          </div>
          <div className="flex gap-2">
            {profile.status !== 'APPROVED' && (
              <Button onClick={() => openDialog('APPROVE')} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" /> Aprovar
              </Button>
            )}
            {profile.status !== 'REJECTED' && (
              <Button onClick={() => openDialog('REJECT')} variant="destructive">
                <XCircle className="h-4 w-4 mr-2" /> Reprovar
              </Button>
            )}
            <Button onClick={() => openDialog('NEEDS_FIX')} variant="outline" className="text-orange-600 border-orange-300">
              <AlertTriangle className="h-4 w-4 mr-2" /> Solicitar Correção
            </Button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" /> Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Nome" value={profile.full_name} />
              <InfoRow label="CPF/CNPJ" value={profile.cpf_cnpj} icon={<CreditCard className="h-4 w-4" />} />
              <InfoRow label="Telefone" value={profile.phone} icon={<Phone className="h-4 w-4" />} />
              <InfoRow label="Cidade/UF" value={profile.base_city_name ? `${profile.base_city_name}/${profile.base_state}` : '—'} icon={<MapPin className="h-4 w-4" />} />
              <InfoRow label="RNTRC" value={profile.rntrc} />
              <InfoRow label="Cadastro em" value={format(new Date(profile.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
              {profile.admin_message && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm font-medium text-orange-800">Mensagem pendente:</p>
                  <p className="text-sm text-orange-700">{profile.admin_message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" /> Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {docFields.map(({ key, label }) => {
                  const url = profile[key];
                  if (!url) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <SignedStorageImage
                        src={url}
                        alt={label}
                        className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-90"
                        onClick={() => window.open(url, '_blank')}
                      />
                    </div>
                  );
                })}
                {docFields.every(({ key }) => !profile[key]) && (
                  <p className="text-sm text-muted-foreground col-span-2">Nenhum documento enviado</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Ações</CardTitle>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação registrada</p>
            ) : (
              <div className="space-y-3">
                {actions.map((action: any) => (
                  <div key={action.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs" variant="outline">{action.action}</Badge>
                        <span className="text-sm font-medium">{action.admin?.full_name || action.admin?.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(action.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {action.reason && <p className="text-sm mt-1">{action.reason}</p>}
                      {action.message_to_user && (
                        <p className="text-sm text-orange-600 mt-1">📩 {action.message_to_user}</p>
                      )}
                      {action.internal_notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">📝 {action.internal_notes}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {action.previous_status} → {action.new_status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'APPROVE' && '✅ Aprovar Cadastro'}
              {dialogAction === 'REJECT' && '❌ Reprovar Cadastro'}
              {dialogAction === 'NEEDS_FIX' && '⚠️ Solicitar Correção'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'APPROVE' && `Confirma a aprovação de ${profile.full_name}?`}
              {dialogAction === 'REJECT' && 'Informe o motivo da reprovação.'}
              {dialogAction === 'NEEDS_FIX' && 'Descreva o que o usuário precisa corrigir.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogAction === 'REJECT' && (
              <div>
                <label className="text-sm font-medium">Categoria *</label>
                <Select value={reasonCategory} onValueChange={setReasonCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Documento ilegível">Documento ilegível</SelectItem>
                    <SelectItem value="Dados inconsistentes">Dados inconsistentes</SelectItem>
                    <SelectItem value="Selfie não confere">Selfie não confere</SelectItem>
                    <SelectItem value="CNH inválida/vencida">CNH inválida/vencida</SelectItem>
                    <SelectItem value="CNPJ irregular">CNPJ irregular</SelectItem>
                    <SelectItem value="Documentos incompletos">Documentos incompletos</SelectItem>
                    <SelectItem value="Suspeita de fraude">Suspeita de fraude</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(dialogAction === 'REJECT' || dialogAction === 'NEEDS_FIX') && (
              <div>
                <label className="text-sm font-medium">
                  {dialogAction === 'REJECT' ? 'Motivo *' : 'Mensagem para o usuário *'}
                </label>
                <Textarea
                  value={dialogAction === 'REJECT' ? reason : messageToUser}
                  onChange={(e) => dialogAction === 'REJECT' ? setReason(e.target.value) : setMessageToUser(e.target.value)}
                  placeholder={dialogAction === 'REJECT' ? 'Descreva o motivo da reprovação...' : 'Descreva o que precisa ser corrigido...'}
                  rows={3}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Observações internas (opcional)</label>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notas visíveis apenas para admins..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              className={dialogAction === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : dialogAction === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {submitting ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  );
}

export default AdminRegistrationDetail;
