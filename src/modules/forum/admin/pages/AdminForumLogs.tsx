import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminForumLogs } from '../../hooks/useAdminForum';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminForumLogs() {
  const [actionFilter, setActionFilter] = useState('');
  const { data: logs, isLoading } = useAdminForumLogs({ action: actionFilter || undefined });

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Logs de Moderação</h2>
        <Select value={actionFilter} onValueChange={v => setActionFilter(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas ações" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="pin">Fixar</SelectItem>
            <SelectItem value="unpin">Desafixar</SelectItem>
            <SelectItem value="lock">Trancar</SelectItem>
            <SelectItem value="unlock">Destrancar</SelectItem>
            <SelectItem value="archive">Arquivar</SelectItem>
            <SelectItem value="reopen">Reabrir</SelectItem>
            <SelectItem value="move">Mover</SelectItem>
            <SelectItem value="post_delete">Ocultar Post</SelectItem>
            <SelectItem value="post_restore">Restaurar Post</SelectItem>
            <SelectItem value="ban_user">Banir</SelectItem>
            <SelectItem value="unban_user">Desbanir</SelectItem>
            <SelectItem value="report_resolved">Denúncia Resolvida</SelectItem>
            <SelectItem value="report_rejected">Denúncia Rejeitada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {logs?.length === 0 && !isLoading && <p className="text-muted-foreground">Nenhum log.</p>}

      <div className="space-y-2">
        {logs?.map((l: any) => (
          <Card key={l.id}>
            <CardContent className="py-2 px-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{l.action}</Badge>
                  <span className="text-sm font-medium">{l.admin_name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alvo: {l.target_id?.slice(0, 8)}... · {format(new Date(l.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                </p>
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <p className="text-xs text-muted-foreground font-mono">{JSON.stringify(l.metadata).slice(0, 120)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
