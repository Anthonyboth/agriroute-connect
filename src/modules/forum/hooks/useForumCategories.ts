import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ForumCategory, ForumBoard } from '../types';

export function useForumCategories() {
  return useQuery({
    queryKey: ['forum-categories'],
    queryFn: async (): Promise<ForumCategory[]> => {
      // Fetch categories
      const { data: categories, error: catError } = await supabase
        .from('forum_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (catError) throw catError;

      // Fetch boards
      const { data: boards, error: boardError } = await supabase
        .from('forum_boards')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (boardError) throw boardError;

      // Fetch thread/post counts per board
      const boardIds = (boards || []).map(b => b.id);
      
      let threadCounts: Record<string, number> = {};
      let postCounts: Record<string, number> = {};
      let lastThreads: Record<string, any> = {};

      if (boardIds.length > 0) {
        // Get thread counts
        const { data: threads } = await supabase
          .from('forum_threads')
          .select('id, board_id, title, last_post_at, author_user_id')
          .in('board_id', boardIds)
          .neq('status', 'ARCHIVED');

        if (threads) {
          for (const t of threads) {
            threadCounts[t.board_id] = (threadCounts[t.board_id] || 0) + 1;
            // Track latest thread per board
            if (!lastThreads[t.board_id] || t.last_post_at > lastThreads[t.board_id].last_post_at) {
              lastThreads[t.board_id] = t;
            }
          }

          // Get post counts
          const threadIds = threads.map(t => t.id);
          if (threadIds.length > 0) {
            const { data: posts } = await supabase
              .from('forum_posts')
              .select('id, thread_id')
              .in('thread_id', threadIds)
              .eq('is_deleted', false);

            if (posts) {
              // Map posts to boards
              const threadToBoard: Record<string, string> = {};
              threads.forEach(t => { threadToBoard[t.id] = t.board_id; });
              for (const p of posts) {
                const boardId = threadToBoard[p.thread_id];
                if (boardId) {
                  postCounts[boardId] = (postCounts[boardId] || 0) + 1;
                }
              }
            }
          }
        }

        // Fetch author names for last threads
        const authorIds = Object.values(lastThreads).map((t: any) => t.author_user_id).filter(Boolean);
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

        // Enrich last threads with author names
        for (const boardId of Object.keys(lastThreads)) {
          const t = lastThreads[boardId];
          lastThreads[boardId] = {
            id: t.id,
            title: t.title,
            last_post_at: t.last_post_at,
            author_name: authorNames[t.author_user_id] || 'Anônimo',
          };
        }
      }

      // Group boards by category
      const result: ForumCategory[] = (categories || []).map(cat => ({
        ...cat,
        boards: (boards || [])
          .filter(b => b.category_id === cat.id)
          .map(b => ({
            ...b,
            thread_count: threadCounts[b.id] || 0,
            post_count: postCounts[b.id] || 0,
            last_thread: lastThreads[b.id] || null,
          })) as ForumBoard[],
      }));

      return result;
    },
  });
}
