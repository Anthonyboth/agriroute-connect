// Detecta se estamos no ambiente de Preview do Lovable (staging)
// IMPORTANTE: NÃO deve detectar produção (ex: agriroute.lovable.app)
export function isLovablePreviewHost(hostname: string = window.location.hostname): boolean {
  // Preview patterns: id-preview--{uuid}.lovable.app ou *.lovableproject.com
  // Produção: agriroute.lovable.app, agriroute-connect.com.br — NÃO devem ser detectados
  return (
    hostname.endsWith('.lovableproject.com') || 
    hostname.includes('id-preview--')
  );
}
