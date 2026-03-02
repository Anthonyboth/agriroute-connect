export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  boards: ForumBoard[];
}

export interface ForumBoard {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  order_index: number;
  is_active: boolean;
  visibility: 'PUBLIC' | 'VERIFIED_ONLY' | 'AFFILIATES_ONLY' | 'ADMIN_ONLY';
  allowed_roles: string[] | null;
  created_at: string;
  thread_count?: number;
  post_count?: number;
  last_thread?: {
    id: string;
    title: string;
    last_post_at: string;
    author_name: string;
  } | null;
}

export interface ForumThread {
  id: string;
  board_id: string;
  author_user_id: string;
  title: string;
  thread_type: 'GERAL' | 'VENDA' | 'COMPRA' | 'SERVICO' | 'FRETE' | 'PARCERIA' | 'DUVIDA';
  price: number | null;
  currency: string;
  location_text: string | null;
  contact_preference: 'CHAT_APP' | 'TELEFONE' | 'WHATSAPP' | 'EMAIL' | null;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  is_pinned: boolean;
  is_locked: boolean;
  last_post_at: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  post_count?: number;
  is_unread?: boolean;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_user_id: string;
  body: string;
  is_deleted: boolean;
  deleted_reason: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_role?: string;
}

export interface ForumAttachment {
  id: string;
  thread_id: string | null;
  post_id: string | null;
  uploader_user_id: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export const THREAD_TYPE_LABELS: Record<string, string> = {
  GERAL: 'Geral',
  VENDA: 'Venda',
  COMPRA: 'Compra',
  SERVICO: 'Serviço',
  FRETE: 'Frete',
  PARCERIA: 'Parceria',
  DUVIDA: 'Dúvida',
};

export const THREAD_TYPE_COLORS: Record<string, string> = {
  GERAL: 'bg-muted text-muted-foreground',
  VENDA: 'bg-emerald-100 text-emerald-800',
  COMPRA: 'bg-blue-100 text-blue-800',
  SERVICO: 'bg-purple-100 text-purple-800',
  FRETE: 'bg-orange-100 text-orange-800',
  PARCERIA: 'bg-amber-100 text-amber-800',
  DUVIDA: 'bg-red-100 text-red-800',
};

export const REPORT_REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'GOLPE', label: 'Golpe / Fraude' },
  { value: 'OFENSIVO', label: 'Conteúdo Ofensivo' },
  { value: 'ILEGAL', label: 'Conteúdo Ilegal' },
  { value: 'DADOS_PESSOAIS', label: 'Dados Pessoais Expostos' },
  { value: 'OUTRO', label: 'Outro' },
];
