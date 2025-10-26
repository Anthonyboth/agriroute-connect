import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseTypingIndicatorProps {
  companyId: string;
  driverProfileId: string;
  userProfileId: string;
}

export function useTypingIndicator({
  companyId,
  driverProfileId,
  userProfileId,
}: UseTypingIndicatorProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setTyping = async (isTyping: boolean) => {
    try {
      if (isTyping) {
        await supabase
          .from('chat_typing_indicators')
          .upsert({
            company_id: companyId,
            driver_profile_id: driverProfileId,
            user_profile_id: userProfileId,
            is_typing: true,
            updated_at: new Date().toISOString(),
          });
      } else {
        await supabase
          .from('chat_typing_indicators')
          .delete()
          .eq('company_id', companyId)
          .eq('driver_profile_id', driverProfileId)
          .eq('user_profile_id', userProfileId);
      }
    } catch (error) {
      console.error('Erro ao atualizar typing indicator:', error);
    }
  };

  const handleTyping = () => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set typing
    setTyping(true);

    // Auto-clear after 3 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 3000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setTyping(false);
    };
  }, []);

  return { handleTyping, setTyping };
}
