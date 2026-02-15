/**
 * Autofill Storage - Salva dados não-sensíveis para pré-preenchimento de formulários.
 * 
 * ⚠️ SEGURANÇA: Este módulo NÃO armazena senhas, tokens ou dados de autenticação.
 * Senhas são gerenciadas pelo gerenciador de senhas nativo do navegador via atributos
 * HTML autocomplete="current-password" / autocomplete="new-password".
 * 
 * Dados salvos: nome, email, telefone, CPF/CNPJ, endereço, cidade, estado, CEP.
 */

const AUTOFILL_KEY = 'agriroute_autofill_data';

export interface AutofillData {
  email?: string;
  full_name?: string;
  phone?: string;
  document?: string; // CPF ou CNPJ (mascarado no storage)
  city?: string;
  state?: string;
  zip_code?: string;
  address?: string;
  company_name?: string;
  company_cnpj?: string;
  updated_at?: string;
}

/**
 * Recupera dados salvos para autofill
 */
export function getAutofillData(): AutofillData {
  try {
    const stored = localStorage.getItem(AUTOFILL_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as AutofillData;
  } catch {
    return {};
  }
}

/**
 * Salva/atualiza dados para autofill (merge com existentes)
 * Nunca salva campos vazios por cima de dados existentes.
 */
export function saveAutofillData(data: Partial<AutofillData>): void {
  try {
    const existing = getAutofillData();
    const merged: AutofillData = { ...existing };

    // Merge apenas campos não-vazios
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        (merged as any)[key] = value.trim();
      }
    }

    merged.updated_at = new Date().toISOString();
    localStorage.setItem(AUTOFILL_KEY, JSON.stringify(merged));
  } catch {
    // Silently fail - autofill is non-critical
  }
}

/**
 * Limpa todos os dados de autofill
 */
export function clearAutofillData(): void {
  try {
    localStorage.removeItem(AUTOFILL_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Salva dados do perfil do usuário após login bem-sucedido
 */
export function saveProfileToAutofill(profile: Record<string, any>): void {
  if (!profile) return;
  
  saveAutofillData({
    email: profile.email,
    full_name: profile.full_name,
    phone: profile.phone,
    document: profile.document,
    city: profile.city,
    state: profile.state,
    zip_code: profile.zip_code,
    address: profile.address,
  });
}
