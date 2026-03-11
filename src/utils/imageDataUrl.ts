export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64Data] = dataUrl.split(',');

  if (!base64Data) {
    throw new Error('Invalid data URL payload');
  }

  const mimeMatch = meta.match(/^data:(.*?);/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

export function getFileExtensionFromMime(mime?: string): string {
  const normalized = (mime || '').toLowerCase();

  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('heic')) return 'heic';
  if (normalized.includes('heif')) return 'heif';

  return 'jpg';
}
