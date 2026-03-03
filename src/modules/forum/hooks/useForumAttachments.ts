import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForumAttachmentWithUrl {
  id: string;
  thread_id: string | null;
  post_id: string | null;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  signed_url: string | null;
}

/**
 * Fetch attachments for a thread (thread-level + all post-level)
 */
export function useThreadAttachments(threadId: string | undefined) {
  return useQuery({
    queryKey: ['forum-attachments', threadId],
    enabled: !!threadId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ForumAttachmentWithUrl[]> => {
      const { data, error } = await supabase
        .from('forum_attachments')
        .select('id, thread_id, post_id, file_path, mime_type, size_bytes, created_at')
        .eq('thread_id', threadId!);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Generate signed URLs for all attachments
      const paths = data.map(a => a.file_path);
      const { data: signedData, error: signError } = await supabase.storage
        .from('forum-attachments')
        .createSignedUrls(paths, 3600); // 1 hour

      const urlMap: Record<string, string> = {};
      if (signedData) {
        signedData.forEach((s, idx) => {
          if (s.signedUrl) urlMap[paths[idx]] = s.signedUrl;
        });
      }

      return data.map(a => ({
        ...a,
        signed_url: urlMap[a.file_path] || null,
      }));
    },
  });
}

/**
 * Upload files for a forum post (comment-level attachments)
 */
export async function uploadForumAttachments(
  files: File[],
  threadId: string,
  postId: string | null,
  userId: string
): Promise<{ file_path: string; mime_type: string; size_bytes: number }[]> {
  const uploaded: { file_path: string; mime_type: string; size_bytes: number }[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop();
    const filePath = `${userId}/${threadId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('forum-attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('[Forum] Upload error:', uploadError);
      continue;
    }

    // Insert attachment record
    const { error: insertError } = await supabase
      .from('forum_attachments')
      .insert({
        thread_id: threadId,
        post_id: postId,
        uploader_user_id: userId,
        file_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
      });

    if (!insertError) {
      uploaded.push({ file_path: filePath, mime_type: file.type, size_bytes: file.size });
    }
  }

  return uploaded;
}
