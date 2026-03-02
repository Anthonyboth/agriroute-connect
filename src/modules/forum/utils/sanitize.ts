/**
 * Forum-specific sanitization utilities
 * Blocks HTML/script injection, adds nofollow to links
 */

// Strip all HTML tags and dangerous content
export function sanitizeForumText(input: string): string {
  if (!input) return '';
  
  let text = input;
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Remove javascript: protocol
  text = text.replace(/javascript\s*:/gi, '');
  
  // Remove event handlers
  text = text.replace(/on\w+\s*=\s*[\"'][^\"']*[\"']/gi, '');
  
  // Remove control characters (keep newlines and tabs)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return text.trim();
}

// Convert basic markdown to safe HTML with nofollow links
export function renderSafeMarkdown(input: string): string {
  let text = sanitizeForumText(input);
  
  // Escape remaining HTML entities
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic *text*
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Links [text](url) - with nofollow + noopener
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" rel="nofollow noopener noreferrer" target="_blank" class="text-primary underline">$1</a>'
  );
  
  // Auto-link bare URLs - with nofollow
  text = text.replace(
    /(?<!\])\((https?:\/\/[^\s<)]+)\)|(?<![("\'])(https?:\/\/[^\s<)]+)/g,
    (match, p1, p2) => {
      const url = p1 || p2;
      if (!url) return match;
      return `<a href="${url}" rel="nofollow noopener noreferrer" target="_blank" class="text-primary underline">${url}</a>`;
    }
  );
  
  // Newlines to <br>
  text = text.replace(/\n/g, '<br />');
  
  return text;
}

// Rate limit tracker (client-side, complementary to DB-level)
const rateLimitStore: Record<string, number[]> = {};

export function checkClientRateLimit(action: 'thread' | 'post', maxPerMin: number): boolean {
  const now = Date.now();
  const key = action;
  
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = [];
  }
  
  // Remove entries older than 1 minute
  rateLimitStore[key] = rateLimitStore[key].filter(ts => now - ts < 60000);
  
  if (rateLimitStore[key].length >= maxPerMin) {
    return false; // rate limited
  }
  
  rateLimitStore[key].push(now);
  return true;
}

// File validation constants
export const FORUM_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'application/pdf',
] as const;

export const FORUM_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const FORUM_MAX_FILES = 5;

export function validateForumFile(file: File): string | null {
  if (!FORUM_ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return `Tipo não permitido: ${file.name}. Use JPG, PNG, WebP ou PDF.`;
  }
  if (file.size > FORUM_MAX_FILE_SIZE) {
    return `Arquivo muito grande: ${file.name} (máx 10MB)`;
  }
  if (file.size === 0) {
    return `Arquivo vazio: ${file.name}`;
  }
  return null;
}
