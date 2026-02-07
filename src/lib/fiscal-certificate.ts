/**
 * Helper para verificar se um emissor fiscal possui certificado A1 válido.
 * 
 * Substitui checagens quebradas como `fiscalIssuer?.certificate_uploaded_at`
 * (campo que NÃO existe no schema de fiscal_issuers).
 * 
 * Verifica apenas campos reais: status e sefaz_status.
 */

export function hasValidCertificate(issuer?: { status?: string; sefaz_status?: string | null }): boolean {
  if (!issuer) return false;

  // Statuses que indicam certificado válido carregado
  const validStatuses = ['certificate_uploaded', 'active', 'production_enabled', 'homologation_enabled'];
  const validSefazStatuses = ['validated', 'production_enabled', 'homologation_enabled'];

  return (
    validStatuses.includes(issuer.status || '') ||
    validSefazStatuses.includes(issuer.sefaz_status || '')
  );
}
