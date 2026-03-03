/**
 * ProfileEdit.tsx
 *
 * Tela full-screen de edição de perfil estilo Meta (Instagram/Facebook).
 * Layout limpo com avatar centralizado, seções accordion, campos inline.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Check, X, User, Phone, FileText, Building2, MapPin, Shield, AlertTriangle, Lock, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AppSpinner, InlineSpinner } from '@/components/ui/AppSpinner';
import { cn } from '@/lib/utils';
import { useProfileEdit } from '@/hooks/useProfileEdit';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { ProfileDangerZone } from '@/components/profile/ProfileDangerZone';
import { ProfileStatsCard } from '@/components/profile/ProfileStatsCard';

// ── Helpers ──────────────────────────────────────────────────────────

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    MOTORISTA: 'Motorista',
    MOTORISTA_AFILIADO: 'Motorista Afiliado',
    PRODUTOR: 'Produtor',
    PRESTADOR_SERVICOS: 'Prestador de Serviços',
    TRANSPORTADORA: 'Transportadora',
    ADMIN: 'Administrador',
  };
  return map[role] || role || 'Usuário';
};

const maskCpfCnpj = (value: string): string => {
  if (!value) return '';
  const d = value.replace(/\D/g, '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return value;
};

const formatPhone = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const formatCep = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

// ── Field component (Meta-style) ─────────────────────────────────────

interface MetaFieldProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  icon?: React.ReactNode;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  mask?: (v: string) => string;
}

const MetaField: React.FC<MetaFieldProps> = ({ label, value, onChange, icon, readOnly, type = 'text', placeholder, maxLength, mask }) => (
  <div className="flex items-center gap-3 py-3 px-4 border-b border-border/50 last:border-b-0">
    <div className="flex-shrink-0 w-5 text-muted-foreground">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <Label className="text-xs text-muted-foreground font-medium block mb-0.5">{label}</Label>
      {readOnly ? (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-foreground truncate">{value || '—'}</span>
          <Lock className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
        </div>
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            onChange?.(mask ? mask(raw) : raw);
          }}
          placeholder={placeholder || label}
          maxLength={maxLength}
          className="border-0 p-0 h-auto text-sm bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
        />
      )}
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────

const ProfileEdit: React.FC = () => {
  const navigate = useNavigate();
  const {
    profileData,
    addressData,
    currentPhotoPath,
    loading,
    saving,
    photoUploading,
    isDeleting,
    missingFields,
    ratingDistribution,
    authProfile,
    handleFieldChange,
    handleAddressChange,
    handleSave,
    handlePhotoChange,
    handleRemovePhoto,
    handleDeleteAccount,
  } = useProfileEdit();

  const { url: resolvedPhotoUrl } = useSignedImageUrl(currentPhotoPath);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const displayUrl = previewUrl || resolvedPhotoUrl || undefined;
  const role = authProfile?.role || authProfile?.active_mode || '';

  // Track changes
  const onFieldChange = (name: string, value: string) => {
    handleFieldChange(name, value);
    setHasChanges(true);
  };

  const onAddressChange = (field: any, value: string) => {
    handleAddressChange(field, value);
    setHasChanges(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    e.target.value = '';
  };

  const handleConfirmPhoto = async () => {
    if (pendingFile) {
      await handlePhotoChange(pendingFile);
      setPendingFile(null);
      setPreviewUrl(null);
    }
  };

  const handleCancelPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
  };

  const onSave = async () => {
    const success = await handleSave();
    if (success) {
      setHasChanges(false);
    }
  };

  const onBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AppSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>
      {/* ── Fixed Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-1 text-foreground hover:text-primary transition-colors p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Editar perfil</h1>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || !hasChanges}
            className="font-semibold text-sm px-4"
          >
            {saving ? <InlineSpinner className="mr-0" /> : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* ── Avatar Section ──────────────────────────────────────── */}
        <div className="flex flex-col items-center py-6 px-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              {photoUploading ? (
                <div className="flex items-center justify-center h-full w-full bg-muted">
                  <AppSpinner size="sm" />
                </div>
              ) : (
                <>
                  <AvatarImage src={displayUrl} alt={profileData.full_name} className="object-cover" />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {getInitials(profileData.full_name)}
                  </AvatarFallback>
                </>
              )}
            </Avatar>

            {/* Camera overlay */}
            {!pendingFile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <label
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "absolute bottom-0 right-0 z-10",
                    "h-9 w-9 rounded-full cursor-pointer",
                    "bg-primary text-primary-foreground",
                    "flex items-center justify-center",
                    "hover:bg-primary/90 transition-all",
                    "shadow-md border-3 border-background",
                    "active:scale-95",
                    photoUploading && "pointer-events-none opacity-50"
                  )}
                >
                  <Camera className="h-4 w-4" />
                </label>
              </>
            )}
          </div>

          {/* Photo confirm/cancel */}
          {pendingFile && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={handleCancelPhoto} disabled={photoUploading}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleConfirmPhoto} disabled={photoUploading}>
                {photoUploading ? <InlineSpinner className="mr-0" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Confirmar
              </Button>
            </div>
          )}

          {/* Remove photo link */}
          {!pendingFile && currentPhotoPath && (
            <button
              onClick={handleRemovePhoto}
              className="mt-2 text-xs text-destructive hover:underline flex items-center gap-1"
              disabled={photoUploading}
            >
              <Trash2 className="h-3 w-3" />
              Remover foto
            </button>
          )}

          {/* Name + Role badge */}
          <h2 className="mt-3 text-lg font-bold text-foreground text-center">{profileData.full_name || 'Seu nome'}</h2>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">{getRoleLabel(role)}</Badge>
            <Badge variant="default" className="text-xs">
              {authProfile?.status === 'APPROVED' ? '✓ Aprovado' : authProfile?.status === 'PENDING' ? 'Pendente' : authProfile?.status || 'Ativo'}
            </Badge>
          </div>

          {/* Completeness CTA */}
          {missingFields.length > 0 && (
            <div className="mt-4 w-full p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Complete seu perfil</p>
                <p className="text-xs text-muted-foreground">Faltam: {missingFields.join(', ')}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Editable Sections (Accordion) ───────────────────────── */}
        <Accordion type="multiple" defaultValue={['personal', 'professional']} className="px-4">
          
          {/* Dados Pessoais */}
          <AccordionItem value="personal">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados Pessoais
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                <MetaField
                  label="Nome completo"
                  value={profileData.full_name}
                  onChange={(v) => onFieldChange('full_name', v)}
                  icon={<User className="h-4 w-4" />}
                  placeholder="Seu nome completo"
                />
                <MetaField
                  label="WhatsApp"
                  value={profileData.phone}
                  onChange={(v) => onFieldChange('phone', v)}
                  icon={<Phone className="h-4 w-4" />}
                  type="tel"
                  placeholder="(00) 00000-0000"
                  mask={formatPhone}
                  maxLength={15}
                />
                <MetaField
                  label="Telefone de contato"
                  value={profileData.contact_phone}
                  onChange={(v) => onFieldChange('contact_phone', v)}
                  icon={<Phone className="h-4 w-4" />}
                  type="tel"
                  placeholder="(00) 0000-0000"
                  mask={formatPhone}
                  maxLength={15}
                />
                <MetaField
                  label="CPF/CNPJ"
                  value={maskCpfCnpj(profileData.cpf_cnpj)}
                  icon={<FileText className="h-4 w-4" />}
                  readOnly
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Dados Profissionais (por role) */}
          {(role === 'PRODUTOR' || role === 'MOTORISTA' || role === 'MOTORISTA_AFILIADO' || role === 'PRESTADOR_SERVICOS' || role === 'TRANSPORTADORA') && (
            <AccordionItem value="professional">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  {role === 'PRODUTOR' ? 'Dados da Fazenda' : 'Dados Profissionais'}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                  {role === 'PRODUTOR' && (
                    <>
                      <MetaField
                        label="Nome da fazenda"
                        value={profileData.farm_name}
                        onChange={(v) => onFieldChange('farm_name', v)}
                        icon={<Building2 className="h-4 w-4" />}
                        placeholder="Fazenda São João"
                      />
                      <MetaField
                        label="Endereço da fazenda"
                        value={profileData.farm_address}
                        onChange={(v) => onFieldChange('farm_address', v)}
                        icon={<MapPin className="h-4 w-4" />}
                        placeholder="Estrada rural, Km 15"
                      />
                    </>
                  )}
                  {(role === 'MOTORISTA' || role === 'MOTORISTA_AFILIADO') && (
                    <>
                      <MetaField
                        label="Cooperativa"
                        value={profileData.cooperative}
                        onChange={(v) => onFieldChange('cooperative', v)}
                        icon={<Building2 className="h-4 w-4" />}
                        placeholder="Nome da cooperativa"
                      />
                      <MetaField
                        label="RNTRC"
                        value={profileData.rntrc}
                        icon={<FileText className="h-4 w-4" />}
                        readOnly
                      />
                    </>
                  )}
                  {role === 'PRESTADOR_SERVICOS' && (
                    <MetaField
                      label="Cooperativa/Empresa"
                      value={profileData.cooperative}
                      onChange={(v) => onFieldChange('cooperative', v)}
                      icon={<Building2 className="h-4 w-4" />}
                      placeholder="Nome da empresa"
                    />
                  )}
                  {role === 'TRANSPORTADORA' && (
                    <MetaField
                      label="RNTRC"
                      value={profileData.rntrc}
                      icon={<FileText className="h-4 w-4" />}
                      readOnly
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Endereço */}
          <AccordionItem value="address">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Endereço
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                <MetaField
                  label="CEP"
                  value={addressData.zip}
                  onChange={(v) => onAddressChange('zip', v)}
                  icon={<MapPin className="h-4 w-4" />}
                  placeholder="00000-000"
                  mask={formatCep}
                  maxLength={9}
                />
                <MetaField
                  label="Rua/Logradouro"
                  value={addressData.street}
                  onChange={(v) => onAddressChange('street', v)}
                  placeholder="Nome da rua"
                />
                <div className="flex">
                  <div className="flex-1 border-r border-border/50">
                    <MetaField
                      label="Número"
                      value={addressData.number}
                      onChange={(v) => onAddressChange('number', v)}
                      placeholder="Nº"
                    />
                  </div>
                  <div className="flex-1">
                    <MetaField
                      label="Complemento"
                      value={addressData.complement}
                      onChange={(v) => onAddressChange('complement', v)}
                      placeholder="Apto, sala..."
                    />
                  </div>
                </div>
                <MetaField
                  label="Bairro"
                  value={addressData.neighborhood}
                  onChange={(v) => onAddressChange('neighborhood', v)}
                  placeholder="Bairro"
                />
                <div className="flex">
                  <div className="flex-[2] border-r border-border/50">
                    <MetaField
                      label="Cidade"
                      value={addressData.city}
                      onChange={(v) => onAddressChange('city', v)}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="flex-1">
                    <MetaField
                      label="UF"
                      value={addressData.state}
                      onChange={(v) => onAddressChange('state', v.toUpperCase())}
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Contato de Emergência */}
          <AccordionItem value="emergency">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                Contato de Emergência
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                <MetaField
                  label="Nome do contato"
                  value={profileData.emergency_contact_name}
                  onChange={(v) => onFieldChange('emergency_contact_name', v)}
                  icon={<User className="h-4 w-4" />}
                  placeholder="Nome completo"
                />
                <MetaField
                  label="Telefone de emergência"
                  value={profileData.emergency_contact_phone}
                  onChange={(v) => onFieldChange('emergency_contact_phone', v)}
                  icon={<Phone className="h-4 w-4" />}
                  type="tel"
                  placeholder="(00) 00000-0000"
                  mask={formatPhone}
                  maxLength={15}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* ── Stats (collapsed) ────────────────────────────────────── */}
        <div className="px-4 py-4">
          <ProfileStatsCard
            rating={authProfile?.rating || 0}
            totalRatings={(authProfile as any)?.total_ratings || 0}
            memberSince={(authProfile as any)?.created_at}
            ratingDistribution={ratingDistribution}
          />
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────── */}
        <div className="px-4 pb-8">
          <ProfileDangerZone
            onDeleteAccount={handleDeleteAccount}
            isDeleting={isDeleting}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
