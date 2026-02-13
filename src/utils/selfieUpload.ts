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
  
  devLog('[SELFIE-UPLOAD] === INICIANDO UPLOAD ===');
  devLog('[SELFIE-UPLOAD] Blob size:', blob.size, 'bytes');
  devLog('[SELFIE-UPLOAD] Blob type:', blob.type);
  devLog('[SELFIE-UPLOAD] Upload method:', uploadMethod);

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

    const mime = blob.type || 'image/jpeg';
    const extFromMime = (mime.split('/')[1] || 'jpg').toLowerCase();
    const safeExt = extFromMime === 'jpeg' ? 'jpg' : extFromMime;
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

    return {
      success: true,
      signedUrl: signedUrlData.signedUrl,
      filePath,
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
