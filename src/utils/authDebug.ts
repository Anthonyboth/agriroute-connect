export function logAuthState() {
  if (!import.meta.env.DEV) return;
  console.group('🔐 Estado de Autenticação');
  
  const hasToken = !!localStorage.getItem('sb-shnvtxejjecbnztdbbbl-auth-token');
  const hasSession = !!sessionStorage.getItem('supabase.auth.token');
  
  if (import.meta.env.DEV) console.log('Token no localStorage:', hasToken ? '✅ Existe' : '❌ Não existe');
  if (import.meta.env.DEV) console.log('Sessão no sessionStorage:', hasSession ? '✅ Existe' : '❌ Não existe');
  
  const allKeys = Object.keys(localStorage);
  const authKeys = allKeys.filter(k => k.startsWith('sb-'));
  if (import.meta.env.DEV) console.log('Chaves de auth no localStorage:', authKeys);
  
  console.groupEnd();
}

export function clearAllAuthData() {
  console.warn('🧹 Limpando TODOS os dados de autenticação...');
  
  localStorage.clear();
  sessionStorage.clear();
  
  if (import.meta.env.DEV) console.log('✅ Dados limpos. Recarregue a página e faça login novamente.');
}
