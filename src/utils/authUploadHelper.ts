import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadWithRetryOptions {
  file: File;
  bucketName: string;
  fileType: string;
  fileExt: string;
  maxRetries?: number;
}

export async function uploadWithAuthRetry({
  file,
  bucketName,
  fileType,
  fileExt,
  maxRetries = 2
}: UploadWithRetryOptions): Promise<{ publicUrl: string } | { error: string }> {
  
  console.log(`[Upload] Iniciando upload - Tentativas máximas: ${maxRetries + 1}`);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 1. Verificar sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log(`[Upload] Tentativa ${attempt + 1}: Sessão ${session ? 'encontrada' : 'não encontrada'}`);
      
      if (sessionError || !session) {
        // 2. Tentar refresh de sessão
        if (attempt < maxRetries) {
          console.log(`[Upload] Tentativa ${attempt + 1}: Sessão inválida, tentando refresh...`);
          
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshData.session) {
            if (attempt === maxRetries - 1) {
              // Última tentativa falhou - redirecionar para login
              console.error('[Upload] Todas tentativas de refresh falharam');
              toast.error('Sua sessão expirou. Redirecionando para login...');
              setTimeout(() => {
                localStorage.setItem('redirect_after_login', window.location.pathname);
                window.location.href = '/auth';
              }, 1500);
              return { error: 'AUTH_EXPIRED' };
            }
            continue; // Tentar novamente
          }
          
          console.log('[Upload] Sessão renovada com sucesso');
        } else {
          return { error: 'AUTH_REQUIRED' };
        }
      }
      
      // 3. Obter usuário autenticado (com retry interno)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error(`[Upload] Tentativa ${attempt + 1}: Erro ao obter usuário`, userError?.message);
        if (attempt < maxRetries) {
          console.log(`[Upload] Aguardando 500ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        throw new Error('Usuário não autenticado após todas as tentativas');
      }
      
      console.log(`[Upload] Usuário autenticado: ${user.id}`);
      
      // 4. Gerar nome do arquivo com user.id
      const fileName = `${user.id}/${fileType}_${Date.now()}.${fileExt}`;
      console.log(`[Upload] Nome do arquivo gerado: ${fileName}`);
      
      // 5. Fazer upload
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);
      
      if (uploadError) {
        console.error('[Upload] Erro no upload:', uploadError.message);
        throw uploadError;
      }
      
      console.log('[Upload] Upload concluído com sucesso');
      
      // 6. Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);
      
      console.log('[Upload] URL pública obtida:', publicUrl);
      
      return { publicUrl };
      
    } catch (error: any) {
      console.error(`[Upload] Tentativa ${attempt + 1} falhou:`, error.message);
      
      if (attempt === maxRetries) {
        return { error: error.message };
      }
      
      // Wait antes de retry
      console.log(`[Upload] Aguardando 1s antes da próxima tentativa...`);
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
