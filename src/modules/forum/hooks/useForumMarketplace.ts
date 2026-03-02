import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============ SAVES ============
export function useForumSaves() {
  return useQuery({
    queryKey: ['forum-saves'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('forum_saves' as any)
        .select('thread_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) return [];
      return (data || []) as unknown as { thread_id: string; created_at: string }[];
    },
  });
}

export function useToggleSave() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Check if already saved
      const { data: existing } = await supabase
        .from('forum_saves' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('thread_id', threadId)
        .maybeSingle();

      if (existing) {
        await supabase.from('forum_saves' as any).delete().eq('id', (existing as any).id);
        return { action: 'unsaved' };
      } else {
        await supabase.from('forum_saves' as any).insert({ user_id: user.id, thread_id: threadId });
        return { action: 'saved' };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum-saves'] });
    },
  });
}

// ============ KARMA ============
export function useForumKarma(userId: string | undefined) {
  return useQuery({
    queryKey: ['forum-karma', userId],
    enabled: !!userId,
    staleTime: 60000, // cache 1 min
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_user_karma' as any)
        .select('karma, thread_count, post_count')
        .eq('user_id', userId!)
        .maybeSingle();
      
      if (error || !data) return { karma: 0, thread_count: 0, post_count: 0 };
      return data as unknown as { karma: number; thread_count: number; post_count: number };
    },
  });
}

// ============ BOARD RULES ============
export function useBoardRules(boardId: string | undefined) {
  return useQuery({
    queryKey: ['forum-board-rules', boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_board_rules' as any)
        .select('*')
        .eq('board_id', boardId!)
        .order('order_index');
      
      if (error) return [];
      return data as unknown as { id: string; title: string; body: string; order_index: number }[];
    },
  });
}

export function useSaveBoardRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { id?: string; board_id: string; title: string; body: string; order_index: number }) => {
      if (rule.id) {
        const { error } = await supabase.from('forum_board_rules' as any).update(rule).eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('forum_board_rules' as any).insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-board-rules'] }),
  });
}

// ============ THREAD STATUS (SOLD/CLOSED) ============
export function useUpdateThreadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, status }: { threadId: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Verify ownership
      const { data: thread } = await supabase
        .from('forum_threads')
        .select('author_user_id')
        .eq('id', threadId)
        .single();
      
      if (!thread || thread.author_user_id !== user.id) {
        throw new Error('Apenas o autor pode alterar o status.');
      }

      const { error } = await supabase
        .from('forum_threads')
        .update({ status })
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum-feed'] });
      qc.invalidateQueries({ queryKey: ['forum-thread'] });
    },
  });
}

// ============ AUTO-HIDE (3+ reports) ============
export function useCheckAutoHide() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data: reports, error } = await supabase
        .from('forum_reports')
        .select('id')
        .eq('thread_id', threadId)
        .eq('status', 'OPEN');
      
      if (error) return;
      
      if (reports && reports.length >= 3) {
        await supabase
          .from('forum_threads')
          .update({ is_auto_hidden: true } as any)
          .eq('id', threadId);
        
        // Log
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('forum_moderation_logs').insert({
          admin_user_id: user?.id || '00000000-0000-0000-0000-000000000000',
          action: 'auto_hide',
          target_id: threadId,
          metadata: { report_count: reports.length },
        });
      }
    },
  });
}
