export function logAuthState() {
  console.group('🔐 Estado de Autenticação');
  
  const hasToken = !!localStorage.getItem('sb-shnvtxejjecbnztdbbbl-auth-token');
  const hasSession = !!sessionStorage.getItem('supabase.auth.token');
  
  console.log('Token no localStorage:', hasToken ? '✅ Existe' : '❌ Não existe');
  console.log('Sessão no sessionStorage:', hasSession ? '✅ Existe' : '❌ Não existe');
  
  const allKeys = Object.keys(localStorage);
  const authKeys = allKeys.filter(k => k.startsWith('sb-'));
  console.log('Chaves de auth no localStorage:', authKeys);
  
  console.groupEnd();
}

export function clearAllAuthData() {
  console.warn('🧹 Limpando TODOS os dados de autenticação...');
  
  localStorage.clear();
  sessionStorage.clear();
  
  console.log('✅ Dados limpos. Recarregue a página e faça login novamente.');
}
