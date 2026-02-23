import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, FileText, Clock, User,
  Phone, CreditCard, MapPin, Menu, Truck, Star, Shield, DollarSign, Package,
  Camera, Mail, CalendarDays, Building2, Award, Fuel, Navigation, Eye,
  Globe, Hash, Activity, BadgeCheck, Map, UserCheck, Wallet,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SignedStorageImage } from '@/components/ui/signed-storage-image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const ROLE_LABELS: Record<string, string> = {
  MOTORISTA: 'Motorista',
  MOTORISTA_AFILIADO: 'Mot. Afiliado',
  PRODUTOR: 'Produtor',
  PRESTADOR_SERVICOS: 'Prestador de Serviços',
  TRANSPORTADORA: 'Transportadora',
};

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendente', color: 'bg-warning/15 text-warning', icon: Clock },
  APPROVED: { label: 'Aprovado', color: 'bg-success/15 text-success', icon: CheckCircle },
  REJECTED: { label: 'Reprovado', color: 'bg-destructive/15 text-destructive', icon: XCircle },
  NEEDS_FIX: { label: 'Aguardando Correção', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  BLOCKED: { label: 'Bloqueado', color: 'bg-destructive/20 text-destructive', icon: Shield },
};

const FREIGHT_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-warning/15 text-warning' },
  ACCEPTED: { label: 'Aceito', className: 'bg-primary/15 text-primary' },
  IN_TRANSIT: { label: 'Em Trânsito', className: 'bg-accent/15 text-accent' },
  DELIVERED: { label: 'Entregue', className: 'bg-success/15 text-success' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
  LOADING: { label: 'Carregando', className: 'bg-primary/15 text-primary' },
  LOADED: { label: 'Carregado', className: 'bg-accent/15 text-accent' },
};

type ValidationFieldKey =
  | 'document_validation_status'
  | 'cnh_validation_status'
  | 'rntrc_validation_status'
  | 'validation_status'
  | 'background_check_status';

const AdminRegistrationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { callApi } = useAdminApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageDialog, setImageDialog] = useState<{ url: string; label: string } | null>(null);

  // Action dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'APPROVE' | 'REJECT' | 'NEEDS_FIX' | 'BLOCK' | 'UNBLOCK'>('APPROVE');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [messageToUser, setMessageToUser] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationSubmitting, setValidationSubmitting] = useState<string | null>(null);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    const { data: result } = await callApi<any>('user-detail', { entityId: id });
    if (result) setData(result);
    setLoading(false);
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const handleValidationAction = async (field: ValidationFieldKey, status: 'VALIDATED' | 'REJECTED' | 'APPROVED') => {
    if (!id) return;
    const actionKey = `${field}:${status}`;
    setValidationSubmitting(actionKey);

    const { error } = await callApi('registration-validation', {
      method: 'POST',
      entityId: id,
      body: {
        field,
        status,
      },
    });

    if (error) {
      toast.error(`Erro ao atualizar validação: ${error}`);
    } else {
      const approvedStatuses = new Set(['VALIDATED', 'APPROVED']);
      toast.success(`Validação atualizada para ${approvedStatuses.has(status) ? 'APROVADA' : 'REPROVADA'}`);
      fetchDetail();
    }

    setValidationSubmitting(null);
  };

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
    const { error } = await callApi('registration', {
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
      const labels = { APPROVE: 'aprovado', REJECT: 'reprovado', NEEDS_FIX: 'correção solicitada', BLOCK: 'bloqueado', UNBLOCK: 'desbloqueado' };
      toast.success(`Cadastro ${labels[dialogAction]} com sucesso`);
      setDialogOpen(false);
      setReason(''); setReasonCategory(''); setMessageToUser(''); setInternalNotes('');
      fetchDetail();
    }
    setSubmitting(false);
  };

  const openDialog = (action: 'APPROVE' | 'REJECT' | 'NEEDS_FIX' | 'BLOCK' | 'UNBLOCK') => {
    setDialogAction(action);
    setDialogOpen(true);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;
  if (!data?.profile) return <div className="flex-1 flex items-center justify-center"><p>Cadastro não encontrado</p></div>;

  const profile = data.profile;
  const statusInfo = STATUS_INFO[profile.status] || STATUS_INFO.PENDING;
  const StatusIcon = statusInfo.icon;

  const docFields = [
    { key: 'selfie_url', label: 'Selfie de Verificação', icon: Camera },
    { key: 'profile_photo_url', label: 'Foto de Perfil', icon: User },
    { key: 'document_photo_url', label: 'Documento (Frente)', icon: CreditCard },
    { key: 'document_rg_url', label: 'RG', icon: CreditCard },
    { key: 'document_cpf_url', label: 'CPF', icon: CreditCard },
    { key: 'cnh_photo_url', label: 'CNH (Foto)', icon: FileText },
    { key: 'cnh_url', label: 'CNH (Digitalizada)', icon: FileText },
    { key: 'address_proof_url', label: 'Comprovante de Endereço', icon: MapPin },
    { key: 'truck_photo_url', label: 'Foto do Veículo', icon: Truck },
    { key: 'license_plate_photo_url', label: 'Placa do Veículo', icon: Hash },
    { key: 'truck_documents_url', label: 'Documentos do Veículo', icon: FileText },
  ];

  const existingDocs = docFields.filter(({ key }) => profile[key]);

  return (
    <div className="flex-1 bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-muted rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-v2/cadastros')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{profile.full_name || 'Sem nome'}</h1>
          <p className="text-sm text-muted-foreground">{profile.email || profile.phone || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusInfo.color} text-sm px-3 py-1`}>
            <StatusIcon className="h-4 w-4 mr-1" />
            {statusInfo.label}
          </Badge>
          <Badge variant="outline">{ROLE_LABELS[profile.role] || profile.role}</Badge>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {profile.status === 'APPROVED' ? (
            <Button disabled variant="outline">
              <CheckCircle className="h-4 w-4 mr-2" /> Já aprovado
            </Button>
          ) : (
            <Button onClick={() => openDialog('APPROVE')} className="bg-success hover:bg-success/90 text-success-foreground">
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
          {profile.status !== 'BLOCKED' ? (
            <Button onClick={() => openDialog('BLOCK')} variant="outline" className="text-destructive border-destructive/30">
              <Shield className="h-4 w-4 mr-2" /> Bloquear
            </Button>
          ) : (
            <Button onClick={() => openDialog('UNBLOCK')} variant="outline" className="text-success border-success/30">
              <CheckCircle className="h-4 w-4 mr-2" /> Desbloquear
            </Button>
          )}
        </div>

        {/* Admin Message Alert */}
        {profile.admin_message && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Mensagem pendente para o usuário</p>
              {profile.admin_message_category && (
                <Badge variant="outline" className="text-xs text-orange-700 mt-1">{profile.admin_message_category}</Badge>
              )}
              <p className="text-sm text-orange-700 mt-1">{profile.admin_message}</p>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {data.freight_stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MiniStat label="Fretes (Produtor)" value={data.freight_stats.total_as_producer} icon={<Package className="h-4 w-4" />} />
            <MiniStat label="Fretes (Motorista)" value={data.freight_stats.total_as_driver} icon={<Truck className="h-4 w-4" />} />
            <MiniStat label="Concluídos" value={data.freight_stats.completed} icon={<CheckCircle className="h-4 w-4 text-success" />} />
            <MiniStat label="Cancelados" value={data.freight_stats.cancelled} icon={<XCircle className="h-4 w-4 text-destructive" />} />
            <MiniStat label="Ativos" value={data.freight_stats.active} icon={<Activity className="h-4 w-4 text-primary" />} />
            <MiniStat label="Valor Total" value={`R$ ${Number(data.freight_stats.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} icon={<DollarSign className="h-4 w-4 text-success" />} />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
            <TabsTrigger value="dados" className="text-xs">📋 Dados</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs">📄 Documentos</TabsTrigger>
            <TabsTrigger value="veiculos" className="text-xs">🚛 Veículos</TabsTrigger>
            <TabsTrigger value="fretes" className="text-xs">📦 Fretes</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">💰 Financeiro</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">📜 Histórico</TabsTrigger>
          </TabsList>

          {/* TAB: Dados Pessoais */}
          <TabsContent value="dados" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Identificação */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <InfoRow label="Nome Completo" value={profile.full_name} />
                  <InfoRow label="E-mail" value={profile.email} icon={<Mail className="h-3.5 w-3.5" />} />
                  <InfoRow label="Telefone" value={profile.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                  <InfoRow label="Contato Alt." value={profile.contact_phone} icon={<Phone className="h-3.5 w-3.5" />} />
                  <InfoRow label="CPF/CNPJ" value={profile.cpf_cnpj} icon={<CreditCard className="h-3.5 w-3.5" />} />
                  <InfoRow label="Documento" value={profile.document} />
                  <InfoRow label="Papel" value={ROLE_LABELS[profile.role] || profile.role} icon={<Shield className="h-3.5 w-3.5" />} />
                  <InfoRow label="Modo Ativo" value={profile.active_mode} />
                  <InfoRow label="Avaliação" value={profile.rating ? `${Number(profile.rating).toFixed(1)} ⭐ (${profile.total_ratings || 0} avaliações)` : 'Sem avaliações'} icon={<Star className="h-3.5 w-3.5" />} />
                  <InfoRow label="Cadastro em" value={profile.created_at ? format(new Date(profile.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                  <InfoRow label="Última atualização" value={profile.updated_at ? format(new Date(profile.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'} />
                </CardContent>
              </Card>

              {/* Localização e Endereço */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> Localização e Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <InfoRow label="Cidade Base" value={profile.base_city_name ? `${profile.base_city_name}/${profile.base_state}` : '—'} icon={<Map className="h-3.5 w-3.5" />} />
                  <InfoRow label="Coords Base" value={profile.base_lat ? `${Number(profile.base_lat).toFixed(4)}, ${Number(profile.base_lng).toFixed(4)}` : '—'} />
                  <Separator className="my-2" />
                  <InfoRow label="Rua" value={profile.address_street ? `${profile.address_street}, ${profile.address_number || 's/n'}` : '—'} />
                  <InfoRow label="Complemento" value={profile.address_complement} />
                  <InfoRow label="Bairro" value={profile.address_neighborhood} />
                  <InfoRow label="Cidade" value={profile.address_city ? `${profile.address_city}/${profile.address_state}` : '—'} />
                  <InfoRow label="CEP" value={profile.address_zip} />
                  <InfoRow label="Endereço Fixo" value={profile.fixed_address} />
                  <Separator className="my-2" />
                  <InfoRow label="Localização Atual" value={profile.current_city_name ? `${profile.current_city_name}/${profile.current_state}` : '—'} icon={<Navigation className="h-3.5 w-3.5" />} />
                  <InfoRow label="GPS" value={profile.location_enabled ? 'Ativado' : 'Desativado'} />
                  <InfoRow label="Último GPS" value={profile.last_gps_update ? format(new Date(profile.last_gps_update), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'} />
                </CardContent>
              </Card>

              {/* Dados Profissionais */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" /> Dados Profissionais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <InfoRow label="RNTRC" value={profile.rntrc} />
                  <InfoRow label="ANTT" value={profile.antt_number} />
                  <InfoRow label="Cooperativa" value={profile.cooperative} />
                  <InfoRow label="Categoria CNH" value={profile.cnh_category} />
                  <InfoRow label="Validade CNH" value={profile.cnh_expiry_date ? format(new Date(profile.cnh_expiry_date), "dd/MM/yyyy") : '—'} />
                  <InfoRow label="Exp. Carga Viva" value={profile.live_cargo_experience ? '✅ Sim' : '❌ Não'} />
                  <InfoRow label="Tipo Veículo" value={profile.vehicle_other_type} />
                  <InfoRow label="Especificações" value={profile.vehicle_specifications} />
                  <InfoRow label="NF/Invoice" value={profile.invoice_number} />
                </CardContent>
              </Card>

              {/* Validações */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-primary" /> Validações e Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ValidationRow
                    label="Documento"
                    status={profile.document_validation_status}
                    onApprove={() => handleValidationAction('document_validation_status', 'VALIDATED')}
                    onReject={() => handleValidationAction('document_validation_status', 'REJECTED')}
                    isSubmitting={validationSubmitting === 'document_validation_status:VALIDATED' || validationSubmitting === 'document_validation_status:REJECTED'}
                  />
                  <ValidationRow
                    label="CNH"
                    status={profile.cnh_validation_status}
                    onApprove={() => handleValidationAction('cnh_validation_status', 'VALIDATED')}
                    onReject={() => handleValidationAction('cnh_validation_status', 'REJECTED')}
                    isSubmitting={validationSubmitting === 'cnh_validation_status:VALIDATED' || validationSubmitting === 'cnh_validation_status:REJECTED'}
                  />
                  <ValidationRow
                    label="RNTRC"
                    status={profile.rntrc_validation_status}
                    onApprove={() => handleValidationAction('rntrc_validation_status', 'VALIDATED')}
                    onReject={() => handleValidationAction('rntrc_validation_status', 'REJECTED')}
                    isSubmitting={validationSubmitting === 'rntrc_validation_status:VALIDATED' || validationSubmitting === 'rntrc_validation_status:REJECTED'}
                  />
                  <ValidationRow
                    label="Validação Geral"
                    status={profile.validation_status}
                    onApprove={() => handleValidationAction('validation_status', 'VALIDATED')}
                    onReject={() => handleValidationAction('validation_status', 'REJECTED')}
                    isSubmitting={validationSubmitting === 'validation_status:VALIDATED' || validationSubmitting === 'validation_status:REJECTED'}
                  />
                  <ValidationRow
                    label="Background Check"
                    status={profile.background_check_status}
                    onApprove={() => handleValidationAction('background_check_status', 'APPROVED')}
                    onReject={() => handleValidationAction('background_check_status', 'REJECTED')}
                    isSubmitting={validationSubmitting === 'background_check_status:APPROVED' || validationSubmitting === 'background_check_status:REJECTED'}
                  />
                  <InfoRow label="Notas de Validação" value={profile.validation_notes} />
                  <InfoRow label="Validado em" value={profile.validated_at ? format(new Date(profile.validated_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'} />
                  <Separator className="my-2" />
                  <InfoRow label="Contato Emergência" value={profile.emergency_contact_name} />
                  <InfoRow label="Tel. Emergência" value={profile.emergency_contact_phone} icon={<Phone className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              {/* Farm Info (Producer) */}
              {(profile.role === 'PRODUTOR' || profile.farm_name) && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" /> Propriedade Rural
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <InfoRow label="Nome da Fazenda" value={profile.farm_name} />
                    <InfoRow label="Endereço" value={profile.farm_address} />
                    <InfoRow label="Coords" value={profile.farm_lat ? `${Number(profile.farm_lat).toFixed(4)}, ${Number(profile.farm_lng).toFixed(4)}` : '—'} />
                  </CardContent>
                </Card>
              )}

              {/* Service Provider Info */}
              {(profile.role === 'PRESTADOR_SERVICOS' || profile.service_types?.length > 0) && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" /> Serviços
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <InfoRow label="Tipos de Serviço" value={profile.service_types?.join(', ') || '—'} />
                    <InfoRow label="Raio de Atendimento" value={profile.service_radius_km ? `${profile.service_radius_km} km` : '—'} />
                    <InfoRow label="Regiões" value={profile.service_regions?.join(', ') || '—'} />
                    <InfoRow label="Cidades" value={profile.service_cities?.join(', ') || '—'} />
                    <InfoRow label="Estados" value={profile.service_states?.join(', ') || '—'} />
                  </CardContent>
                </Card>
              )}

              {/* Transport Company */}
              {data.company && (
                <Card className="shadow-sm lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" /> Transportadora
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                      <InfoRow label="Razão Social" value={data.company.company_name} />
                      <InfoRow label="CNPJ" value={data.company.company_cnpj} />
                      <InfoRow label="Insc. Estadual" value={data.company.state_registration} />
                      <InfoRow label="Insc. Municipal" value={data.company.municipal_registration} />
                      <InfoRow label="ANTT" value={data.company.antt_registration} />
                      <InfoRow label="Status" value={data.company.status} />
                      <InfoRow label="Endereço" value={data.company.address} />
                      <InfoRow label="Cidade/UF" value={data.company.city ? `${data.company.city}/${data.company.state}` : '—'} />
                      <InfoRow label="CEP" value={data.company.zip_code} />
                      <InfoRow label="Aprovada em" value={data.company.approved_at ? format(new Date(data.company.approved_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'} />
                    </div>
                    {/* Company documents */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      {data.company.cnpj_document_url && (
                        <DocThumb url={data.company.cnpj_document_url} label="CNPJ" onClick={() => setImageDialog({ url: data.company.cnpj_document_url, label: 'CNPJ' })} />
                      )}
                      {data.company.antt_document_url && (
                        <DocThumb url={data.company.antt_document_url} label="ANTT" onClick={() => setImageDialog({ url: data.company.antt_document_url, label: 'ANTT' })} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Company Affiliations */}
              {data.company_affiliations?.length > 0 && (
                <Card className="shadow-sm lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" /> Afiliações a Transportadoras
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Aceita Fretes</TableHead>
                          <TableHead>Desde</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.company_affiliations.map((aff: any) => (
                          <TableRow key={aff.id}>
                            <TableCell className="font-medium">{(aff.company as any)?.company_name || '—'}</TableCell>
                            <TableCell className="text-sm">{(aff.company as any)?.company_cnpj || '—'}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{aff.affiliation_type || '—'}</Badge></TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{aff.status}</Badge></TableCell>
                            <TableCell>{aff.can_accept_freights ? '✅' : '❌'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{aff.accepted_at ? format(new Date(aff.accepted_at), "dd/MM/yy") : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Badges */}
              {data.badges?.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" /> Badges e Conquistas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {data.badges.map((b: any) => (
                        <div key={b.id} className="bg-muted/50 rounded-lg p-2 text-center min-w-[80px]">
                          <span className="text-lg">{b.badge?.icon || '🏅'}</span>
                          <p className="text-xs font-medium mt-1">{b.badge?.name || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{b.badge?.category}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Availability */}
              {data.availability?.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" /> Disponibilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.availability.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <span className="font-medium">{a.city}/{a.state}</span>
                            {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {format(new Date(a.available_date), "dd/MM/yy")}
                            {a.available_until_date && ` - ${format(new Date(a.available_until_date), "dd/MM/yy")}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* TAB: Documentos */}
          <TabsContent value="documentos" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Documentos Enviados ({existingDocs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {existingDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento enviado</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {existingDocs.map(({ key, label, icon: Icon }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Icon className="h-3 w-3" />
                          {label}
                        </div>
                        <div
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setImageDialog({ url: profile[key], label })}
                        >
                          <SignedStorageImage
                            src={profile[key]}
                            alt={label}
                            adminMode
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Veículos */}
          <TabsContent value="veiculos" className="space-y-4">
            {data.vehicles?.length > 0 ? (
              data.vehicles.map((v: any) => (
                <Card key={v.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      {v.vehicle_type || 'Veículo'} — {v.license_plate || 'Sem placa'}
                      <Badge variant="outline" className="ml-2 text-xs">{v.status || 'N/A'}</Badge>
                      {v.is_company_vehicle && <Badge className="bg-primary/15 text-primary text-xs">Empresa</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                      <InfoRow label="Placa" value={v.license_plate} />
                      <InfoRow label="Tipo" value={v.vehicle_type} />
                      <InfoRow label="Eixos" value={v.axle_count?.toString()} />
                      <InfoRow label="Capacidade" value={v.max_capacity_tons ? `${v.max_capacity_tons} ton` : '—'} />
                      <InfoRow label="Alto Desempenho" value={v.high_performance ? '✅ Sim' : '❌ Não'} />
                      <InfoRow label="ID Primária" value={v.primary_identification} />
                      <InfoRow label="Validação" value={v.vehicle_validation_status || '—'} />
                      <InfoRow label="CRLV Validade" value={v.crlv_expiry_date ? format(new Date(v.crlv_expiry_date), "dd/MM/yyyy") : '—'} />
                      <InfoRow label="Seguro Validade" value={v.insurance_expiry_date ? format(new Date(v.insurance_expiry_date), "dd/MM/yyyy") : '—'} />
                      <InfoRow label="Última Inspeção" value={v.last_inspection_date ? format(new Date(v.last_inspection_date), "dd/MM/yyyy") : '—'} />
                      <InfoRow label="Especificações" value={v.vehicle_specifications} />
                    </div>
                    {/* Vehicle docs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      {v.vehicle_photo_url && <DocThumb url={v.vehicle_photo_url} label="Foto" onClick={() => setImageDialog({ url: v.vehicle_photo_url, label: 'Foto do Veículo' })} />}
                      {v.crlv_url && <DocThumb url={v.crlv_url} label="CRLV" onClick={() => setImageDialog({ url: v.crlv_url, label: 'CRLV' })} />}
                      {v.insurance_document_url && <DocThumb url={v.insurance_document_url} label="Seguro" onClick={() => setImageDialog({ url: v.insurance_document_url, label: 'Seguro' })} />}
                      {v.inspection_certificate_url && <DocThumb url={v.inspection_certificate_url} label="Inspeção" onClick={() => setImageDialog({ url: v.inspection_certificate_url, label: 'Certificado de Inspeção' })} />}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  Nenhum veículo cadastrado
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB: Fretes */}
          <TabsContent value="fretes" className="space-y-4">
            <FreightTable title="Fretes como Produtor" icon={<Package className="h-4 w-4" />} freights={data.freights_as_producer} />
            <FreightTable title="Fretes como Motorista" icon={<Truck className="h-4 w-4" />} freights={data.freights_as_driver} />
          </TabsContent>

          {/* TAB: Financeiro */}
          <TabsContent value="financeiro" className="space-y-4">
            {/* Expenses */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-primary" /> Despesas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.expenses?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.expenses.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell><Badge variant="outline" className="text-xs">{e.expense_type}</Badge></TableCell>
                          <TableCell className="font-medium">R$ {Number(e.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(e.expense_date), "dd/MM/yy")}</TableCell>
                          <TableCell className="text-sm">{e.description || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma despesa registrada</p>
                )}
              </CardContent>
            </Card>

            {/* Balance Transactions */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" /> Transações de Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.balance_transactions?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.balance_transactions.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell><Badge variant="outline" className="text-xs">{t.transaction_type}</Badge></TableCell>
                          <TableCell className={`font-medium ${t.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                            R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{t.status}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell className="text-sm">{t.description || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação registrada</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Histórico de Ações Administrativas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.actions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ação registrada</p>
                ) : (
                  <div className="space-y-3">
                    {data.actions?.map((action: any) => (
                      <div key={action.id} className="flex items-start gap-3 py-3 border-b last:border-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="text-xs" variant="outline">{action.action}</Badge>
                            <span className="text-sm font-medium">{action.admin?.full_name || action.admin?.email || 'Admin'}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(action.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {action.reason && <p className="text-sm mt-1">{action.reason}</p>}
                          {action.message_to_user && <p className="text-sm text-orange-600 mt-1">📩 {action.message_to_user}</p>}
                          {action.internal_notes && <p className="text-xs text-muted-foreground mt-1 italic">📝 {action.internal_notes}</p>}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {action.previous_status} → {action.new_status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Raw Metadata */}
            {profile.metadata && Object.keys(profile.metadata).length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Metadados</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-60">
                    {JSON.stringify(profile.metadata, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'APPROVE' && '✅ Aprovar Cadastro'}
              {dialogAction === 'REJECT' && '❌ Reprovar Cadastro'}
              {dialogAction === 'NEEDS_FIX' && '⚠️ Solicitar Correção'}
              {dialogAction === 'BLOCK' && '🚫 Bloquear Usuário'}
              {dialogAction === 'UNBLOCK' && '🔓 Desbloquear Usuário'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'APPROVE' && `Confirma a aprovação de ${profile.full_name}?`}
              {dialogAction === 'REJECT' && 'Informe o motivo da reprovação.'}
              {dialogAction === 'NEEDS_FIX' && 'Descreva o que o usuário precisa corrigir.'}
              {dialogAction === 'BLOCK' && `Informe o motivo do bloqueio de ${profile.full_name}.`}
              {dialogAction === 'UNBLOCK' && `Confirma o desbloqueio de ${profile.full_name}?`}
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
              <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Notas visíveis apenas para admins..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAction} disabled={submitting}
              className={dialogAction === 'APPROVE' ? 'bg-success hover:bg-success/90' : dialogAction === 'REJECT' ? 'bg-destructive hover:bg-destructive/90' : ''}>
              {submitting ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={!!imageDialog} onOpenChange={() => setImageDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{imageDialog?.label}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            {imageDialog && (
              <SignedStorageImage
                src={imageDialog.url}
                alt={imageDialog.label}
                adminMode
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---- Sub Components ----

function InfoRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-xs font-medium text-right truncate max-w-[60%]">{value || '—'}</span>
    </div>
  );
}

function ValidationRow({
  label,
  status,
  onApprove,
  onReject,
  isSubmitting,
}: {
  label: string;
  status?: string | null;
  onApprove: () => void;
  onReject: () => void;
  isSubmitting?: boolean;
}) {
  const colors: Record<string, string> = {
    valid: 'text-success',
    validated: 'text-success',
    approved: 'text-success',
    invalid: 'text-destructive',
    rejected: 'text-destructive',
    pending: 'text-warning',
    verified: 'text-success',
  };
  const icons: Record<string, string> = {
    valid: '✅',
    validated: '✅',
    approved: '✅',
    invalid: '❌',
    rejected: '❌',
    pending: '⏳',
    verified: '✅',
  };

  const s = status?.toLowerCase() || '';
  const isApproved = ['validated', 'approved', 'valid', 'verified'].includes(s);
  const isRejected = ['rejected', 'invalid'].includes(s);

  return (
    <div className="py-1.5 border-b border-border/60 last:border-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className={`text-xs font-medium ${colors[s] || ''}`}>
            {icons[s] || ''} {status || '—'}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-success border-success/30"
            onClick={onApprove}
            disabled={isSubmitting || isApproved}
          >
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-destructive border-destructive/30"
            onClick={onReject}
            disabled={isSubmitting || isRejected}
          >
            Reprovar
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocThumb({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  return (
    <div className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={onClick}>
      <SignedStorageImage src={url} alt={label} adminMode className="w-full h-24 object-cover rounded-lg border" />
      <p className="text-[10px] text-center text-muted-foreground">{label}</p>
    </div>
  );
}

function FreightTable({ title, icon, freights }: { title: string; icon: React.ReactNode; freights: any[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title} ({freights?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {freights?.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Origem → Destino</TableHead>
                <TableHead>Carga</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Distância</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {freights.map((f: any) => {
                const st = FREIGHT_STATUS[f.status] || { label: f.status, className: '' };
                return (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs font-mono">#{f.reference_number || f.id?.slice(0, 6)}</TableCell>
                    <TableCell className="text-sm">
                      {f.origin_city || '—'}/{f.origin_state} → {f.destination_city || '—'}/{f.destination_state}
                    </TableCell>
                    <TableCell className="text-sm">{f.cargo_type || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {f.price ? `R$ ${Number(f.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{f.distance_km ? `${Number(f.distance_km).toFixed(0)} km` : '—'}</TableCell>
                    <TableCell><Badge className={`text-xs ${st.className}`}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.created_at ? format(new Date(f.created_at), "dd/MM/yy") : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum frete</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-sm font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminRegistrationDetail;
