import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StickyNote, Clock, Trash2, Plus, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface DriverNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  companyId: string;
}

interface DriverNote {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  note_type: string;
  creator_name?: string;
}

export const DriverNotesModal: React.FC<DriverNotesModalProps> = ({
  isOpen,
  onClose,
  driverId,
  driverName,
  companyId,
}) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'general' | 'performance' | 'incident' | 'positive'>('general');

  // Fetch notes from company_drivers.notes (stored as JSON)
  const { data: driverData, isLoading } = useQuery({
    queryKey: ['driver-notes', companyId, driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_drivers')
        .select('notes, id')
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverId)
        .single();

      if (error) throw error;
      
      // Parse notes from JSON string or return empty array
      const notes = data?.notes ? (
        typeof data.notes === 'string' 
          ? JSON.parse(data.notes) 
          : Array.isArray(data.notes) 
            ? data.notes 
            : []
      ) : [];
      
      return { notes: notes as DriverNote[], recordId: data?.id };
    },
    enabled: isOpen && !!driverId && !!companyId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: Omit<DriverNote, 'id' | 'creator_name'>) => {
      const existingNotes = driverData?.notes || [];
      const newNotes = [
        ...existingNotes,
        {
          ...note,
          id: crypto.randomUUID(),
          creator_name: profile?.full_name || 'Usuário',
        },
      ];

      const { error } = await supabase
        .from('company_drivers')
        .update({ notes: JSON.stringify(newNotes) })
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverId);

      if (error) throw error;
      return newNotes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-notes', companyId, driverId] });
      setNewNote('');
      toast.success('Nota adicionada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao adicionar nota');
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const existingNotes = driverData?.notes || [];
      const filteredNotes = existingNotes.filter((n: DriverNote) => n.id !== noteId);

      const { error } = await supabase
        .from('company_drivers')
        .update({ notes: JSON.stringify(filteredNotes) })
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverId);

      if (error) throw error;
      return filteredNotes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-notes', companyId, driverId] });
      toast.success('Nota removida');
    },
    onError: () => {
      toast.error('Erro ao remover nota');
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error('Digite o conteúdo da nota');
      return;
    }

    addNoteMutation.mutate({
      content: newNote.trim(),
      created_at: new Date().toISOString(),
      created_by: profile?.id || '',
      note_type: noteType,
    });
  };

  const getNoteTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      general: { label: 'Geral', variant: 'secondary' },
      performance: { label: 'Performance', variant: 'default' },
      incident: { label: 'Incidente', variant: 'destructive' },
      positive: { label: 'Positivo', variant: 'outline' },
    };
    return types[type] || types.general;
  };

  const notes = driverData?.notes || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notas sobre {driverName}
          </DialogTitle>
          <DialogDescription>
            Adicione observações privadas sobre este motorista. Apenas a transportadora pode ver estas notas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new note */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <div className="flex gap-2">
              {(['general', 'performance', 'incident', 'positive'] as const).map((type) => {
                const badgeInfo = getNoteTypeBadge(type);
                return (
                  <Badge
                    key={type}
                    variant={noteType === type ? badgeInfo.variant : 'outline'}
                    className={`cursor-pointer ${noteType === type ? '' : 'opacity-50'}`}
                    onClick={() => setNoteType(type)}
                  >
                    {badgeInfo.label}
                  </Badge>
                );
              })}
            </div>
            
            <Textarea
              placeholder="Escreva uma observação sobre o motorista..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            
            <Button 
              onClick={handleAddNote} 
              disabled={!newNote.trim() || addNoteMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nota
            </Button>
          </div>

          <Separator />

          {/* Notes list */}
          <div>
            <Label className="text-sm font-medium">Histórico de Notas ({notes.length})</Label>
            
            <ScrollArea className="h-[300px] mt-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando notas...
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma nota registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...notes].reverse().map((note: DriverNote) => {
                    const badgeInfo = getNoteTypeBadge(note.note_type);
                    return (
                      <div
                        key={note.id}
                        className="p-3 border rounded-lg bg-background"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={badgeInfo.variant} className="text-xs">
                              {badgeInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {note.creator_name && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {note.creator_name}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
