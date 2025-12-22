import React, { useState, useRef, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  File, 
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AdvancedUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  compress?: boolean;
  compressionQuality?: number; // 0-1
  preview?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  onUpload: (files: File[]) => Promise<void> | void;
  onError?: (error: string) => void;
}

interface FilePreview {
  file: File;
  preview: string | null;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

/**
 * Compress image using canvas
 */
async function compressImage(file: File, quality: number = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 1920px)
        let { width, height } = img;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Advanced Upload Component
 * Features: preview, compression, drag & drop, validation, progress
 */
export const AdvancedUpload = memo(function AdvancedUpload({
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  compress = true,
  compressionQuality = 0.8,
  preview = true,
  multiple = false,
  disabled = false,
  className,
  onUpload,
  onError,
}: AdvancedUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `Arquivo muito grande. Máximo: ${formatFileSize(maxSize)}`;
    }
    
    // Check file type
    if (accept !== '*') {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          const category = type.replace('/*', '');
          return file.type.startsWith(category);
        }
        return file.type === type || file.name.endsWith(type.replace('.', ''));
      });
      
      if (!isValidType) {
        return `Tipo de arquivo não permitido. Aceitos: ${accept}`;
      }
    }
    
    return null;
  }, [accept, maxSize]);

  const processFiles = useCallback(async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    
    // Check max files
    if (files.length + fileArray.length > maxFiles) {
      const error = `Máximo de ${maxFiles} arquivos permitidos`;
      toast({ title: 'Erro', description: error, variant: 'destructive' });
      onError?.(error);
      return;
    }

    const newFiles: FilePreview[] = [];

    for (const file of fileArray) {
      // Validate
      const validationError = validateFile(file);
      if (validationError) {
        toast({ title: 'Erro', description: validationError, variant: 'destructive' });
        onError?.(validationError);
        continue;
      }

      // Create preview for images
      let previewUrl: string | null = null;
      if (preview && file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newFiles.push({
        file,
        preview: previewUrl,
        progress: 0,
        status: 'pending',
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length, maxFiles, preview, validateFile, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (disabled) return;
    
    const droppedFiles = e.dataTransfer.files;
    processFiles(droppedFiles);
  }, [disabled, processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      processFiles(selectedFiles);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [processFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadFiles = useCallback(async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    const filesToUpload: File[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const filePreview = files[i];
        
        // Update status
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' as const, progress: 10 } : f
        ));

        let processedFile = filePreview.file;

        // Compress if needed
        if (compress && filePreview.file.type.startsWith('image/')) {
          try {
            processedFile = await compressImage(filePreview.file, compressionQuality);
            console.log(`Compressed: ${formatFileSize(filePreview.file.size)} → ${formatFileSize(processedFile.size)}`);
          } catch (err) {
            console.warn('Compression failed, using original:', err);
          }
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 50 } : f
        ));

        filesToUpload.push(processedFile);

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success' as const, progress: 100 } : f
        ));
      }

      // Call upload handler with all files
      await onUpload(filesToUpload);
      
      toast({ title: 'Sucesso', description: `${filesToUpload.length} arquivo(s) enviado(s)` });
      
      // Clear files after successful upload
      setTimeout(() => {
        setFiles([]);
      }, 1500);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar arquivos';
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
      onError?.(errorMessage);
      
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'error' as const, error: errorMessage } : f
      ));
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, compress, compressionQuality, onUpload, onError]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragActive && 'border-primary bg-primary/5 scale-[1.02]',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragActive && !disabled && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'p-3 rounded-full transition-colors',
            isDragActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Upload className="h-8 w-8" />
          </div>
          
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragActive ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {accept === '*' ? 'Todos os tipos' : accept.replace(/,/g, ', ')} • 
              Máx {formatFileSize(maxSize)}
              {maxFiles > 1 && ` • Até ${maxFiles} arquivos`}
            </p>
          </div>
        </div>
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((filePreview, index) => (
            <div
              key={`${filePreview.file.name}-${index}`}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                filePreview.status === 'error' && 'border-destructive/50 bg-destructive/5',
                filePreview.status === 'success' && 'border-green-500/50 bg-green-50 dark:bg-green-950/20',
                filePreview.status === 'pending' && 'border-border bg-card'
              )}
            >
              {/* Preview / Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {filePreview.preview ? (
                  <img 
                    src={filePreview.preview} 
                    alt={filePreview.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : filePreview.file.type.startsWith('image/') ? (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <File className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{filePreview.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(filePreview.file.size)}
                </p>
                
                {filePreview.status === 'uploading' && (
                  <Progress value={filePreview.progress} className="h-1 mt-2" />
                )}
                
                {filePreview.error && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {filePreview.error}
                  </p>
                )}
              </div>

              {/* Status / Remove */}
              <div className="flex-shrink-0">
                {filePreview.status === 'uploading' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : filePreview.status === 'success' ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : filePreview.status === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Upload button */}
          {files.some(f => f.status === 'pending') && (
            <Button
              onClick={uploadFiles}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar {files.filter(f => f.status === 'pending').length} arquivo(s)
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

export default AdvancedUpload;
