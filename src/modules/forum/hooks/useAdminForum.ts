import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============ CATEGORIES ============
export function useAdminForumCategories() {
  return useQuery({
    queryKey: ['admin-forum-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_categories')
        .select('*')
        .order('order_index');
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { id?: string; name: string; slug: string; description: string; order_index: number; is_active: boolean }) => {
      if (cat.id) {
        const { error } = await supabase.from('forum_categories').update(cat).eq('id', cat.id);
        if (error) throw error;
      } else {
        const { id, ...rest } = cat;
        const { error } = await supabase.from('forum_categories').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-categories'] }),
  });
}

export function useAdminDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('forum_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-categories'] }),
  });
}

// ============ BOARDS ============
export function useAdminForumBoards() {
  return useQuery({
    queryKey: ['admin-forum-boards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_boards')
        .select('*, forum_categories(name)')
        .order('order_index');
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminSaveBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (board: any) => {
      if (board.id) {
        const { error } = await supabase.from('forum_boards').update(board).eq('id', board.id);
        if (error) throw error;
      } else {
        const { id, ...rest } = board;
        const { error } = await supabase.from('forum_boards').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-boards'] }),
  });
}

export function useAdminDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('forum_boards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-boards'] }),
  });
}

// ============ THREADS ============
export function useAdminForumThreads(boardId?: string, page = 1) {
  return useQuery({
    queryKey: ['admin-forum-threads', boardId, page],
    queryFn: async () => {
      let query = supabase
        .from('forum_threads')
        .select('*, forum_boards(name, slug)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * 30, page * 30 - 1);

      if (boardId) query = query.eq('board_id', boardId);

      const { data, error, count } = await query;
      if (error) throw error;

      // Author names
      const authorIds = [...new Set((data || []).map(t => t.author_user_id))];
      let names: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
        profiles?.forEach(p => { names[p.id] = p.full_name || 'Anônimo'; });
      }

      return {
        threads: (data || []).map(t => ({ ...t, author_name: names[t.author_user_id] || 'Anônimo' })),
        total: count || 0,
      };
    },
  });
}

export function useAdminThreadAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, action, data }: { threadId: string; action: string; data?: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const updates: any = {};
      if (action === 'pin') updates.is_pinned = true;
      if (action === 'unpin') updates.is_pinned = false;
      if (action === 'lock') updates.is_locked = true;
      if (action === 'unlock') updates.is_locked = false;
      if (action === 'archive') updates.status = 'ARCHIVED';
      if (action === 'reopen') updates.status = 'OPEN';
      if (action === 'move') updates.board_id = data?.board_id;
      if (action === 'close') updates.status = 'CLOSED';

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('forum_threads').update(updates).eq('id', threadId);
        if (error) throw error;
      }

      // Log
      await supabase.from('forum_moderation_logs').insert({
        admin_user_id: user.id,
        action,
        target_id: threadId,
        metadata: { ...updates, ...data },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-threads'] }),
  });
}

// ============ POSTS ============
export function useAdminForumPosts(threadId?: string) {
  return useQuery({
    queryKey: ['admin-forum-posts', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('*')
        .eq('thread_id', threadId!)
        .order('created_at');
      if (error) throw error;

      const authorIds = [...new Set((data || []).map(p => p.author_user_id))];
      let names: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
        profiles?.forEach(p => { names[p.id] = p.full_name || 'Anônimo'; });
      }

      return (data || []).map(p => ({ ...p, author_name: names[p.author_user_id] || 'Anônimo' }));
    },
  });
}

