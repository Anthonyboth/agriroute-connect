import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/devLogger';

interface SelfieUploadResult {
  success: boolean;
  signedUrl?: string;
  filePath?: string;
  error?: {
    stage: 'auth' | 'upload' | 'signed_url' | 'database';
    status?: number;
    code?: string;
    message: string;
    details?: string;
    hint?: string;
  };
}

interface SelfieUploadParams {
  blob: Blob;
  uploadMethod: 'CAMERA' | 'GALLERY';
}

/**
 * Faz upload de selfie com instrumentação completa e tratamento de erro detalhado.
 */
export async function uploadSelfieWithInstrumentation({
  blob,
  uploadMethod,
}: SelfieUploadParams): Promise<SelfieUploadResult> {
  
  console.log('[SELFIE-UPLOAD] === INICIANDO UPLOAD ===');
  console.log('[SELFIE-UPLOAD] Blob size:', blob.size, 'bytes');
  console.log('[SELFIE-UPLOAD] Blob type:', blob.type || '(empty)');
  console.log('[SELFIE-UPLOAD] Upload method:', uploadMethod);
  console.log('[SELFIE-UPLOAD] Platform:', typeof window !== 'undefined' ? navigator.userAgent.substring(0, 80) : 'unknown');

  // FRT-046: Validate payload before upload
  if (!blob || blob.size === 0) {
    console.error('[SELFIE-UPLOAD] BLOQUEADO: blob nulo ou vazio');
    return {
      success: false,
      error: { stage: 'upload', code: 'EMPTY_BLOB', message: 'Imagem vazia ou inválida. Tente capturar novamente.' },
    };
  }

  const normalizeMime = (inputMime?: string) => {
    const normalized = (inputMime || '').toLowerCase().trim();
    if (!normalized || normalized === 'application/octet-stream' || normalized === 'binary/octet-stream' || normalized === 'image/*') {
      return 'image/jpeg';
    }
    if (normalized === 'image/heic' || normalized === 'image/heif') return normalized;
    if (normalized.startsWith('image/')) return normalized;
    return 'image/jpeg';
  };

  const rawMime = blob.type;
  const mime = normalizeMime(rawMime);
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };

  if (rawMime !== mime) {
    console.warn('[SELFIE-UPLOAD] MIME normalizado:', { original: rawMime || '(empty)', normalized: mime });
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[SELFIE-UPLOAD] Erro ao obter sessão:', sessionError);
      return {
        success: false,
        error: { stage: 'auth', code: 'SESSION_ERROR', message: 'Erro ao verificar sessão.', details: sessionError.message },
      };
    }
    
    if (!sessionData?.session) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        return {
          success: false,
          error: { stage: 'auth', status: 401, code: 'SESSION_EXPIRED', message: 'Sessão expirada. Faça login novamente.', details: refreshError?.message },
        };
      }
      devLog('[SELFIE-UPLOAD] Sessão renovada com sucesso');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('[SELFIE-UPLOAD] Erro ao obter usuário:', userError);
      return {
        success: false,
        error: { stage: 'auth', status: 401, code: 'USER_NOT_FOUND', message: 'Usuário não autenticado.', details: userError?.message },
      };
    }

    devLog('[SELFIE-UPLOAD] Usuário autenticado:', user.id);

    const extFromMime = extMap[mime] || 'jpg';
    const safeExt = extFromMime;
    const filePath = `selfies/${user.id}/identity_selfie_${Date.now()}.${safeExt}`;
    
    devLog('[SELFIE-UPLOAD] Destino: bucket=identity-selfies, path=', filePath);

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('identity-selfies')
      .upload(filePath, blob, { 
        contentType: mime,
        upsert: true,
      });
    
    if (uploadError) {
      console.error('[SELFIE-UPLOAD] Erro no upload:', uploadError);
      return {
        success: false,
        error: {
          stage: 'upload',
          status: (uploadError as any)?.statusCode,
          code: (uploadError as any)?.error || 'UPLOAD_ERROR',
          message: 'Erro ao enviar selfie.',
          details: uploadError.message,
        },
      };
    }

    devLog('[SELFIE-UPLOAD] Upload bem-sucedido:', uploadData?.path);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('identity-selfies')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[SELFIE-UPLOAD] Erro ao gerar signed URL:', signedUrlError);
      return {
        success: false,
        error: {
          stage: 'signed_url',
          code: 'SIGNED_URL_ERROR',
          message: 'Selfie enviada, mas erro ao gerar URL.',
          details: signedUrlError?.message,
        },
      };
    }

    devLog('[SELFIE-UPLOAD] Signed URL gerada com sucesso');

    // FRT-046: Return relative path for DB storage, signedUrl only for immediate preview
    const relativeFilePath = `identity-selfies/${filePath}`;
    console.log('[SELFIE-UPLOAD] ✅ Upload completo. Relative path:', relativeFilePath);

    return {
      success: true,
      signedUrl: signedUrlData.signedUrl,
      filePath: relativeFilePath,
    };
  } catch (error: any) {
    console.error('[SELFIE-UPLOAD] Erro inesperado:', error);
    return {
      success: false,
      error: {
        stage: 'upload',
        code: 'UNEXPECTED_ERROR',
        message: 'Erro inesperado ao enviar selfie.',
        details: error?.message,
      },
    };
  }
}
