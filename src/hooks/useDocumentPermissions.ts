/**
 * Hook para controlar permissões de documentos fiscais por tipo de usuário
 * 
 * Matriz de Permissões:
 * - Motorista: NF-e, CT-e, MDF-e, GT-A (ver/anexar)
 * - Prestador de Serviços: APENAS NF-e
 * - Produtor: NF-e, GT-A (upload)
 * - Transportadora: Todos os documentos
 */

export type UserRole = 
  | 'MOTORISTA' 
  | 'MOTORISTA_AFILIADO' 
  | 'PRESTADOR_SERVICOS' 
  | 'PRODUTOR' 
  | 'TRANSPORTADORA';

export interface DocumentPermissions {
  canEmitNfe: boolean;
  canEmitCte: boolean;
  canEmitMdfe: boolean;
  canUploadGta: boolean;
  canViewGta: boolean;
  canManageAllDocuments: boolean;
}

export function useDocumentPermissions(userRole: string | undefined): DocumentPermissions {
  const role = userRole as UserRole | undefined;
  
  // Todos podem emitir NF-e
  const canEmitNfe = true;
  
  // CT-e e MDF-e: Apenas motoristas e transportadoras
  const canEmitCte = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(role || '');
  const canEmitMdfe = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(role || '');
  
  // GT-A: Todos exceto prestador de serviços
  const canUploadGta = role !== 'PRESTADOR_SERVICOS';
  const canViewGta = role !== 'PRESTADOR_SERVICOS';
  
  // Gerenciar todos: apenas transportadoras
  const canManageAllDocuments = role === 'TRANSPORTADORA';
  
  return {
    canEmitNfe,
    canEmitCte,
    canEmitMdfe,
    canUploadGta,
    canViewGta,
    canManageAllDocuments,
  };
}

// Descrições amigáveis para documentos bloqueados
export const BLOCKED_DOCUMENT_REASONS: Record<string, string> = {
  CTE_BLOCKED: 'CT-e é exclusivo para motoristas e transportadoras que realizam transporte de cargas.',
  MDFE_BLOCKED: 'MDF-e é exclusivo para motoristas e transportadoras em operações de transporte.',
  GTA_BLOCKED: 'GT-A é utilizado apenas em operações de transporte de animais vivos.',
};
