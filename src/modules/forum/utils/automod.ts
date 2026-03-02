/**
 * Forum AutoMod — client-side detection of suspicious content
 */

// Suspicious URL shorteners
const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd',
  'buff.ly', 'adf.ly', 'bl.ink', 'shorte.st', 'clck.ru',
];

// Suspicious domains
const SUSPICIOUS_DOMAINS = [
  'pagamento-seguro', 'pague-aqui', 'deposito-rapido',
];

// Scam keywords
const SCAM_KEYWORDS = [
  'pix adiantado', 'pagamento antecipado', 'sinal via pix',
  'depósito antecipado', 'deposito antecipado', 'pague antes',
  'transferência antes', 'transferencia antes', 'envie o pix',
  'mande o pix', 'pix antes', 'deposite antes',
];

// Phone regex patterns
const PHONE_PATTERNS = [
  /\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/g,
  /\+55\s*\d{2}\s*9?\d{4}[-.\s]?\d{4}/g,
];

export interface AutoModResult {
  hasSuspiciousLinks: boolean;
  hasScamKeywords: boolean;
  hasPhoneNumbers: boolean;
  suspiciousUrls: string[];
  scamPhrases: string[];
  flags: AutoModFlag[];
}

export interface AutoModFlag {
  type: 'SUSPICIOUS_LINK' | 'SCAM_KEYWORDS' | 'PHONE_IN_BODY';
  severity: 'warn' | 'block';
  message: string;
  details: string;
}

/**
 * Run AutoMod checks on text content
 */
export function runAutoMod(text: string): AutoModResult {
  const lower = text.toLowerCase();
  const flags: AutoModFlag[] = [];
  const suspiciousUrls: string[] = [];
  const scamPhrases: string[] = [];

  // 1. Check suspicious links
  const urlRegex = /https?:\/\/[^\s<)]+/gi;
  const urls = text.match(urlRegex) || [];
  
  for (const url of urls) {
    const urlLower = url.toLowerCase();
    for (const domain of SHORTENER_DOMAINS) {
      if (urlLower.includes(domain)) {
        suspiciousUrls.push(url);
        break;
      }
    }
    for (const domain of SUSPICIOUS_DOMAINS) {
      if (urlLower.includes(domain)) {
        suspiciousUrls.push(url);
        break;
      }
    }
  }

  if (suspiciousUrls.length > 0) {
    flags.push({
      type: 'SUSPICIOUS_LINK',
      severity: 'warn',
      message: '⚠️ Links suspeitos detectados',
      details: `Encontramos ${suspiciousUrls.length} link(s) potencialmente suspeito(s). Use links diretos para maior segurança.`,
    });
  }

  // 2. Check scam keywords
  for (const keyword of SCAM_KEYWORDS) {
    if (lower.includes(keyword)) {
      scamPhrases.push(keyword);
    }
  }

  if (scamPhrases.length > 0) {
    flags.push({
      type: 'SCAM_KEYWORDS',
      severity: 'warn',
      message: '⚠️ Atenção: possível golpe',
      details: 'Este post contém termos associados a golpes (pagamento adiantado). Use o chat do app para negociações seguras.',
    });
  }

  // 3. Check phone numbers
  let hasPhones = false;
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(text)) {
      hasPhones = true;
      break;
    }
  }

  if (hasPhones) {
    flags.push({
      type: 'PHONE_IN_BODY',
      severity: 'warn',
      message: 'Telefone detectado no texto',
      details: 'Números de telefone foram detectados. Considere usar o campo de contato oficial.',
    });
  }

  return {
    hasSuspiciousLinks: suspiciousUrls.length > 0,
    hasScamKeywords: scamPhrases.length > 0,
    hasPhoneNumbers: hasPhones,
    suspiciousUrls,
    scamPhrases,
    flags,
  };
}

/**
 * Mask phone numbers in text
 */
export function maskPhoneNumbers(text: string): string {
  let result = text;
  for (const pattern of PHONE_PATTERNS) {
    result = result.replace(pattern, '(XX) XXXXX-XXXX');
  }
  return result;
}

/**
 * Thread status labels for marketplace
 */
export const THREAD_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Fechado',
  SOLD: 'Vendido',
  FILLED: 'Preenchido',
  ARCHIVED: 'Arquivado',
};

export const THREAD_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-muted text-muted-foreground',
  SOLD: 'bg-red-100 text-red-800',
  FILLED: 'bg-blue-100 text-blue-800',
  ARCHIVED: 'bg-muted text-muted-foreground',
};
