import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Phone, Mail, FileText, Calendar, MapPin, User, IdCard, 
  Star, Camera, X, Upload, CheckCircle2, AlertCircle,
  Clock, Building2, ImageIcon
} from "lucide-react";
import { formatDocument } from "@/utils/document";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DriverInfoTabProps {
  driverData: any;
  companyId?: string;
}

export const DriverInfoTab = ({ driverData, companyId }: DriverInfoTabProps) => {
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const cnhInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Extrair dados do motorista corretamente
  const driver = driverData?.driver || driverData;

  if (!driver) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">Motorista não encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Os dados deste motorista não estão disponíveis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleUploadPhoto = async (file: File, photoType: 'profile' | 'cnh' | 'selfie') => {
    if (!driver?.id) return;
    
    setUploadingPhoto(photoType);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${driver.id}/${photoType}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);
      
      const updateField = photoType === 'profile' ? 'profile_photo_url' 
        : photoType === 'cnh' ? 'cnh_photo_url' 
        : 'selfie_url';
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', driver.id);
      
      if (updateError) throw updateError;
      
      queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleRemovePhoto = async (photoType: 'profile' | 'cnh' | 'selfie') => {
    if (!driver?.id) return;
    
    try {
      const updateField = photoType === 'profile' ? 'profile_photo_url' 
        : photoType === 'cnh' ? 'cnh_photo_url' 
        : 'selfie_url';
      
      const { error } = await supabase
        .from('profiles')
        .update({ [updateField]: null })
        .eq('id', driver.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
      toast.success('Foto removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, photoType: 'profile' | 'cnh' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadPhoto(file, photoType);
    }
  };

  const getValidationBadge = (status: string | null) => {
    if (status === 'APPROVED') {
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Validado</Badge>;
    }
    if (status === 'PENDING') {
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground"><AlertCircle className="h-3 w-3 mr-1" /> Não validado</Badge>;
  };

  const isCnhExpired = driver.cnh_expiry_date && new Date(driver.cnh_expiry_date) < new Date();

  const formatAddress = () => {
    const parts = [];
    if (driver.address_street) parts.push(driver.address_street);
    if (driver.address_number) parts.push(driver.address_number);
    if (driver.address_neighborhood) parts.push(driver.address_neighborhood);
    if (driver.address_city && driver.address_state) {
      parts.push(`${driver.address_city} - ${driver.address_state}`);
    }
    if (driver.address_zip) parts.push(`CEP: ${driver.address_zip}`);
    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Documento */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-primary tracking-wide">FICHA DE CADASTRO DO MOTORISTA</h2>
            <p className="text-sm text-muted-foreground mt-1">Documento interno da transportadora</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Foto de Perfil */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  <AvatarImage src={driver.profile_photo_url || driver.selfie_url} />
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {driver.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                {companyId && (
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => profileInputRef.current?.click()}
                      disabled={uploadingPhoto === 'profile'}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    {(driver.profile_photo_url || driver.selfie_url) && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => handleRemovePhoto('profile')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'profile')}
                />
              </div>
              {companyId && (
                <p className="text-xs text-muted-foreground mt-2">Passe o mouse para editar</p>
              )}
            </div>

            {/* Informações Principais */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{driver.full_name || 'Nome não informado'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={driverData?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {driverData?.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {driver.role && (
                      <Badge variant="outline">{driver.role}</Badge>
                    )}
                  </div>
                </div>
                {driver.rating > 0 && (
                  <div className="flex items-center gap-1 bg-yellow-500/10 px-3 py-1 rounded-full">
                    <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                    <span className="font-semibold">{driver.rating?.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({driver.total_ratings || 0})</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">CPF/CNPJ:</span>
                  <span className="text-sm">{driver.cpf_cnpj ? formatDocument(driver.cpf_cnpj) : driver.document ? formatDocument(driver.document) : 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">RNTRC:</span>
                  <span className="text-sm">{driver.rntrc || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contato e Endereço */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Contato</h4>
            </div>
            <Separator className="mb-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{driver.email || 'Não informado'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{driver.phone || driver.contact_phone || 'Não informado'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Endereço</h4>
            </div>
            <Separator className="mb-3" />
            <p className="text-sm">{formatAddress()}</p>
          </CardContent>
        </Card>
      </div>


      {/* CNH */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Carteira Nacional de Habilitação (CNH)</h4>
            </div>
            {isCnhExpired ? (
              <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> CNH Vencida</Badge>
            ) : driver.cnh_expiry_date ? (
              <Badge className="bg-green-500/20 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> CNH Válida</Badge>
            ) : null}
          </div>
          <Separator className="mb-3" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Categoria</span>
                  <p className="font-semibold text-lg">{driver.cnh_category || 'Não informada'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Validade</span>
                  <p className={`font-semibold text-lg ${isCnhExpired ? 'text-destructive' : ''}`}>
                    {driver.cnh_expiry_date 
                      ? new Date(driver.cnh_expiry_date).toLocaleDateString('pt-BR')
                      : 'Não informada'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                {getValidationBadge(driver.cnh_validation_status)}
              </div>
            </div>

            {/* Foto da CNH */}
            <div className="relative group">
              <div 
                className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[150px] cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
                onClick={() => driver.cnh_photo_url ? setPreviewImage(driver.cnh_photo_url) : cnhInputRef.current?.click()}
              >
                {driver.cnh_photo_url ? (
                  <>
                    <img 
                      src={driver.cnh_photo_url} 
                      alt="CNH" 
                      className="max-h-[130px] object-contain rounded"
                    />
                    {companyId && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={(e) => { e.stopPropagation(); cnhInputRef.current?.click(); }}
                        >
                          <Camera className="h-4 w-4 mr-1" /> Alterar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); handleRemovePhoto('cnh'); }}
                        >
                          <X className="h-4 w-4 mr-1" /> Remover
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Foto da CNH não enviada</span>
                    {companyId && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => cnhInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-1" /> Adicionar foto
                      </Button>
                    )}
                  </>
                )}
              </div>
              <input
                ref={cnhInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'cnh')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selfie / Foto de Identificação */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Foto de Identificação (Selfie)</h4>
            </div>
            {getValidationBadge(driver.document_validation_status)}
          </div>
          <Separator className="mb-3" />
          
          <div className="relative group max-w-xs">
            <div 
              className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px] cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
              onClick={() => driver.selfie_url ? setPreviewImage(driver.selfie_url) : selfieInputRef.current?.click()}
            >
              {driver.selfie_url ? (
                <>
                  <img 
                    src={driver.selfie_url} 
                    alt="Selfie" 
                    className="max-h-[180px] object-contain rounded"
                  />
                  {companyId && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); selfieInputRef.current?.click(); }}
                      >
                        <Camera className="h-4 w-4 mr-1" /> Alterar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={(e) => { e.stopPropagation(); handleRemovePhoto('selfie'); }}
                      >
                        <X className="h-4 w-4 mr-1" /> Remover
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <User className="h-10 w-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Selfie não enviada</span>
                  {companyId && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => selfieInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-1" /> Adicionar foto
                    </Button>
                  )}
                </>
              )}
            </div>
            <input
              ref={selfieInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'selfie')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rodapé com informações de cadastro */}
      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Cadastrado em:</span>
              <span className="font-medium text-foreground">
                {driver.created_at 
                  ? new Date(driver.created_at).toLocaleDateString('pt-BR', { 
                      day: '2-digit', month: 'long', year: 'numeric' 
                    })
                  : 'Não informado'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Tipo:</span>
              <span className="font-medium text-foreground">{driver.role || 'Motorista'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Preview de Imagem */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualização da Imagem</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
