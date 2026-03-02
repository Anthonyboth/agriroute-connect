import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ThreadedPost {
  id: string;
  thread_id: string;
  author_user_id: string;
  author_name: string;
  author_role: string;
  body: string;
  is_deleted: boolean;
  deleted_reason: string | null;
  reply_to_post_id: string | null;
  created_at: string;
  updated_at: string;
  score: number;
  depth: number;
  children: ThreadedPost[];
}

export type CommentSort = 'best' | 'new' | 'old';

export function useThreadedPosts(threadId: string | undefined, sortBy: CommentSort = 'best') {
  return useQuery({
    queryKey: ['forum-threaded-posts', threadId, sortBy],
    enabled: !!threadId,
    queryFn: async (): Promise<ThreadedPost[]> => {
      const { data: posts, error } = await supabase
        .from('forum_posts')
        .select('id, thread_id, author_user_id, body, is_deleted, deleted_reason, reply_to_post_id, created_at, updated_at')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!posts || posts.length === 0) return [];

      // Fetch authors
      const authorIds = [...new Set(posts.map(p => p.author_user_id))];
      let authors: Record<string, { name: string; role: string }> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', authorIds);
        (profiles || []).forEach(p => {
          authors[p.id] = { name: p.full_name || 'Anônimo', role: p.role || '' };
        });
      }

      // Fetch vote scores
      const postIds = posts.map(p => p.id);
      let scoreMap: Record<string, number> = {};
      if (postIds.length > 0) {
        const { data: votes } = await supabase
          .from('forum_votes' as any)
          .select('post_id, value')
          .eq('target_type', 'POST')
          .in('post_id', postIds);
        if (votes) {
          (votes as any[]).forEach(v => {
            scoreMap[v.post_id] = (scoreMap[v.post_id] || 0) + v.value;
          });
        }
      }

      // Build tree
      const flat: ThreadedPost[] = posts.map(p => ({
        ...p,
        author_name: authors[p.author_user_id]?.name || 'Anônimo',
        author_role: authors[p.author_user_id]?.role || '',
        score: scoreMap[p.id] || 0,
        depth: 0,
        children: [],
      }));

      const byId = new Map<string, ThreadedPost>();
      flat.forEach(p => byId.set(p.id, p));

      const roots: ThreadedPost[] = [];
      flat.forEach(p => {
        if (p.reply_to_post_id && byId.has(p.reply_to_post_id)) {
          const parent = byId.get(p.reply_to_post_id)!;
          p.depth = Math.min(parent.depth + 1, 6);
          parent.children.push(p);
        } else {
          roots.push(p);
        }
      });

      // Sort
      const sortFn = (arr: ThreadedPost[]) => {
        if (sortBy === 'best') arr.sort((a, b) => b.score - a.score);
        else if (sortBy === 'new') arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        // 'old' is already default ascending
        arr.forEach(p => sortFn(p.children));
      };
      sortFn(roots);

      return roots;
    },
  });
}

export function useCreateReply() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      body,
      replyToPostId,
    }: {
      threadId: string;
      body: string;
      replyToPostId?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('forum_posts')
        .insert({
          thread_id: threadId,
          author_user_id: user.id,
          body,
          reply_to_post_id: replyToPostId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { threadId }) => {
      qc.invalidateQueries({ queryKey: ['forum-threaded-posts', threadId] });
      qc.invalidateQueries({ queryKey: ['forum-thread', threadId] });
      qc.invalidateQueries({ queryKey: ['forum-feed'] });
    },
  });
}
