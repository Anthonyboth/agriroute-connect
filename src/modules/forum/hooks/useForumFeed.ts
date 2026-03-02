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

      // 2. Build threads query with joins to boards
      let query = supabase
        .from('forum_threads')
        .select('id, board_id, author_user_id, title, thread_type, price, location_text, status, is_pinned, is_locked, created_at, last_post_at, forum_boards!inner(name, slug)', { count: 'exact' })
        .neq('status', 'ARCHIVED')
        .eq('forum_boards.is_active', true);

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
        query = query.order('created_at', { ascending: false });
      }

      // Fetch a bigger window for hot/top to allow re-sorting
      const fetchLimit = sort === 'new' ? perPage : Math.min(200, perPage * 5);
      const from = sort === 'new' ? (page - 1) * perPage : 0;
      query = query.range(from, from + fetchLimit - 1);

      const { data: threads, error, count } = await query;
      if (error) throw error;
      if (!threads || threads.length === 0) return { threads: [], total: 0 };

      const threadIds = threads.map(t => t.id);
      const authorIds = [...new Set(threads.map(t => t.author_user_id))];

      // 3. Batch fetch: authors, scores, comment counts, body previews — all in parallel
      const [profilesRes, scoresRes, countsRes, bodiesRes] = await Promise.all([
        // Authors
        authorIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', authorIds)
          : Promise.resolve({ data: [] }),
        // Scores via view
        supabase.from('forum_thread_scores' as any).select('thread_id, score').in('thread_id', threadIds),
        // Comment counts via view
        supabase.from('forum_thread_comment_counts' as any).select('thread_id, comment_count').in('thread_id', threadIds),
        // Body previews (first post per thread)
        supabase.from('forum_posts')
          .select('thread_id, body')
          .in('thread_id', threadIds)
          .is('reply_to_post_id', null)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true }),
      ]);

      // Build maps
      const authorMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => { authorMap[p.id] = p.full_name || 'Anônimo'; });

      const scoreMap: Record<string, number> = {};
      (scoresRes.data || []).forEach((s: any) => { scoreMap[s.thread_id] = Number(s.score) || 0; });

      const commentMap: Record<string, number> = {};
      (countsRes.data || []).forEach((c: any) => { commentMap[c.thread_id] = Number(c.comment_count) || 0; });

      const bodyMap: Record<string, string> = {};
      const bodySeen = new Set<string>();
      (bodiesRes.data || []).forEach((p: any) => {
        if (!bodySeen.has(p.thread_id)) {
          bodySeen.add(p.thread_id);
          bodyMap[p.thread_id] = p.body.slice(0, 300);
        }
      });

      // 4. Build result
      let result: FeedThread[] = threads.map((t: any) => ({
        id: t.id,
        board_id: t.board_id,
        author_user_id: t.author_user_id,
        title: t.title,
        thread_type: t.thread_type,
        price: t.price,
        location_text: t.location_text,
        status: t.status,
        is_pinned: t.is_pinned,
        is_locked: t.is_locked,
        created_at: t.created_at,
        last_post_at: t.last_post_at,
        board_name: t.forum_boards?.name || '',
        board_slug: t.forum_boards?.slug || '',
        author_name: authorMap[t.author_user_id] || 'Anônimo',
        score: scoreMap[t.id] || 0,
        comment_count: commentMap[t.id] || 0,
        body_preview: bodyMap[t.id] || '',
      }));

      // 5. Sort
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
