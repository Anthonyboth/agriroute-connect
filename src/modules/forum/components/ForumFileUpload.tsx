import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateForumFile, FORUM_MAX_FILES } from '../utils/sanitize';
import { toast } from 'sonner';

interface ForumFileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  compact?: boolean;
}

export function ForumFileUpload({ files, onFilesChange, maxFiles = FORUM_MAX_FILES, compact }: ForumFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<number, string>>({});

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      const err = validateForumFile(f);
      if (err) { toast.error(err); return false; }
      return true;
    });
    
    const newFiles = [...files, ...valid].slice(0, maxFiles);
    onFilesChange(newFiles);

    // Generate previews for images
    valid.forEach(f => {
      if (f.type.startsWith('image/')) {
        const idx = newFiles.indexOf(f);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPreviews(prev => ({ ...prev, [idx]: ev.target?.result as string }));
        };
        reader.readAsDataURL(f);
      }
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    const newFiles = files.filter((_, i) => i !== idx);
    onFilesChange(newFiles);
    setPreviews(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* Preview grid */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => (
            <div key={idx} className="relative group">
              {f.type.startsWith('image/') && previews[idx] ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                  <img src={previews[idx]} alt={f.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm border">
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <span className="text-muted-foreground text-xs">({(f.size / 1024).toFixed(0)}KB)</span>
                  <button type="button" onClick={() => removeFile(idx)}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {files.length < maxFiles && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size={compact ? 'icon' : 'sm'}
            onClick={() => fileInputRef.current?.click()}
            className={compact ? 'h-8 w-8' : ''}
          >
            {compact ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" /> Anexar imagem
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
