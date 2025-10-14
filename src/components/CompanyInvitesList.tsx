import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, XCircle, Mail, Link2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CompanyInvitesList: React.FC = () => {
  const { data: invites, isLoading } = useQuery({
    queryKey: ['company-invites'],
    queryFn: async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profileData) return [];

      const { data: companyData } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profileData.id)
        .single();

      if (!companyData) return [];

      const { data, error } = await supabase
        .from('convites_motoristas')
        .select(`
          *,
          transportadora:profiles!convites_motoristas_transportadora_id_fkey(full_name)
        `)
        .eq('transportadora_id', profileData.id)
        .order('criado_em', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  const getStatusInfo = (invite: any) => {
    if (invite.usado) {
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: 'Usado',
        variant: 'default' as const,
        color: 'text-green-500',
      };
    }
    
    const expirado = new Date(invite.expira_em) < new Date();
    if (expirado) {
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: 'Expirado',
        variant: 'destructive' as const,
        color: 'text-destructive',
      };
    }

    return {
      icon: <Clock className="h-4 w-4" />,
      label: 'Pendente',
      variant: 'secondary' as const,
      color: 'text-yellow-500',
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convites Recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!invites || invites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convites Recentes</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            Nenhum convite gerado ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Convites Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invites.map((invite) => {
            const status = getStatusInfo(invite);
            return (
              <div
                key={invite.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className={`mt-0.5 ${status.color}`}>
                  {status.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Criado em {format(new Date(invite.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      Expira em {format(new Date(invite.expira_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  
                  {invite.usado && invite.usado_em && (
                    <div className="flex items-center gap-2 text-xs text-green-600 mt-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>
                        Usado em {format(new Date(invite.usado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs font-mono text-muted-foreground truncate max-w-[100px]">
                  {invite.token.substring(0, 8)}...
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
