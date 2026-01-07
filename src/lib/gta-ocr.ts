/**
 * OCR para extração de dados da GTA (Guia de Trânsito Animal)
 * Usa Tesseract.js para reconhecimento de texto em imagens
 */

import Tesseract from 'tesseract.js';

export interface GTAOCRResult {
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  animalCount: number | null;
  originProperty: string | null;
  destinationProperty: string | null;
  issuingAgency: string | null;
  model: 'A' | 'B' | null;
  confidence: number;
  rawText: string;
}

// Regex patterns para extração de dados da GTA
const PATTERNS = {
  // Número da GTA: geralmente formato como "123456" ou "GTA 123456" ou "Nº 123456"
  documentNumber: /(?:GTA|N[ºo°]\.?\s*|GUIA\s*(?:N[ºo°]\.?)?\s*)?\s*(\d{4,12})/i,
  
  // Datas no formato DD/MM/YYYY ou DD-MM-YYYY
  date: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
  
  // Quantidade de animais
  animalCount: /(?:QUANTIDADE|QTD|QTDE|CABEÇAS|ANIMAIS|BOVINOS|SUÍNOS|AVES)[\s:]*(\d+)/i,
  
  // Propriedade de origem
  originProperty: /(?:ORIGEM|PROCEDÊNCIA|PROPRIEDADE DE ORIGEM|ESTABELEC(?:IMENTO)?\s*(?:DE\s*)?ORIGEM)[\s:]*([A-Za-zÀ-ÿ\s]+)/i,
  
  // Propriedade de destino
  destinationProperty: /(?:DESTINO|ESTABELEC(?:IMENTO)?\s*(?:DE\s*)?DESTINO)[\s:]*([A-Za-zÀ-ÿ\s]+)/i,
  
  // Órgão emissor
  issuingAgency: /(?:ÓRGÃO|ORGAO|EMITIDA|EXPEDIDA|AGÊNCIA)[\s:]*(?:POR\s*)?([A-Za-zÀ-ÿ\s]+)/i,
  
  // Modelo A ou B
  model: /(?:MODELO|MOD\.?)[\s:]*([AB])/i,
  
  // Data de emissão
  issueDate: /(?:DATA\s*(?:DE\s*)?EMISSÃO|EMITIDA\s*EM|DATA\s*EXPEDIÇÃO)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  
  // Data de validade
  expiryDate: /(?:VALIDADE|VÁLIDA\s*ATÉ|VENCIMENTO|EXPIRA)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
};

/**
 * Extrai dados estruturados do texto OCR da GTA
 */
function extractGTAData(text: string): Omit<GTAOCRResult, 'confidence' | 'rawText'> {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Extrair número do documento
  const numberMatch = normalizedText.match(PATTERNS.documentNumber);
  const documentNumber = numberMatch ? numberMatch[1] : null;
  
  // Extrair modelo (A ou B)
  const modelMatch = normalizedText.match(PATTERNS.model);
  const model = modelMatch ? (modelMatch[1].toUpperCase() as 'A' | 'B') : null;
  
  // Extrair quantidade de animais
  const countMatch = normalizedText.match(PATTERNS.animalCount);
  const animalCount = countMatch ? parseInt(countMatch[1], 10) : null;
  
  // Extrair propriedade de origem
  const originMatch = normalizedText.match(PATTERNS.originProperty);
  const originProperty = originMatch ? originMatch[1].trim() : null;
  
  // Extrair propriedade de destino
  const destMatch = normalizedText.match(PATTERNS.destinationProperty);
  const destinationProperty = destMatch ? destMatch[1].trim() : null;
  
  // Extrair órgão emissor
  const agencyMatch = normalizedText.match(PATTERNS.issuingAgency);
  const issuingAgency = agencyMatch ? agencyMatch[1].trim() : null;
  
  // Extrair data de emissão
  const issueDateMatch = normalizedText.match(PATTERNS.issueDate);
  const issueDate = issueDateMatch ? issueDateMatch[1] : null;
  
  // Extrair data de validade
  const expiryDateMatch = normalizedText.match(PATTERNS.expiryDate);
  const expiryDate = expiryDateMatch ? expiryDateMatch[1] : null;
  
  return {
    documentNumber,
    issueDate,
    expiryDate,
    animalCount,
    originProperty,
    destinationProperty,
    issuingAgency,
    model,
  };
}

/**
 * Processa uma imagem de GTA e extrai os dados via OCR
 */
export async function processGTAImage(
  imageSource: File | Blob | string,
  onProgress?: (progress: number) => void
): Promise<GTAOCRResult> {
  console.log('[GTA-OCR] Iniciando processamento...');
  
  try {
    // Configurar e executar Tesseract
    const result = await Tesseract.recognize(imageSource, 'por', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    
    const rawText = result.data.text;
    const confidence = result.data.confidence;
    
    console.log('[GTA-OCR] Texto extraído:', rawText.substring(0, 200) + '...');
    console.log('[GTA-OCR] Confiança:', confidence);
    
    // Extrair dados estruturados
    const extractedData = extractGTAData(rawText);
    
    return {
      ...extractedData,
      confidence,
      rawText,
    };
  } catch (error) {
    console.error('[GTA-OCR] Erro no processamento:', error);
    throw new Error('Falha ao processar imagem da GTA');
  }
}

/**
 * Valida se os dados extraídos são minimamente suficientes
 */
export function validateGTAData(data: GTAOCRResult): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  if (!data.documentNumber) {
    missingFields.push('Número da GTA');
  }
  
  if (!data.animalCount) {
    missingFields.push('Quantidade de animais');
  }
  
  if (!data.issueDate) {
    warnings.push('Data de emissão não identificada');
  }
  
  if (!data.expiryDate) {
    warnings.push('Data de validade não identificada');
  }
  
  if (data.confidence < 60) {
    warnings.push('Baixa confiança no reconhecimento - verifique os dados');
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
