import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ForumBoard, ForumThread } from '../types';

interface UseForumBoardOptions {
  slug: string;
  page?: number;
  perPage?: number;
  typeFilter?: string;
  search?: string;
  sortBy?: 'recent' | 'most_replies';
  unreadOnly?: boolean;
  userId?: string;
}

export function useForumBoard({ slug, page = 1, perPage = 20, typeFilter, search, sortBy = 'recent', unreadOnly = false, userId }: UseForumBoardOptions) {
  const boardQuery = useQuery({
    queryKey: ['forum-board', slug],
    queryFn: async (): Promise<ForumBoard | null> => {
      const { data, error } = await supabase
        .from('forum_boards')
        .select('*, forum_categories!inner(name, slug)')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
  });

  const threadsQuery = useQuery({
    queryKey: ['forum-threads', slug, page, typeFilter, search, sortBy, unreadOnly],
    enabled: !!boardQuery.data?.id,
    queryFn: async (): Promise<{ threads: ForumThread[]; total: number }> => {
      const boardId = boardQuery.data!.id;

      let query = supabase
        .from('forum_threads')
        .select('*', { count: 'exact' })
        .eq('board_id', boardId)
        .neq('status', 'ARCHIVED');

      if (typeFilter && typeFilter !== 'ALL') {
        query = query.eq('thread_type', typeFilter);
      }

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      // Pinned first, then by sort
      if (sortBy === 'recent') {
        query = query.order('is_pinned', { ascending: false }).order('last_post_at', { ascending: false });
      }

      const from = (page - 1) * perPage;
      query = query.range(from, from + perPage - 1);

      const { data: threads, error, count } = await query;
      if (error) throw error;

      // Fetch author names
      const authorIds = [...new Set((threads || []).map(t => t.author_user_id))];
      let authorNames: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);
        if (profiles) {
          profiles.forEach(p => { authorNames[p.id] = p.full_name || 'Anônimo'; });
        }
      }

      // Fetch post counts
      const threadIds = (threads || []).map(t => t.id);
      let postCounts: Record<string, number> = {};
      if (threadIds.length > 0) {
        const { data: posts } = await supabase
          .from('forum_posts')
          .select('id, thread_id')
          .in('thread_id', threadIds)
          .eq('is_deleted', false);
        if (posts) {
          posts.forEach(p => {
            postCounts[p.thread_id] = (postCounts[p.thread_id] || 0) + 1;
          });
        }
      }

      // Fetch views for unread detection
      let views: Record<string, string> = {};
      if (userId && threadIds.length > 0) {
        const { data: viewData } = await supabase
          .from('forum_thread_views')
          .select('thread_id, last_viewed_at')
          .eq('user_id', userId)
          .in('thread_id', threadIds);
        if (viewData) {
          viewData.forEach(v => { views[v.thread_id] = v.last_viewed_at; });
        }
      }

      let result = (threads || []).map(t => ({
        ...t,
        thread_type: t.thread_type as ForumThread['thread_type'],
        status: t.status as ForumThread['status'],
        contact_preference: t.contact_preference as ForumThread['contact_preference'],
        author_name: authorNames[t.author_user_id] || 'Anônimo',
        post_count: postCounts[t.id] || 0,
        is_unread: userId ? (!views[t.id] || t.last_post_at > views[t.id]) : false,
      }));

      // Sort by most replies if needed
      if (sortBy === 'most_replies') {
        const pinned = result.filter(t => t.is_pinned);
        const unpinned = result.filter(t => !t.is_pinned);
        unpinned.sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
        result = [...pinned, ...unpinned];
      }

      if (unreadOnly) {
        result = result.filter(t => t.is_unread);
      }

      return { threads: result, total: count || 0 };
    },
  });

  return { board: boardQuery, threads: threadsQuery };
}