export function useAdminPostAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, action, reason }: { postId: string; action: 'delete' | 'restore'; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (action === 'delete') {
        const { error } = await supabase.from('forum_posts').update({ is_deleted: true, deleted_reason: reason || 'Admin' }).eq('id', postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('forum_posts').update({ is_deleted: false, deleted_reason: null }).eq('id', postId);
        if (error) throw error;
      }

      await supabase.from('forum_moderation_logs').insert({
        admin_user_id: user.id,
        action: `post_${action}`,
        target_id: postId,
        metadata: { reason },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-posts'] }),
  });
}

// ============ REPORTS ============
export function useAdminForumReports(status?: string) {
  return useQuery({
    queryKey: ['admin-forum-reports', status],
    queryFn: async () => {
      let query = supabase
        .from('forum_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'ALL') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;

      // Reporter names
      const userIds = [...new Set((data || []).map(r => r.reporter_user_id))];
      let names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        profiles?.forEach(p => { names[p.id] = p.full_name || 'Anônimo'; });
      }

      return (data || []).map(r => ({ ...r, reporter_name: names[r.reporter_user_id] || 'Anônimo' }));
    },
  });
}

export function useAdminReportAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, status, admin_notes, quickAction }: {
      reportId: string;
      status: string;
      admin_notes?: string;
      quickAction?: { type: string; targetId: string };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const updates: any = { status, admin_notes };
      if (status === 'RESOLVED' || status === 'REJECTED') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase.from('forum_reports').update(updates).eq('id', reportId);
      if (error) throw error;

      // Quick actions
      if (quickAction) {
        if (quickAction.type === 'lock_thread') {
          await supabase.from('forum_threads').update({ is_locked: true }).eq('id', quickAction.targetId);
        } else if (quickAction.type === 'delete_post') {
          await supabase.from('forum_posts').update({ is_deleted: true, deleted_reason: 'Denúncia aceita' }).eq('id', quickAction.targetId);
        } else if (quickAction.type === 'ban_user') {
          await supabase.from('forum_bans').insert({
            user_id: quickAction.targetId,
            banned_by_admin_id: user.id,
            reason: admin_notes || 'Denúncia confirmada',
          });
        }
      }

      await supabase.from('forum_moderation_logs').insert({
        admin_user_id: user.id,
        action: `report_${status.toLowerCase()}`,
        target_id: reportId,
        metadata: { admin_notes, quickAction },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-forum-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-forum-bans'] });
    },
  });
}

// ============ BANS ============
export function useAdminForumBans() {
  return useQuery({
    queryKey: ['admin-forum-bans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_bans')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).flatMap(b => [b.user_id, b.banned_by_admin_id]))];
      let names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        profiles?.forEach(p => { names[p.id] = p.full_name || 'Anônimo'; });
      }

      return (data || []).map(b => ({
        ...b,
        user_name: names[b.user_id] || 'Anônimo',
        admin_name: names[b.banned_by_admin_id] || 'Anônimo',
      }));
    },
  });
}

export function useAdminBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason, expiresAt }: { userId: string; reason: string; expiresAt?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase.from('forum_bans').insert({
        user_id: userId,
        banned_by_admin_id: user.id,
        reason,
        expires_at: expiresAt || null,
      });
      if (error) throw error;

      await supabase.from('forum_moderation_logs').insert({
        admin_user_id: user.id,
        action: 'ban_user',
        target_id: userId,
        metadata: { reason, expires_at: expiresAt },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-bans'] }),
  });
}

export function useAdminUnbanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (banId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase.from('forum_bans').delete().eq('id', banId);
      if (error) throw error;

      await supabase.from('forum_moderation_logs').insert({
        admin_user_id: user.id,
        action: 'unban_user',
        target_id: banId,
        metadata: {},
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-forum-bans'] }),
  });
}

// ============ LOGS ============
export function useAdminForumLogs(filters?: { action?: string; adminId?: string }) {
  return useQuery({
    queryKey: ['admin-forum-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('forum_moderation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.action) query = query.eq('action', filters.action);
      if (filters?.adminId) query = query.eq('admin_user_id', filters.adminId);

      const { data, error } = await query;
      if (error) throw error;

      const adminIds = [...new Set((data || []).map(l => l.admin_user_id))];
      let names: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', adminIds);
        profiles?.forEach(p => { names[p.id] = p.full_name || 'Anônimo'; });
      }

      return (data || []).map(l => ({ ...l, admin_name: names[l.admin_user_id] || 'Anônimo' }));
    },
  });
}
