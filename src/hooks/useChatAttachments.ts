import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useChatAttachments(userProfileId: string) {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Validar tamanho (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB.');
        return null;
      }

      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de imagem não suportado. Use JPEG, PNG, WEBP ou GIF.');
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfileId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('chat-interno-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Use signed URL for private bucket (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('chat-interno-images')
        .createSignedUrl(data.path, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      return signedUrlData.signedUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload de imagem:', error);
      toast.error(error.message || 'Erro ao enviar imagem');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number } | null> => {
    try {
      setIsUploading(true);

      // Validar tamanho (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB.');
        return null;
      }

      // Validar tipo
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de arquivo não suportado. Use PDF, Word, Excel, TXT ou CSV.');
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${userProfileId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('chat-interno-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Use signed URL for private bucket (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('chat-interno-files')
        .createSignedUrl(data.path, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      return {
        url: signedUrlData.signedUrl,
        name: file.name,
        size: file.size,
      };
    } catch (error: any) {
      console.error('Erro ao fazer upload de arquivo:', error);
      toast.error(error.message || 'Erro ao enviar arquivo');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImage,
    uploadFile,
    isUploading,
  };
}
