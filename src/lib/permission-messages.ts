/**
 * Mensagens padronizadas de permissões/restrições
 * ÚNICA FONTE DE VERDADE para todas as mensagens de bloqueio no app
 */

export const PERMISSION_MESSAGES = {
  // Driver restrictions
  DRIVER_AFFILIATED_NO_PROPOSAL: 
    "Apenas motorista autônomo pode enviar proposta. Se você é filiado/empregado, compartilhe com sua transportadora.",
  
  DRIVER_COMPANY_DISABLED_PLATFORM:
    "Sua transportadora desabilitou a busca de fretes da plataforma. Entre em contato com o gestor.",
  
  DRIVER_AFFILIATED_NO_VEHICLES:
    "Motoristas afiliados não podem cadastrar veículos próprios. Use os veículos da transportadora.",
  
  DRIVER_VEHICLE_LIMIT_REACHED:
    "Você já tem 1 veículo cadastrado. Para cadastrar mais veículos, transforme sua conta em transportadora.",
  
  DRIVER_NO_ACTIVE_ASSIGNMENT:
    "Você precisa de um frete ativo para fazer check-in ou saque.",

  // Company restrictions
  COMPANY_ONLY_FREIGHTS:
    "Apenas transportadoras podem gerenciar fretes de empresa.",
  
  COMPANY_ONLY_DRIVERS:
    "Apenas transportadoras podem gerenciar motoristas.",
  
  COMPANY_ONLY_FLEET:
    "Apenas transportadoras podem gerenciar frota de veículos.",

  // Producer restrictions
  PRODUCER_ONLY_CREATE:
    "Apenas produtores podem criar fretes.",
  
  PRODUCER_ONLY_EDIT:
    "Apenas produtores podem editar seus próprios fretes.",
  
  PRODUCER_ONLY_CANCEL:
    "Apenas produtores podem cancelar seus fretes.",

  // Service Provider restrictions
  SERVICE_PROVIDER_ONLY:
    "Esta funcionalidade é exclusiva para prestadores de serviços.",

  // Common restrictions
  FEATURE_REQUIRES_APPROVAL:
    "Aguarde aprovação do administrador para acessar esta funcionalidade.",
  
  FEATURE_REQUIRES_SUBSCRIPTION:
    "Esta funcionalidade requer uma assinatura ativa.",
  
  ADMIN_ONLY:
    "Acesso restrito a administradores.",

  // Status-based restrictions
  FREIGHT_ALREADY_CLOSED:
    "Este frete já foi fechado e não aceita mais propostas.",
  
  FREIGHT_ALREADY_ASSIGNED:
    "Este frete já foi atribuído a outro motorista.",
  
  SERVICE_REQUEST_COMPLETED:
    "Esta solicitação de serviço já foi concluída.",
} as const;

export type PermissionMessageKey = keyof typeof PERMISSION_MESSAGES;

/**
 * Helper para obter mensagem formatada
 */
export const getPermissionMessage = (key: PermissionMessageKey): string => {
  return PERMISSION_MESSAGES[key];
};
