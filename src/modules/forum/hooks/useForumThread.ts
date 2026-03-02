import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ForumThread, ForumPost } from '../types';

export function useForumThread(threadId: string | undefined) {
  return useQuery({
    queryKey: ['forum-thread', threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<ForumThread & { board_slug: string; board_name: string; category_name: string }> => {
      const { data, error } = await supabase
        .from('forum_threads')
        .select('*, forum_boards!inner(slug, name, forum_categories!inner(name))')
        .eq('id', threadId!)
        .single();

      if (error) throw error;

      const board = (data as any).forum_boards;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.author_user_id)
        .maybeSingle();

      return {
        ...data,
        author_name: profile?.full_name || 'Anônimo',
        board_slug: board.slug,
        board_name: board.name,
        category_name: board.forum_categories.name,
      } as any;
    },
  });
}

export function useForumPosts(threadId: string | undefined, page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['forum-posts', threadId, page],
    enabled: !!threadId,
    queryFn: async (): Promise<{ posts: ForumPost[]; total: number }> => {
      const from = (page - 1) * perPage;
      const { data, error, count } = await supabase
        .from('forum_posts')
        .select('*', { count: 'exact' })
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
        .range(from, from + perPage - 1);

      if (error) throw error;

      // Fetch author info
      const authorIds = [...new Set((data || []).map(p => p.author_user_id))];
      let authors: Record<string, { name: string; role: string }> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', authorIds);
        if (profiles) {
          profiles.forEach(p => {
            authors[p.id] = { name: p.full_name || 'Anônimo', role: p.role || '' };
          });
        }
      }

      return {
        posts: (data || []).map(p => ({
          ...p,
          author_name: authors[p.author_user_id]?.name || 'Anônimo',
          author_role: authors[p.author_user_id]?.role || '',
        })),
        total: count || 0,
      };
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('forum_posts')
        .insert({ thread_id: threadId, author_user_id: user.id, body })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', threadId] });
      queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] });
    },
  });
}

export function useMarkThreadViewed() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('forum_thread_views')
        .upsert(
          { thread_id: threadId, user_id: user.id, last_viewed_at: new Date().toISOString() },
          { onConflict: 'thread_id,user_id' }
        );

      if (error) console.error('Failed to mark thread viewed:', error);
    },
  });
}

export function useCreateReport() {
  return useMutation({
    mutationFn: async (report: {
      target_type: 'THREAD' | 'POST' | 'USER';
      thread_id?: string;
      post_id?: string;
      target_user_id?: string;
      reason: string;
      details: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('forum_reports')
        .insert({ ...report, reporter_user_id: user.id });

      if (error) throw error;
    },
  });
}
