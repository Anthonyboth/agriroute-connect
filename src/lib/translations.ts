// Traduções para português brasileiro

export const statusTranslations = {
  // Estados de frete
  'OPEN': 'Aberto',
  'IN_NEGOTIATION': 'Em Negociação',
  'ACCEPTED': 'Aceito',
  'IN_TRANSIT': 'Em Transporte',
  'DELIVERED': 'Entregue',
  'CANCELLED': 'Cancelado',
  
  // Estados de proposta
  'PENDING': 'Pendente',
  'REJECTED': 'Rejeitada',
  
  // Estados de usuário
  'APPROVED': 'Aprovado',
  
  // Estados de validação
  'VALIDATED': 'Validado',
  'EXPIRED': 'Expirado',
  'COMPLETED': 'Concluído'
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
  'Reset': 'Redefinir'
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
  'Optional': 'Opcional'
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
  'Duration': 'Duração'
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

// Função para traduzir mensagens de toast comuns
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
    cancelled: 'Cancelado com sucesso!'
  },
  error: {
    generic: 'Erro ao processar solicitação',
    network: 'Erro de conexão',
    validation: 'Dados inválidos',
    permission: 'Sem permissão',
    notFound: 'Não encontrado',
    create: 'Erro ao criar',
    update: 'Erro ao atualizar',
    delete: 'Erro ao excluir',
    save: 'Erro ao salvar',
    send: 'Erro ao enviar',
    load: 'Erro ao carregar'
  },
  info: {
    loading: 'Carregando...',
    processing: 'Processando...',
    waiting: 'Aguardando...',
    noData: 'Nenhum dado disponível',
    noResults: 'Nenhum resultado encontrado'
  }
};