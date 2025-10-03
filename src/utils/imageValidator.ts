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
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Verificar resolução mínima (800x600)
      if (img.width < 800 || img.height < 600) {
        resolve({
          valid: false,
          reason: 'Imagem muito pequena (mínimo 800x600 pixels). Use uma câmera de melhor qualidade.'
        });
        return;
      }
      
      // Verificar tamanho do arquivo como indicador de qualidade
      // Imagens menores que 100KB geralmente indicam baixa qualidade ou compressão excessiva
      if (file.size < 100000) {
        resolve({
          valid: false,
          reason: 'Imagem de baixa qualidade (arquivo muito pequeno). Tire uma foto mais nítida sem compressão.'
        });
        return;
      }
      
      // Verificar tamanho máximo (10MB)
      if (file.size > 10 * 1024 * 1024) {
        resolve({
          valid: false,
          reason: 'Arquivo muito grande (máximo 10MB). Tente tirar uma foto com menor resolução.'
        });
        return;
      }
      
      resolve({ valid: true });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        reason: 'Arquivo inválido ou corrompido. Tente fazer o upload novamente.'
      });
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
