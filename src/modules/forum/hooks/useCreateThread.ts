import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateThreadInput {
  board_id: string;
  title: string;
  thread_type: string;
  body: string;
  price?: number | null;
  location_text?: string | null;
  contact_preference?: string | null;
  attachments?: File[];
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateThreadInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Create thread
      const { data: thread, error: threadError } = await supabase
        .from('forum_threads')
        .insert({
          board_id: input.board_id,
          author_user_id: user.id,
          title: input.title,
          thread_type: input.thread_type,
          price: input.price || null,
          location_text: input.location_text || null,
          contact_preference: input.contact_preference || null,
        })
        .select()
        .single();

      if (threadError) throw threadError;

      // Create first post
      const { error: postError } = await supabase
        .from('forum_posts')
        .insert({
          thread_id: thread.id,
          author_user_id: user.id,
          body: input.body,
        });

      if (postError) throw postError;

      // Upload attachments
      if (input.attachments && input.attachments.length > 0) {
        for (const file of input.attachments) {
          const ext = file.name.split('.').pop();
          const filePath = `${user.id}/${thread.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('forum-attachments')
            .upload(filePath, file);

          if (!uploadError) {
            await supabase
              .from('forum_attachments')
              .insert({
                thread_id: thread.id,
                uploader_user_id: user.id,
                file_path: filePath,
                mime_type: file.type,
                size_bytes: file.size,
              });
          }
        }
      }

      return thread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-categories'] });
      queryClient.invalidateQueries({ queryKey: ['forum-threads'] });
    },
  });
}
