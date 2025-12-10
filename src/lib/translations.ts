// Traduções para português brasileiro - Textos corrigidos

export const statusTranslations: Record<string, string> = {
  // Estados de frete - COMPLETO
  'OPEN': 'Aberto',
  'IN_NEGOTIATION': 'Em Negociação',
  'ACCEPTED': 'Aceito',
  'LOADING': 'A Caminho da Coleta',
  'LOADED': 'Carregado',
  'IN_TRANSIT': 'Em Transporte',
  'DELIVERED': 'Entregue',
  'DELIVERED_PENDING_CONFIRMATION': 'Entrega Reportada',
  'CANCELLED': 'Cancelado',
  'COMPLETED': 'Concluído',
  'REJECTED': 'Rejeitado',
  
  // Estados de proposta
  'PENDING': 'Pendente',
  
  // Estados de usuário/motorista
  'APPROVED': 'Aprovado',
  'ACTIVE': 'Ativo',
  'INACTIVE': 'Inativo',
  'LEFT': 'Saiu',
  'REMOVED': 'Removido',
  
  // Estados de validação
  'VALIDATED': 'Validado',
  'EXPIRED': 'Expirado',
  
  // Estados de serviço
  'IN_PROGRESS': 'Em Andamento',
  
  // Estados de pagamento
  'PROCESSING': 'Processando',
  'FAILED': 'Falhou',
  
  // Estados de emergência
  'RESOLVED': 'Resolvido'
};

export const buttonTranslations = {
  'Create': 'Criar',
  'Edit': 'Editar',
  'Delete': 'Excluir',
  'Cancel': 'Cancelar',
  'Save': 'Salvar',
  'Loading': 'Carregando',
  'Submit': 'Enviar',
  'Accept': 'Aceitar',
  'Reject': 'Rejeitar',
  'Login': 'Entrar',
  'Logout': 'Sair',
  'Register': 'Cadastrar',
  'Profile': 'Perfil',
  'Settings': 'Configurações',
  'Dashboard': 'Painel',
  'Close': 'Fechar',
  'Confirm': 'Confirmar',
  'Update': 'Atualizar',
  'Remove': 'Remover',
  'Add': 'Adicionar',
  'Search': 'Buscar',
  'Filter': 'Filtrar',
  'Clear': 'Limpar',
  'Apply': 'Aplicar',
  'Reset': 'Redefinir',
  'Rate': 'Avaliar',
  'Comment': 'Comentar'
};

export const messageTranslations = {
  'Loading': 'Carregando...',
  'Error': 'Erro',
  'Success': 'Sucesso',
  'Warning': 'Aviso',
  'Info': 'Informação',
  'No data found': 'Nenhum dado encontrado',
  'No results': 'Nenhum resultado',
  'Something went wrong': 'Algo deu errado',
  'Try again': 'Tente novamente',
  'Please wait': 'Por favor, aguarde',
  'Processing': 'Processando',
  'Completed': 'Concluído',
  'Failed': 'Falhou',
  'Invalid': 'Inválido',
  'Required': 'Obrigatório',
  'Optional': 'Opcional',
  'Rating': 'Avaliação',
  'Comment': 'Comentário'
};

export const fieldTranslations = {
  'Email': 'E-mail',
  'Password': 'Senha',
  'Username': 'Nome de usuário',
  'Phone': 'Telefone',
  'Document': 'Documento',
  'Address': 'Endereço',
  'Name': 'Nome',
  'Description': 'Descrição',
  'Price': 'Preço',
  'Weight': 'Peso',
  'Date': 'Data',
  'Time': 'Horário',
  'Status': 'Status',
  'Type': 'Tipo',
  'Category': 'Categoria',
  'Origin': 'Origem',
  'Destination': 'Destino',
  'Distance': 'Distância',
  'Duration': 'Duração',
  'Rating': 'Avaliação',
  'Comment': 'Comentário'
};

export const translate = (key: string, category: 'status' | 'button' | 'message' | 'field' = 'message'): string => {
  const translations = {
    status: statusTranslations,
    button: buttonTranslations,
    message: messageTranslations,
    field: fieldTranslations
  };
  
  return translations[category][key as keyof typeof translations[typeof category]] || key;
};

// Mensagens de toast padronizadas em português correto
export const toastMessages = {
  success: {
    created: 'Criado com sucesso!',
    updated: 'Atualizado com sucesso!',
    deleted: 'Excluído com sucesso!',
    saved: 'Salvo com sucesso!',
    sent: 'Enviado com sucesso!',
    completed: 'Concluído com sucesso!',
    accepted: 'Aceito com sucesso!',
    rejected: 'Rejeitado com sucesso!',
    cancelled: 'Cancelado com sucesso!',
    ratingSubmitted: 'Avaliação enviada com sucesso!'
  },
  error: {
    generic: 'Erro ao processar solicitação',
    network: 'Erro de conexão. Verifique sua internet.',
    validation: 'Dados inválidos',
    permission: 'Você não tem permissão para esta ação',
    notFound: 'Registro não encontrado',
    create: 'Erro ao criar',
    update: 'Erro ao atualizar',
    delete: 'Erro ao excluir',
    save: 'Erro ao salvar',
    send: 'Erro ao enviar',
    load: 'Erro ao carregar',
    ratingFailed: 'Erro ao enviar avaliação. Tente novamente.'
  },
  info: {
    loading: 'Carregando...',
    processing: 'Processando...',
    waiting: 'Aguardando...',
    noData: 'Nenhum dado disponível',
    noResults: 'Nenhum resultado encontrado',
    alreadyRated: 'Você já avaliou este item'
  },
  warning: {
    unsavedChanges: 'Você tem alterações não salvas',
    confirmAction: 'Por favor, confirme sua ação',
    selectRating: 'Por favor, selecione uma nota de 1 a 5 estrelas'
  }
};
