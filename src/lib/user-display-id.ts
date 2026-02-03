/**
 * ✅ REGRA: ID de Exibição do Usuário
 * 
 * Para usuários cadastrados: CPF formatado como 057-159-091-80 (traços ao invés de pontos)
 * Para usuários guest (sem cadastro): ID hash gerado automaticamente
 * 
 * IMPORTANTE: Este é apenas um ID de EXIBIÇÃO/REFERÊNCIA.
 * Os IDs reais no banco (UUIDs) permanecem inalterados.
 */

/**
 * Formata um CPF para o padrão de ID de exibição
 * Entrada: "057.159.091-80" ou "05715909180"
 * Saída: "057-159-091-80"
 */
export function formatCpfToDisplayId(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  
  // Remove todos os caracteres não numéricos
  const digits = cpf.replace(/\D/g, '');
  
  // CPF deve ter 11 dígitos
  if (digits.length !== 11) return null;
  
  // Formata como XXX-XXX-XXX-XX
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Gera um ID hash para usuários guest (sem cadastro)
 * Formato: GUEST-XXXXXXXX (8 caracteres alfanuméricos)
 */
export function generateGuestDisplayId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem I, O, 0, 1 para evitar confusão
  let result = 'GUEST-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Gera um ID hash determinístico baseado em string (para guest requests existentes)
 * Usa o ID do registro para gerar um hash consistente
 */
export function generateDeterministicGuestId(recordId: string): string {
  // Hash simples baseado no ID do registro
  let hash = 0;
  for (let i = 0; i < recordId.length; i++) {
    const char = recordId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'GUEST-';
  const absHash = Math.abs(hash);
  
  for (let i = 0; i < 8; i++) {
    const index = (absHash >> (i * 4)) % chars.length;
    result += chars.charAt(Math.abs(index));
  }
  
  return result;
}

/**
 * Obtém o ID de exibição de um usuário
 * 
 * @param cpf - CPF do usuário (para usuários cadastrados)
 * @param profileId - ID do perfil (UUID) como fallback
 * @param isGuest - Se é um usuário guest
 * @param guestRecordId - ID do registro guest para hash determinístico
 */
export function getUserDisplayId(options: {
  cpf?: string | null;
  profileId?: string | null;
  isGuest?: boolean;
  guestRecordId?: string | null;
}): string {
  const { cpf, profileId, isGuest, guestRecordId } = options;
  
  // 1. Se é guest, gera ID hash
  if (isGuest) {
    if (guestRecordId) {
      return generateDeterministicGuestId(guestRecordId);
    }
    return generateGuestDisplayId();
  }
  
  // 2. Se tem CPF, formata como ID de exibição
  const formattedCpf = formatCpfToDisplayId(cpf);
  if (formattedCpf) {
    return formattedCpf;
  }
  
  // 3. Fallback: primeiros 8 caracteres do UUID do perfil
  if (profileId) {
    return `USR-${profileId.slice(0, 8).toUpperCase()}`;
  }
  
  // 4. Último fallback: ID anônimo
  return 'ANON-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

/**
 * Valida se uma string é um CPF válido
 */
export function isValidCpf(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  
  const digits = cpf.replace(/\D/g, '');
  
  if (digits.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Validação do dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(10))) return false;
  
  return true;
}

/**
 * Mascara um ID de exibição para privacidade (mostra apenas últimos 4 dígitos)
 * Ex: "057-159-091-80" -> "***-***-***-80"
 */
export function maskDisplayId(displayId: string | null | undefined): string {
  if (!displayId) return '***-***-***-**';
  
  if (displayId.startsWith('GUEST-')) {
    return `GUEST-****${displayId.slice(-4)}`;
  }
  
  if (displayId.startsWith('USR-')) {
    return `USR-****${displayId.slice(-4)}`;
  }
  
  // CPF format: XXX-XXX-XXX-XX
  const parts = displayId.split('-');
  if (parts.length === 4) {
    return `***-***-***-${parts[3]}`;
  }
  
  return displayId;
}
