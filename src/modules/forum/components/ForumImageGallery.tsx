import React, { useState } from 'react';
import { X, Download, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ForumAttachmentWithUrl } from '../hooks/useForumAttachments';

interface ForumImageGalleryProps {
  attachments: ForumAttachmentWithUrl[];
  compact?: boolean;
}

export function ForumImageGallery({ attachments, compact }: ForumImageGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const images = attachments.filter(a => a.mime_type.startsWith('image/') && a.signed_url);
  const files = attachments.filter(a => !a.mime_type.startsWith('image/') && a.signed_url);

  if (images.length === 0 && files.length === 0) return null;

  const gridClass = images.length === 1
    ? 'grid-cols-1 max-w-md'
    : images.length === 2
      ? 'grid-cols-2 max-w-lg'
      : images.length === 3
        ? 'grid-cols-3 max-w-2xl'
        : 'grid-cols-2 sm:grid-cols-3 max-w-2xl';

  return (
    <>
      {/* Image grid */}
      {images.length > 0 && (
        <div className={`grid ${gridClass} gap-2 ${compact ? 'mt-1' : 'mt-3'}`}>
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxIdx(idx); }}
              className="relative group overflow-hidden rounded-lg border bg-muted aspect-square"
            >
              <img
                src={img.signed_url!}
                alt="Anexo"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Non-image files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map(f => (
            <a
              key={f.id}
              href={f.signed_url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-xs hover:bg-muted/80 transition-colors border"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="truncate max-w-[120px]">
                {f.file_path.split('/').pop()}
              </span>
              <span className="text-muted-foreground">
                ({(f.size_bytes / 1024).toFixed(0)}KB)
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxIdx !== null} onOpenChange={() => setLightboxIdx(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          {lightboxIdx !== null && images[lightboxIdx] && (
            <div className="relative">
              <button
                onClick={() => setLightboxIdx(null)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={images[lightboxIdx].signed_url!}
                alt="Anexo ampliado"
                className="w-full max-h-[80vh] object-contain"
              />
              {images.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxIdx(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        idx === lightboxIdx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
