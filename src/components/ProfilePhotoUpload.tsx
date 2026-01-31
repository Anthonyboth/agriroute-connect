import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Camera, User, X } from 'lucide-react';
import { uploadWithAuthRetry } from '@/utils/authUploadHelper';
import { InlineSpinner } from '@/components/ui/AppSpinner';

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string;
  onUploadComplete: (url: string) => void;
  userName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  currentPhotoUrl,
  onUploadComplete,
  userName,
  size = 'md'
}) => {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl);

  // Sync local state with prop changes
  React.useEffect(() => {
    setPhotoUrl(currentPhotoUrl);
  }, [currentPhotoUrl]);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      console.log('📤 Iniciando upload da foto de perfil...');
      
      // Extrair extensão do arquivo
      const fileExt = file.name.split('.').pop() || 'jpg';

      // Usar upload com retry de autenticação (gera fileName internamente)
      const result = await uploadWithAuthRetry({
        file,
        bucketName: 'profile-photos',
        fileType: 'profile',
        fileExt
      });
      
      if ('error' in result) {
        if (result.error === 'AUTH_EXPIRED') {
          console.log('🔄 Sessão expirada, redirecionando...');
          return; // Já está redirecionando para login
        }
        console.error('❌ Erro no upload:', result.error);
        throw new Error(result.error);
      }

      console.log('✅ Foto de perfil enviada com sucesso!');
      setPhotoUrl(result.publicUrl);
      onUploadComplete(result.publicUrl);
      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro fatal no upload da foto de perfil:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('autenticad')) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
      } else {
        toast.error('Erro ao enviar foto. Tente novamente.');
      }
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!photoUrl) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Extrair o nome do arquivo da URL
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${user.id}/${fileName}`;

      // Remover do storage
      const { error } = await supabase.storage
        .from('profile-photos')
        .remove([filePath]);

      if (error) {
        console.warn('Error removing file from storage:', error);
        // Continuar mesmo se der erro na remoção do storage
      }

      setPhotoUrl('');
      onUploadComplete('');
      toast.success('Foto removida com sucesso!');
    } catch (error: any) {
      console.error('Error removing photo:', error);
      toast.error('Erro ao remover foto');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <Label>Foto de Perfil</Label>
      
      <div className="flex items-center gap-4">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={photoUrl} alt={userName || 'Usuário'} />
          <AvatarFallback className="bg-primary/10 text-primary">
            <User className="h-6 w-6" />
            {userName && (
              <span className="absolute inset-0 flex items-center justify-center font-semibold">
                {getInitials(userName)}
              </span>
            )}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="profile-photo-upload"
            />
            <Label
              htmlFor="profile-photo-upload"
              className="cursor-pointer"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                asChild
              >
                <span>
                  {uploading ? (
                    <>
                      <InlineSpinner />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      {photoUrl ? 'Alterar' : 'Adicionar'}
                    </>
                  )}
                </span>
              </Button>
            </Label>

            {photoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removePhoto}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: JPG, PNG, WEBP (máx. 5MB)
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePhotoUpload;