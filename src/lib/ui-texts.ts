/**
 * Textos completos da UI - NUNCA usar abreviações
 * Todos os textos devem estar em português brasileiro completo
 */
export const UI_TEXTS = {
  // Navegação - Textos completos sem abreviações
  AVALIACOES: "Avaliações",
  PAGAMENTOS: "Pagamentos",
  PROPOSTAS: "Propostas",
  CHAT: "Chat",
  HISTORICO: "Histórico",
  CONFIGURACOES: "Configurações",
  NOTIFICACOES: "Notificações",
  PERFIL: "Perfil",
  DASHBOARD: "Painel de Controle",
  
  // Ações - Verbos completos
  VER_DETALHES: "Ver detalhes",
  CONFIRMAR_ENTREGA_ACAO: "Confirmar entrega",
  SOLICITAR_CANCELAMENTO: "Solicitar cancelamento",
  ENVIAR_PROPOSTA: "Enviar proposta",
  ACEITAR_FRETE: "Aceitar frete",
  RECUSAR_FRETE: "Recusar frete",
  EDITAR_PERFIL: "Editar perfil",
  CANCELAR_FRETE: "Cancelar frete",
  ATUALIZAR_STATUS: "Atualizar status",
  EXPORTAR_RELATORIO: "Exportar relatório",
  APLICAR_FILTROS: "Aplicar filtros",
  LIMPAR_FILTROS: "Limpar filtros",
  
  // Status - Estados completos
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_MOTORISTA: "Aguardando motorista",
  AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
  ENTREGA_CONFIRMADA: "Entrega confirmada",
  CANCELADO: "Cancelado",
  CONCLUIDO: "Concluído",
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  
  // Filtros e Ordenação
  TODOS: "Todos",
  ABERTOS: "Abertos",
  AGENDADOS: "Agendados",
  CANCELADOS: "Cancelados",
  CONCLUIDOS: "Concluídos",
  FILTROS_AVANCADOS: "Filtros avançados",
  ORDENAR_POR: "Ordenar por",
  DATA: "Data",
  PRECO: "Preço",
  DISTANCIA: "Distância",
  STATUS: "Status",
  CRESCENTE: "Crescente",
  DECRESCENTE: "Decrescente",
  
  // Campos de Dados
  ORIGEM: "Origem",
  DESTINO: "Destino",
  PESO: "Peso",
  VALOR: "Valor",
  TIPO_CARGA: "Tipo de carga",
  DATA_COLETA: "Data de coleta",
  DATA_ENTREGA: "Data de entrega",
  MOTORISTA: "Motorista",
  PRODUTOR: "Produtor",
  TRANSPORTADORA: "Transportadora",
  URGENCIA: "Urgência",
  ROTA: "Rota",
  
  // Tipos de Carga
  GRAOS: "Grãos",
  FERTILIZANTES: "Fertilizantes",
  ANIMAIS: "Animais",
  MAQUINARIO: "Maquinário",
  COMBUSTIVEL: "Combustível",
  CARGA_GERAL: "Carga Geral",
  
  // Níveis de Urgência
  URGENCIA_BAIXA: "Baixa",
  URGENCIA_MEDIA: "Média",
  URGENCIA_ALTA: "Alta",
  URGENCIA_URGENTE: "Urgente",
  
  // Relatórios e Analytics
  RELATORIO_FRETES: "Relatório de fretes",
  ESTATISTICAS: "Estatísticas",
  ANALYTICS: "Análises",
  EXPORTAR_PDF: "Exportar PDF",
  EXPORTAR_EXCEL: "Exportar Excel",
  RESUMO: "Resumo",
  DETALHADO: "Detalhado",
  PERIODO: "Período",
  ULTIMA_SEMANA: "Última semana",
  ULTIMO_MES: "Último mês",
  ULTIMO_TRIMESTRE: "Último trimestre",
  ULTIMO_ANO: "Último ano",
  
  // Mensagens
  NENHUM_FRETE_ENCONTRADO: "Nenhum frete encontrado",
  CARREGANDO: "Carregando",
  SALVANDO: "Salvando",
  SUCESSO: "Sucesso",
  ERRO: "Erro",
  CONFIRMACAO: "Confirmação",
  
  // Abas (Tabs)
  FRETES_DISPONIVEIS: "Fretes disponíveis",
  FRETES_EM_ANDAMENTO: "Fretes em andamento",
  CONFIRMAR_ENTREGA: "Confirmar entrega",
  MINHAS_PROPOSTAS: "Minhas propostas",
  FRETES_AGENDADOS: "Fretes agendados",
  
  // Propostas
  DETALHES_PROPOSTA: "Detalhes da Proposta",
  CANCELAR_PROPOSTA: "Cancelar Proposta",
  CONTRAPROPOSTA_RECEBIDA: "Contraproposta Recebida",
  CONTRAPROPOSTAS_RECEBIDAS: "Contrapropostas Recebidas",
  CONTATAR_PRODUTOR: "Contatar Produtor",
  SEM_AVALIACOES: "Sem avaliações ainda",
  MOTORISTA_DA_EMPRESA: "Motorista da",
  ACEITAR_CONTRAPROPOSTA: "Aceitar Contraproposta",
  REJEITAR_CONTRAPROPOSTA: "Rejeitar",
  VALOR_ORIGINAL_FRETE: "Valor Original do Frete",
  VALOR_PROPOSTO: "Valor Proposto",
  DIFERENCA: "Diferença",
  MENSAGEM_MOTORISTA: "Mensagem do Motorista",
  MENSAGEM_PRODUTOR: "Mensagem do Produtor",
  INFORMACOES_FRETE: "Informações do Frete",
  INFORMACOES_PRODUTOR: "Informações do Produtor",
  INFORMACOES_MOTORISTA: "Informações do Motorista",
  SOLICITAR_LOCALIZACAO: "Solicitar Localização",
  DIRECIONAR_MOTORISTA: "Direcionar Motorista",
  CANCELAR_POR_VENCIMENTO: "Cancelar por Vencimento",
  
} as const;

/**
 * Tipos de texto para garantir type-safety
 */
export type UITextKey = keyof typeof UI_TEXTS;

/**
 * Helper para obter texto com fallback
 */
export const getUIText = (key: UITextKey, fallback?: string): string => {
  return UI_TEXTS[key] || fallback || key;
};
