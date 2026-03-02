import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Get user's votes for a set of targets
export function useUserVotes(targetType: 'THREAD' | 'POST', targetIds: string[]) {
  return useQuery({
    queryKey: ['forum-user-votes', targetType, targetIds],
    enabled: targetIds.length > 0,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const col = targetType === 'THREAD' ? 'thread_id' : 'post_id';
      const { data, error } = await supabase
        .from('forum_votes' as any)
        .select('id, thread_id, post_id, value')
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .in(col, targetIds);

      if (error) return {};

      const map: Record<string, number> = {};
      (data || []).forEach((v: any) => {
        const key = targetType === 'THREAD' ? v.thread_id : v.post_id;
        map[key] = v.value;
      });
      return map;
    },
  });
}

// Vote mutation with optimistic updates
export function useVote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetType,
      targetId,
      value,
    }: {
      targetType: 'THREAD' | 'POST';
      targetId: string;
      value: 1 | -1;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const col = targetType === 'THREAD' ? 'thread_id' : 'post_id';
      const otherCol = targetType === 'THREAD' ? 'post_id' : 'thread_id';

      // Check if target is deleted (for posts)
      if (targetType === 'POST') {
        const { data: post } = await supabase
          .from('forum_posts')
          .select('is_deleted')
          .eq('id', targetId)
          .maybeSingle();
        if (post?.is_deleted) throw new Error('Não é possível votar em conteúdo removido.');
      }

      // Check existing vote
      const { data: existing } = await supabase
        .from('forum_votes' as any)
        .select('id, value')
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq(col, targetId)
        .maybeSingle();

      if (existing) {
        if ((existing as any).value === value) {
          // Same vote = remove
          const { error } = await supabase
            .from('forum_votes' as any)
            .delete()
            .eq('id', (existing as any).id);
          if (error) throw error;
          return { action: 'removed' as const, previousValue: value };
        } else {
          // Different vote = update
          const { error } = await supabase
            .from('forum_votes' as any)
            .update({ value })
            .eq('id', (existing as any).id);
          if (error) throw error;
          return { action: 'changed' as const, previousValue: (existing as any).value };
        }
      } else {
        // New vote
        const insertData: any = {
          user_id: user.id,
          target_type: targetType,
          value,
          [col]: targetId,
          [otherCol]: null,
        };
        const { error } = await supabase
          .from('forum_votes' as any)
          .insert(insertData);
        if (error) throw error;
        return { action: 'voted' as const, previousValue: 0 };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum-user-votes'] });
      qc.invalidateQueries({ queryKey: ['forum-feed'] });
      qc.invalidateQueries({ queryKey: ['forum-thread'] });
      qc.invalidateQueries({ queryKey: ['forum-threaded-posts'] });
    },
  });
}
