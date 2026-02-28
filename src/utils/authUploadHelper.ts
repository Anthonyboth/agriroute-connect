import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { devLog } from '@/lib/devLogger';

function isPublicOrPreAuthRoute(): boolean {
  const path = window.location.pathname;
  return (
    path === '/' ||
    path.startsWith('/sobre') ||
    path.startsWith('/ajuda') ||
    path.startsWith('/cadastro-motorista') ||
    path.startsWith('/cadastro-motorista-afiliado')
  );
}

interface UploadWithRetryOptions {
  file: File;
  bucketName: string;
  fileType: string;
  fileExt: string;
  maxRetries?: number;
}

export async function uploadWithAuthRetry({
  file, bucketName, fileType, fileExt, maxRetries = 2
}: UploadWithRetryOptions): Promise<{ publicUrl: string } | { error: string }> {
  
  devLog(`[Upload] Iniciando upload - Tentativas máximas: ${maxRetries + 1}`);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      devLog(`[Upload] Tentativa ${attempt + 1}: Sessão ${session ? 'encontrada' : 'não encontrada'}`);
      
      if (sessionError || !session) {
        if (attempt < maxRetries) {
          devLog(`[Upload] Tentativa ${attempt + 1}: Sessão inválida, tentando refresh...`);
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            if (attempt === maxRetries - 1) {
              console.error('[Upload] Todas tentativas de refresh falharam');
              if (isPublicOrPreAuthRoute()) {
                console.warn('[Upload] Sessão expirada em rota pública/pré-auth - pulando redirect');
                return { error: 'AUTH_REQUIRED' };
              }
              toast.error('Sua sessão expirou. Redirecionando para login...');
              setTimeout(() => {
                localStorage.setItem('redirect_after_login', window.location.pathname);
                window.location.href = '/auth';
              }, 1500);
              return { error: 'AUTH_EXPIRED' };
            }
            continue;
          }
          devLog('[Upload] Sessão renovada com sucesso');
        } else {
          return { error: 'AUTH_REQUIRED' };
        }
      }
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error(`[Upload] Tentativa ${attempt + 1}: Erro ao obter usuário`, userError?.message);
        if (attempt < maxRetries) {
          devLog(`[Upload] Aguardando 500ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        throw new Error('Usuário não autenticado após todas as tentativas');
      }
      
      devLog(`[Upload] Usuário autenticado: ${user.id}`);
      const fileName = `${user.id}/${fileType}_${Date.now()}.${fileExt}`;
      devLog(`[Upload] Nome do arquivo gerado: ${fileName}`);
      
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, file);
      if (uploadError) {
        console.error('[Upload] Erro no upload:', uploadError.message);
        throw uploadError;
      }
      
      // ✅ CRITICAL: Retornar PATH RELATIVO para salvar no banco, NUNCA signed URL
      // O componente StorageImage/useSignedImageUrl gera signed URLs em tempo de renderização
      const relativePath = `${bucketName}/${fileName}`;
      devLog('[Upload] Path relativo salvo:', relativePath);
      return { publicUrl: relativePath };
      
    } catch (error: any) {
      console.error(`[Upload] Tentativa ${attempt + 1} falhou:`, error.message);
      if (attempt === maxRetries) return { error: error.message };
      devLog(`[Upload] Aguardando 1s antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('[Upload] Máximo de tentativas excedido');
  return { error: 'MAX_RETRIES_EXCEEDED' };
}

export async function ensureValidSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      return !!refreshData.session;
    }
    return true;
  } catch {
    return false;
  }
}
