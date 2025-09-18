import React from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TestEmailFunction = () => {
  const testEmailFunction = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-auth-email', {
        body: {
          user: {
            email: 'teste@exemplo.com',
            user_metadata: {
              full_name: 'Usuário Teste'
            }
          },
          email_data: {
            token: '123456',
            token_hash: 'hash123',
            redirect_to: window.location.origin,
            email_action_type: 'signup',
            site_url: window.location.origin
          }
        }
      });

      if (error) {
        console.error('Erro:', error);
        toast.error('Erro ao testar função: ' + error.message);
      } else {
        console.log('Sucesso:', data);
        toast.success('Função testada com sucesso!');
      }
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao testar função');
    }
  };

  return (
    <div className="p-4">
      <Button onClick={testEmailFunction}>
        Testar Função de Email
      </Button>
    </div>
  );
};

export default TestEmailFunction;