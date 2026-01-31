// Detecta se estamos no ambiente de Preview do Lovable (staging)
export function isLovablePreviewHost(hostname: string = window.location.hostname): boolean {
  return (
    hostname.endsWith('lovableproject.com') || 
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('id-preview--')
  );
}
