import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadWithRetryOptions {
  file: File;
  bucketName: string;
  fileName: string;
  maxRetries?: number;
}

export async function uploadWithAuthRetry({
  file,
  bucketName,
  fileName,
  maxRetries = 2
}: UploadWithRetryOptions): Promise<{ publicUrl: string } | { error: string }> {
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 1. Verificar sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // 2. Tentar refresh de sessão
        if (attempt < maxRetries) {
          console.log(`[Upload] Tentativa ${attempt + 1}: Sessão inválida, tentando refresh...`);
          
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshData.session) {
            if (attempt === maxRetries - 1) {
              // Última tentativa falhou - redirecionar para login
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
      
      // 3. Verificar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait antes de retry
          continue;
        }
        throw new Error('User not authenticated');
      }
      
      // 4. Fazer upload
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // 5. Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);
      
      return { publicUrl };
      
    } catch (error: any) {
      console.error(`[Upload] Tentativa ${attempt + 1} falhou:`, error.message);
      
      if (attempt === maxRetries) {
        return { error: error.message };
      }
      
      // Wait antes de retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
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
