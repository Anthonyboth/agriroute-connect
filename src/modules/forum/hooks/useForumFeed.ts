import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FeedSort = 'hot' | 'new' | 'top';
export type TopPeriod = '24h' | '7d' | '30d' | 'all';

interface FeedOptions {
  boardSlug?: string;
  sort: FeedSort;
  topPeriod?: TopPeriod;
  search?: string;
  page: number;
  perPage?: number;
}

export interface FeedThread {
  id: string;
  board_id: string;
  board_name: string;
  board_slug: string;
  author_user_id: string;
  author_name: string;
  title: string;
  thread_type: string;
  body_preview: string;
  price: number | null;
  location_text: string | null;
  status: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  last_post_at: string;
  score: number;
  comment_count: number;
}

function getTopPeriodDate(period: TopPeriod): string | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === '24h') now.setHours(now.getHours() - 24);
  else if (period === '7d') now.setDate(now.getDate() - 7);
  else if (period === '30d') now.setDate(now.getDate() - 30);
  return now.toISOString();
}

function calculateHotScore(score: number, createdAt: string): number {
  const absScore = Math.max(Math.abs(score), 1);
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const epoch = new Date(createdAt).getTime() / 1000;
  return sign * Math.log10(absScore) + epoch / 45000;
}

export function useForumFeed({ boardSlug, sort, topPeriod = 'all', search, page, perPage = 20 }: FeedOptions) {
  return useQuery({
    queryKey: ['forum-feed', boardSlug, sort, topPeriod, search, page],
    queryFn: async (): Promise<{ threads: FeedThread[]; total: number }> => {
      // 1. Get board filter
      let boardId: string | null = null;
      if (boardSlug) {
        const { data: board } = await supabase
          .from('forum_boards')
          .select('id')
          .eq('slug', boardSlug)
          .eq('is_active', true)
          .maybeSingle();
        if (board) boardId = board.id;
      }

      // 2. Build threads query
      let query = supabase
        .from('forum_threads')
        .select('id, board_id, author_user_id, title, thread_type, price, location_text, status, is_pinned, is_locked, created_at, last_post_at', { count: 'exact' })
        .neq('status', 'ARCHIVED');

      if (boardId) query = query.eq('board_id', boardId);

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      // Period filter for "top"
      if (sort === 'top') {
        const since = getTopPeriodDate(topPeriod);
        if (since) query = query.gte('created_at', since);
      }

      // For "new" sort, use created_at desc  
      if (sort === 'new') {
        query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      } else {
        // For hot and top, fetch more and sort client-side
        query = query.order('created_at', { ascending: false });
      }

      // Fetch a bigger window for hot/top to allow re-sorting
      const fetchLimit = sort === 'new' ? perPage : Math.min(200, perPage * 5);
      const from = sort === 'new' ? (page - 1) * perPage : 0;
      query = query.range(from, from + fetchLimit - 1);

      const { data: threads, error, count } = await query;
      if (error) throw error;
      if (!threads || threads.length === 0) return { threads: [], total: 0 };

      // 3. Fetch board info
      const boardIds = [...new Set(threads.map(t => t.board_id))];
      const { data: boards } = await supabase
        .from('forum_boards')
        .select('id, name, slug')
        .in('id', boardIds);
      const boardMap: Record<string, { name: string; slug: string }> = {};
      (boards || []).forEach(b => { boardMap[b.id] = { name: b.name, slug: b.slug }; });

      // 4. Fetch author names
      const authorIds = [...new Set(threads.map(t => t.author_user_id))];
      let authorNames: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);
        (profiles || []).forEach(p => { authorNames[p.id] = p.full_name || 'Anônimo'; });
      }

      // 5. Fetch vote scores
      const threadIds = threads.map(t => t.id);
      let scoreMap: Record<string, number> = {};
      if (threadIds.length > 0) {
        const { data: votes } = await supabase
          .from('forum_votes' as any)
          .select('thread_id, value')
          .eq('target_type', 'THREAD')
          .in('thread_id', threadIds);
        if (votes) {
          (votes as any[]).forEach(v => {
            scoreMap[v.thread_id] = (scoreMap[v.thread_id] || 0) + v.value;
          });
        }
      }

      // 6. Fetch comment counts
      let commentMap: Record<string, number> = {};
      if (threadIds.length > 0) {
        const { data: posts } = await supabase
          .from('forum_posts')
          .select('thread_id')
          .in('thread_id', threadIds)
          .eq('is_deleted', false);
        if (posts) {
          posts.forEach(p => {
            commentMap[p.thread_id] = (commentMap[p.thread_id] || 0) + 1;
          });
        }
      }

      // 7. Fetch body previews (first post per thread)
      let bodyMap: Record<string, string> = {};
      if (threadIds.length > 0) {
        const { data: firstPosts } = await supabase
          .from('forum_posts')
          .select('thread_id, body')
          .in('thread_id', threadIds)
          .is('reply_to_post_id', null)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });
        if (firstPosts) {
          // Take only first post per thread
          const seen = new Set<string>();
          firstPosts.forEach(p => {
            if (!seen.has(p.thread_id)) {
              seen.add(p.thread_id);
              bodyMap[p.thread_id] = p.body.slice(0, 300);
            }
          });
        }
      }

      // 8. Build result
      let result: FeedThread[] = threads.map(t => ({
        ...t,
        board_name: boardMap[t.board_id]?.name || '',
        board_slug: boardMap[t.board_id]?.slug || '',
        author_name: authorNames[t.author_user_id] || 'Anônimo',
        score: scoreMap[t.id] || 0,
        comment_count: commentMap[t.id] || 0,
        body_preview: bodyMap[t.id] || '',
      }));

      // 9. Sort
      if (sort === 'hot') {
        const pinned = result.filter(t => t.is_pinned);
        const unpinned = result.filter(t => !t.is_pinned);
        unpinned.sort((a, b) => calculateHotScore(b.score, b.created_at) - calculateHotScore(a.score, a.created_at));
        result = [...pinned, ...unpinned];
      } else if (sort === 'top') {
        const pinned = result.filter(t => t.is_pinned);
        const unpinned = result.filter(t => !t.is_pinned);
        unpinned.sort((a, b) => b.score - a.score);
        result = [...pinned, ...unpinned];
      }

      // Paginate for hot/top (already paginated for new)
      if (sort !== 'new') {
        const start = (page - 1) * perPage;
        result = result.slice(start, start + perPage);
      }

      return { threads: result, total: count || 0 };
    },
  });
}
