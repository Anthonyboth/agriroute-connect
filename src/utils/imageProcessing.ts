/**
 * Unified Image Processing Pipeline
 * 
 * Handles camera output normalization, compression, and Blob creation
 * across all platforms: Android (content://), iOS (file://), Web (base64/webPath).
 * 
 * RULE: Supabase Storage must ONLY receive Blob or File objects.
 * NEVER send raw base64 strings, local URIs, or sandbox paths.
 */

import { dataUrlToBlob, getFileExtensionFromMime } from '@/utils/imageDataUrl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompressOptions {
  /** Maximum width in pixels. Height scales proportionally. Default 1280 */
  maxWidth?: number;
  /** JPEG quality 0–1. Default 0.8 */
  quality?: number;
  /** Output MIME. Default image/jpeg */
  outputMime?: string;
}

export interface ProcessedImage {
  blob: Blob;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Core: URI → Blob (platform-safe)
// ---------------------------------------------------------------------------

/**
 * Converts any camera-returned URI to a Blob.
 *
 * - data: URLs   → manual atob conversion (safe on iOS WKWebView)
 * - http/https   → fetch
 * - content://   → fetch (Android WebView handles this)
 * - file://      → fetch (iOS sandbox)
 * - Capacitor webPath → fetch
 */
export async function uriToBlob(uri: string): Promise<Blob> {
  console.log('[ImageProcessing] uriToBlob input type:', uri.substring(0, 30));

  // data: URL → manual conversion (iOS WKWebView can fail with fetch on large data URLs)
  if (uri.startsWith('data:')) {
    try {
      return dataUrlToBlob(uri);
    } catch (err) {
      console.error('[ImageProcessing] dataUrlToBlob fallback failed:', err);
      throw new Error('Não foi possível processar a imagem capturada.');
    }
  }

  // All other URIs (http, https, content://, file://, capacitor webPath)
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error('Fetch retornou blob vazio');
    }
    console.log('[ImageProcessing] uriToBlob fetch OK, size:', blob.size);
    return blob;
  } catch (err) {
    console.error('[ImageProcessing] uriToBlob fetch error:', err);
    throw new Error('Não foi possível ler o arquivo da câmera.');
  }
}

// ---------------------------------------------------------------------------
// Core: Compress image via canvas
// ---------------------------------------------------------------------------

/**
 * Compresses an image Blob using an off-screen canvas.
 * Returns the compressed Blob (always JPEG by default).
 * If the source is smaller than maxWidth, it is re-encoded without resizing.
 */
export async function compressImage(
  sourceBlob: Blob,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1280,
    quality = 0.8,
    outputMime = 'image/jpeg',
  } = options;

  console.log('[ImageProcessing] compressImage start, input size:', sourceBlob.size);

  // Skip compression for non-image or HEIC (browser can't render to canvas)
  const mime = (sourceBlob.type || '').toLowerCase();
  if (mime.includes('heic') || mime.includes('heif')) {
    console.log('[ImageProcessing] HEIC/HEIF detected, skipping canvas compression');
    return sourceBlob;
  }

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(sourceBlob);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      console.warn('[ImageProcessing] Compress timeout, returning original');
      resolve(sourceBlob);
    }, 8000);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);

      let targetW = img.naturalWidth;
      let targetH = img.naturalHeight;

      if (targetW > maxWidth) {
        const ratio = maxWidth / targetW;
        targetW = maxWidth;
        targetH = Math.round(targetH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[ImageProcessing] Canvas 2d context unavailable');
        resolve(sourceBlob);
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (result) => {
          if (!result || result.size === 0) {
            console.warn('[ImageProcessing] Canvas toBlob empty, returning original');
            resolve(sourceBlob);
            return;
          }

          console.log('[ImageProcessing] Compressed:', {
            from: sourceBlob.size,
            to: result.size,
            ratio: `${Math.round((result.size / sourceBlob.size) * 100)}%`,
            dimensions: `${targetW}x${targetH}`,
          });

          resolve(result);
        },
        outputMime,
        quality
      );
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      console.warn('[ImageProcessing] Image load failed, returning original');
      resolve(sourceBlob);
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// High-level: Process camera result into upload-ready File
// ---------------------------------------------------------------------------

/**
 * Full pipeline: takes a raw camera result and returns a compressed,
 * upload-ready File with preview URL.
 *
 * @param source - dataUrl, webPath, or file/content URI from camera
 * @param fileNamePrefix - e.g. "document", "selfie", "cnh"
 * @param compress - compression options (pass false to skip)
 */
export async function processCameraImage(
  source: string,
  fileNamePrefix: string,
  compress: CompressOptions | false = {}
): Promise<ProcessedImage> {
  console.log('[ImageProcessing] processCameraImage start:', fileNamePrefix);

  // Step 1: URI → Blob
  const rawBlob = await uriToBlob(source);

  if (!rawBlob.size) {
    throw new Error('Imagem capturada está vazia.');
  }

  // Step 2: Compress
  const finalBlob = compress !== false
    ? await compressImage(rawBlob, compress)
    : rawBlob;

  // Step 3: Determine extension
  const mime = finalBlob.type || 'image/jpeg';
  const ext = getFileExtensionFromMime(mime);

  // Step 4: Create File
  const file = new File(
    [finalBlob],
    `${fileNamePrefix}_${Date.now()}.${ext}`,
    { type: mime }
  );

  // Step 5: Preview URL
  const previewUrl = URL.createObjectURL(finalBlob);

  // Step 6: Get dimensions for logging
  const dimensions = await getImageDimensions(finalBlob).catch(() => ({ width: 0, height: 0 }));

  console.log('[ImageProcessing] processCameraImage complete:', {
    fileName: file.name,
    size: file.size,
    type: mime,
    dimensions: `${dimensions.width}x${dimensions.height}`,
  });

  return {
    blob: finalBlob,
    file,
    previewUrl,
    width: dimensions.width,
    height: dimensions.height,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('timeout'));
    }, 3000);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('load failed'));
    };
    img.src = url;
  });
}

/**
 * Normalise a Capacitor Camera result into the best available URI string.
 * Prefers webPath (works cross-platform with fetch), falls back to dataUrl.
 */
export function getCameraUri(image: {
  webPath?: string;
  path?: string;
  dataUrl?: string;
}): string {
  if (image.webPath) return image.webPath;
  if (image.dataUrl) return image.dataUrl;
  if (image.path) return image.path;
  throw new Error('Câmera não retornou imagem válida.');
}
