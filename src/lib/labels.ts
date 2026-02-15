/**
 * src/lib/labels.ts
 * 
 * Central de rótulos e textos do sistema.
 * SEMPRE use estas constantes para garantir consistência.
 */

// ============= ROLES E ATORES =============
export const LABELS = {
  // Atores
  MOTORISTA: "Motorista",
  MOTORISTA_LABEL: "Motorista:",
  PRODUTOR: "Produtor",
  PRODUTOR_LABEL: "Produtor:",
  TRANSPORTADORA: "Transportadora",
  
  // Datas
  COLETA: "Coleta",
  COLETA_LABEL: "Coleta:",
  ENTREGA: "Entrega",
  ENTREGA_LABEL: "Entrega:",
  DATA_COLETA: "Data de coleta",
  DATA_ENTREGA: "Data de entrega",
  
  // Status/Estados
  AGUARDANDO_MOTORISTA: "Aguardando motorista",
  AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  ENTREGA_REPORTADA: "Entrega reportada",
  
  // Campos comuns
  PESO: "Peso",
  PESO_LABEL: "Peso:",
  DISTANCIA: "Distância",
  DISTANCIA_LABEL: "Distância:",
  VALOR: "Valor",
  VALOR_LABEL: "Valor:",
  PRECO: "Preço",
  PRECO_LABEL: "Preço:",
  ORIGEM: "Origem",
  ORIGEM_LABEL: "Origem:",
  DESTINO: "Destino",
  DESTINO_LABEL: "Destino:",
  
  // Ações
  VER_DETALHES: "Ver detalhes",
  CONFIRMAR_ENTREGA: "Confirmar entrega",
  SOLICITAR_CANCELAMENTO: "Cancelamento",
  EDITAR: "Editar",
  CANCELAR: "Cancelar",
  ACEITAR: "Aceitar",
  RECUSAR: "Recusar",
  
  // Unidades
  TONELADAS_ABREV: "t",
  QUILOMETROS_ABREV: "km",
  
  // Plurais
  CARRETA: "carreta",
  CARRETAS: "carretas",
  
} as const;

// Funções auxiliares para formatação de labels
export const getLabelWithColon = (label: string) => `${label}:`;

export const getPluralLabel = (count: number, singular: string, plural: string) => 
  count === 1 ? singular : plural;

// Re-exportar labels do ui-labels.ts para manter compatibilidade
export * from './ui-labels';
