import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, VisuallyHidden } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, X, Camera, ImageIcon, ChevronLeft, ChevronRight, Upload, ExternalLink } from 'lucide-react';
import { useVehiclePhotos, PHOTO_TYPES, VehiclePhoto } from '@/hooks/useVehiclePhotos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { StorageImage } from '@/components/ui/storage-image';
import { InlineSpinner } from '@/components/ui/AppSpinner';

interface VehiclePhotoGalleryProps {
  vehicleId: string;
  isEditing?: boolean;
  minPhotos?: number;
  onPhotosChange?: (count: number) => void;
}

export const VehiclePhotoGallery: React.FC<VehiclePhotoGalleryProps> = ({
  vehicleId,
  isEditing = false,
  minPhotos = 1,
  onPhotosChange,
}) => {
  const { photos, isLoading, addPhoto, removePhoto, totalPhotos } = useVehiclePhotos(vehicleId);
  const [selectedPhoto, setSelectedPhoto] = useState<VehiclePhoto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPhotoType, setSelectedPhotoType] = useState('geral');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notificar mudanças no número de fotos
  React.useEffect(() => {
    onPhotosChange?.(totalPhotos);
  }, [totalPhotos, onPhotosChange]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 10MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${vehicleId}/${Date.now()}_${selectedPhotoType}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // ✅ Persistir caminho estável no banco (não salvar signed URL expirada)
      const storagePath = `driver-documents/${fileName}`;
      await addPhoto.mutateAsync({ photoUrl: storagePath, photoType: selectedPhotoType });
      toast.success('Foto enviada com sucesso!');
      setShowUploadModal(false);
      setSelectedPhotoType('geral');
    } catch (error: any) {
      console.error('Erro no upload:', error);
      
      // Problema 2: Mensagens de erro específicas
      let errorMessage = 'Erro ao enviar foto';
      
      if (error?.message?.includes('Payload too large') || error?.statusCode === 413) {
        errorMessage = 'Arquivo muito grande. Reduza o tamanho da imagem (máx. 10MB).';
      } else if (error?.message?.includes('Invalid file type') || error?.message?.includes('mime')) {
        errorMessage = 'Formato não suportado. Use JPG, PNG ou WebP.';
      } else if (error?.message?.includes('network') || error?.name === 'NetworkError') {
        errorMessage = 'Sem conexão com internet. Verifique sua rede e tente novamente.';
      } else if (error?.statusCode === 401 || error?.message?.includes('auth')) {
        errorMessage = 'Sessão expirada. Faça login novamente.';
      } else if (error?.statusCode === 500) {
        errorMessage = 'Erro no servidor. Tente novamente em alguns minutos.';
      } else if (error?.message) {
        errorMessage = `Erro: ${error.message}`;
      }
      
      toast.error(errorMessage, {
        description: 'Clique para tentar novamente',
        action: {
          label: 'Tentar novamente',
          onClick: () => fileInputRef.current?.click()
        }
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (photo: VehiclePhoto) => {
    if (totalPhotos <= minPhotos) {
      toast.error(`Mínimo de ${minPhotos} foto(s) obrigatória(s)`);
      return;
    }
    await removePhoto.mutateAsync(photo.id);
  };

  const openPhotoViewer = (photo: VehiclePhoto, index: number) => {
    setSelectedPhoto(photo);
    setSelectedIndex(index);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? (selectedIndex - 1 + photos.length) % photos.length
      : (selectedIndex + 1) % photos.length;
    setSelectedIndex(newIndex);
    setSelectedPhoto(photos[newIndex]);
  };

  const getPhotoTypeLabel = (type: string) => {
    return PHOTO_TYPES.find(t => t.value === type)?.label || 'Foto';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header com contador */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Fotos do Veículo ({totalPhotos})
          </span>
        </div>
        {minPhotos > 0 && (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            totalPhotos >= minPhotos 
              ? "bg-success/20 text-success" 
              : "bg-destructive/20 text-destructive"
          )}>
            Mínimo {minPhotos} foto
          </span>
        )}
      </div>

      {/* Grid de fotos estilo Instagram */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer bg-muted"
            onClick={() => openPhotoViewer(photo, index)}
          >
            <StorageImage
              src={photo.photo_url}
              alt={getPhotoTypeLabel(photo.photo_type)}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            
            {/* Overlay com tipo da foto */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
              <span className="text-[10px] text-white/90">
                {getPhotoTypeLabel(photo.photo_type)}
              </span>
            </div>

            {/* Botão de remover (apenas em modo edição) */}
            {isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto(photo);
                }}
                className="absolute top-1 right-1 w-6 h-6 bg-destructive/90 hover:bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            )}
          </div>
        ))}

        {/* Botão de adicionar foto */}
        {isEditing && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors bg-muted/30 hover:bg-muted/50"
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Adicionar</span>
          </button>
        )}

        {/* Estado vazio */}
        {photos.length === 0 && !isEditing && (
          <div className="col-span-3 py-8 text-center">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma foto adicionada</p>
          </div>
        )}
      </div>

      {/* Modal de upload */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Foto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo da Foto</Label>
              <Select value={selectedPhotoType} onValueChange={setSelectedPhotoType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHOTO_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
            {isUploading ? (
                <>
                  <InlineSpinner className="border-white/30 border-b-white" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar Foto
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de visualização ampliada */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none" aria-label="Visualização de Foto do Veículo">
          <VisuallyHidden>
            <DialogTitle>Visualização de Foto do Veículo</DialogTitle>
          </VisuallyHidden>
          <div className="relative">
            {/* Navegação */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => navigatePhoto('prev')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10"
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </button>
                <button
                  onClick={() => navigatePhoto('next')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10"
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </button>
              </>
            )}

            {/* Imagem */}
            {selectedPhoto && (
              <StorageImage
                src={selectedPhoto.photo_url}
                alt={getPhotoTypeLabel(selectedPhoto.photo_type)}
                className="w-full max-h-[80vh] object-contain"
              />
            )}

            {/* Botão abrir em nova aba */}
            {selectedPhoto && (
              <button
                onClick={() => window.open(selectedPhoto.photo_url, '_blank')}
                className="absolute top-2 left-2 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4 text-white" />
              </button>
            )}

            {/* Info da foto */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm">{selectedPhoto && getPhotoTypeLabel(selectedPhoto.photo_type)}</span>
                <span className="text-xs text-white/60">{selectedIndex + 1} de {photos.length}</span>
              </div>
            </div>

            {/* Botão fechar */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
