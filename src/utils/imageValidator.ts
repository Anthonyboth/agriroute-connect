/**
 * Validação de Qualidade de Imagem
 * Verifica resolução mínima e tamanho do arquivo para garantir documentos legíveis
 */

export interface ImageValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Valida a qualidade de uma imagem para documentos
 * @param file - Arquivo de imagem a ser validado
 * @returns Resultado da validação com status e mensagem de erro se aplicável
 */
export const validateImageQuality = async (file: File): Promise<ImageValidationResult> => {
  // Para formatos HEIC/HEIF que navegadores não suportam nativamente,
  // pular validação de dimensões e confiar no tamanho do arquivo
  const isHeicFormat = file.type.includes('heic') || 
                       file.type.includes('heif') || 
                       file.name.toLowerCase().endsWith('.heic') ||
                       file.name.toLowerCase().endsWith('.heif');
  
  // Verificar tamanho máximo (10MB) primeiro - funciona para qualquer formato
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      reason: 'Arquivo muito grande (máximo 10MB). Tente tirar uma foto com menor resolução.'
    };
  }
  
  // Verificar tamanho mínimo como indicador de qualidade
  if (file.size < 50000) { // Reduzido para 50KB para ser mais permissivo
    return {
      valid: false,
      reason: 'Arquivo muito pequeno (mínimo 50KB). Tire uma foto mais nítida.'
    };
  }
  
  // Para HEIC/HEIF, pular validação de dimensões (navegador não consegue renderizar)
  if (isHeicFormat) {
    console.log('[ImageValidator] Formato HEIC/HEIF detectado, pulando validação de dimensões');
    return { valid: true };
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    // Timeout de 5 segundos para evitar travamento
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      console.warn('[ImageValidator] Timeout ao carregar imagem, permitindo upload');
      resolve({ valid: true }); // Permitir em caso de timeout
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      
      // Verificar resolução mínima (reduzido para 640x480 para ser mais permissivo em mobile)
      if (img.width < 640 || img.height < 480) {
        resolve({
          valid: false,
          reason: 'Imagem muito pequena (mínimo 640x480 pixels). Use uma câmera de melhor qualidade.'
        });
        return;
      }
      
      resolve({ valid: true });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      // Em caso de erro ao carregar, permitir upload - servidor validará depois
      console.warn('[ImageValidator] Erro ao carregar imagem para validação, permitindo upload');
      resolve({ valid: true });
    };
    
    img.src = url;
  });
};

/**
 * Valida se a data da CNH está vencida ou próxima do vencimento
 * @param expiryDate - Data de vencimento da CNH
 * @returns Objeto com status e mensagem
 */
export const validateCNHExpiry = (expiryDate: string | null): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number;
  message?: string;
} => {
  if (!expiryDate) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysUntilExpiry: 0,
      message: 'Data de vencimento não informada'
    };
  }

  const expiry = new Date(expiryDate);
  const today = new Date();
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysUntilExpiry,
      message: 'CNH vencida. Atualize seu documento antes de continuar.'
    };
  }

  if (daysUntilExpiry < 30) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysUntilExpiry,
      message: `Sua CNH vence em ${daysUntilExpiry} dias. Renove em breve.`
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    daysUntilExpiry
  };
};
