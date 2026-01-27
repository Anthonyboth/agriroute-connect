import { supabase } from '@/integrations/supabase/client';

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
 * Retorna erro estruturado para exibição ao usuário.
 */
export async function uploadSelfieWithInstrumentation({
  blob,
  uploadMethod,
}: SelfieUploadParams): Promise<SelfieUploadResult> {
  
  // 1. LOG ANTES DO UPLOAD
  console.log('[SELFIE-UPLOAD] === INICIANDO UPLOAD ===');
  console.log('[SELFIE-UPLOAD] Blob size:', blob.size, 'bytes');
  console.log('[SELFIE-UPLOAD] Blob type:', blob.type);
  console.log('[SELFIE-UPLOAD] Upload method:', uploadMethod);
  console.log('[SELFIE-UPLOAD] Timestamp:', new Date().toISOString());

  // 2. VALIDAR AUTENTICAÇÃO
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[SELFIE-UPLOAD] Erro ao obter sessão:', sessionError);
      return {
        success: false,
        error: {
          stage: 'auth',
          code: 'SESSION_ERROR',
          message: 'Erro ao verificar sessão.',
          details: sessionError.message,
        },
      };
    }

    if (!sessionData.session) {
      console.warn('[SELFIE-UPLOAD] Sessão não encontrada, tentando refresh...');
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('[SELFIE-UPLOAD] Refresh falhou:', refreshError?.message);
        return {
          success: false,
          error: {
            stage: 'auth',
            status: 401,
            code: 'SESSION_EXPIRED',
            message: 'Sessão expirada. Faça login novamente.',
            details: refreshError?.message,
          },
        };
      }
      
      console.log('[SELFIE-UPLOAD] Sessão renovada com sucesso');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('[SELFIE-UPLOAD] Erro ao obter usuário:', userError);
      return {
        success: false,
        error: {
          stage: 'auth',
          status: 401,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não autenticado.',
          details: userError?.message,
        },
      };
    }

    console.log('[SELFIE-UPLOAD] Usuário autenticado:', user.id);

    // 3. PREPARAR ARQUIVO
    const mime = blob.type || 'image/jpeg';
    const extFromMime = (mime.split('/')[1] || 'jpg').toLowerCase();
    const safeExt = extFromMime === 'jpeg' ? 'jpg' : extFromMime;
    const filePath = `${user.id}/identity_selfie_${Date.now()}.${safeExt}`;
    
    console.log('[SELFIE-UPLOAD] Destino: bucket=profile-photos, path=', filePath);
    console.log('[SELFIE-UPLOAD] Content-Type:', mime);

    // 4. FAZER UPLOAD
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, blob, { 
        contentType: mime,
        upsert: false, // Não sobrescrever
      });

    if (uploadError) {
      console.error('[SELFIE-UPLOAD] ❌ ERRO NO UPLOAD:');
      console.error('[SELFIE-UPLOAD]   status:', (uploadError as any).status);
      console.error('[SELFIE-UPLOAD]   statusCode:', (uploadError as any).statusCode);
      console.error('[SELFIE-UPLOAD]   message:', uploadError.message);
      console.error('[SELFIE-UPLOAD]   name:', uploadError.name);
      console.error('[SELFIE-UPLOAD]   details:', (uploadError as any).details);
      console.error('[SELFIE-UPLOAD]   hint:', (uploadError as any).hint);
      console.error('[SELFIE-UPLOAD]   error object:', JSON.stringify(uploadError, null, 2));

      // Mapear erros comuns para mensagens amigáveis
      const status = (uploadError as any).status || (uploadError as any).statusCode;
      let userMessage = 'Erro ao enviar arquivo.';
      
      if (status === 401) {
        userMessage = 'Sessão expirada. Faça login novamente.';
      } else if (status === 403) {
        userMessage = 'Permissão negada para enviar arquivo.';
      } else if (status === 413) {
        userMessage = 'Arquivo muito grande. Máximo 10MB.';
      } else if (status === 400) {
        userMessage = 'Arquivo inválido ou corrompido.';
      } else if (uploadError.message?.includes('Duplicate')) {
        userMessage = 'Arquivo já existe. Tente novamente.';
      }

      return {
        success: false,
        error: {
          stage: 'upload',
          status,
          code: uploadError.name || 'UPLOAD_ERROR',
          message: userMessage,
          details: uploadError.message,
          hint: (uploadError as any).hint,
        },
      };
    }

    console.log('[SELFIE-UPLOAD] ✅ Upload concluído:', uploadData?.path);

    // 5. CRIAR URL ASSINADA (bucket é privado por padrão)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('profile-photos')
      .createSignedUrl(filePath, 60 * 60 * 24); // 24h

    if (signedError) {
      console.error('[SELFIE-UPLOAD] ❌ ERRO AO CRIAR URL ASSINADA:');
      console.error('[SELFIE-UPLOAD]   message:', signedError.message);
      console.error('[SELFIE-UPLOAD]   error object:', JSON.stringify(signedError, null, 2));

      return {
        success: false,
        error: {
          stage: 'signed_url',
          code: 'SIGNED_URL_ERROR',
          message: 'Erro ao gerar link de visualização.',
          details: signedError.message,
        },
      };
    }

    console.log('[SELFIE-UPLOAD] ✅ URL assinada criada');

    // 6. SALVAR NO BANCO DE DADOS
    const { error: dbError } = await supabase
      .from('identity_selfies')
      .upsert({
        user_id: user.id,
        selfie_url: filePath,
        upload_method: uploadMethod,
        verification_status: 'PENDING',
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('[SELFIE-UPLOAD] ❌ ERRO AO SALVAR NO BANCO:');
      console.error('[SELFIE-UPLOAD]   code:', dbError.code);
      console.error('[SELFIE-UPLOAD]   message:', dbError.message);
      console.error('[SELFIE-UPLOAD]   details:', dbError.details);
      console.error('[SELFIE-UPLOAD]   hint:', dbError.hint);
      console.error('[SELFIE-UPLOAD]   error object:', JSON.stringify(dbError, null, 2));

      // Mapear erros RLS
      let userMessage = 'Erro ao salvar dados.';
      
      if (dbError.code === '42501' || dbError.message?.includes('row-level security')) {
        userMessage = 'Permissão negada para salvar dados.';
      } else if (dbError.code === '23505') {
        userMessage = 'Registro já existe.';
      }

      return {
        success: false,
        error: {
          stage: 'database',
          code: dbError.code,
          message: userMessage,
          details: dbError.message,
          hint: dbError.hint,
        },
      };
    }

    console.log('[SELFIE-UPLOAD] ✅ Dados salvos no banco');
    console.log('[SELFIE-UPLOAD] === UPLOAD CONCLUÍDO COM SUCESSO ===');

    return {
      success: true,
      signedUrl: signedData.signedUrl,
      filePath,
    };

  } catch (error: any) {
    console.error('[SELFIE-UPLOAD] ❌ ERRO NÃO TRATADO:');
    console.error('[SELFIE-UPLOAD]   name:', error?.name);
    console.error('[SELFIE-UPLOAD]   message:', error?.message);
    console.error('[SELFIE-UPLOAD]   stack:', error?.stack);
    console.error('[SELFIE-UPLOAD]   full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

    return {
      success: false,
      error: {
        stage: 'auth',
        code: error?.name || 'UNKNOWN_ERROR',
        message: 'Erro inesperado. Tente novamente.',
        details: error?.message,
      },
    };
  }
}
