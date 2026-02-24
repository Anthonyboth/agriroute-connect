/**
 * AdminAnnouncements - Mural de Avisos integrado ao painel admin v2
 * Reutiliza a lógica do AdminAnnouncementsManager mas sem BackButton/container próprio
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Archive, Copy, Calendar, Megaphone, RotateCcw, Trash2 } from "lucide-react";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { AnnouncementPreview } from "@/components/admin/AnnouncementPreview";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CenteredSpinner } from "@/components/ui/AppSpinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type?: string;
  priority?: number;
  category?: string;
  archived?: boolean;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminAnnouncements() {
  const [selectedTab, setSelectedTab] = useState("active");
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin-announcements", selectedTab],
    queryFn: async () => {
      let query = supabase
        .from("system_announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (selectedTab === "active") {
        query = query.eq("is_active", true).eq("archived", false);
      } else if (selectedTab === "drafts") {
        query = query.eq("is_active", false).eq("archived", false);
      } else if (selectedTab === "archived") {
        query = query.eq("archived", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_announcements")
        .update({ archived: true, is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso arquivado", description: "O aviso foi arquivado com sucesso." });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_announcements")
        .update({ archived: false, is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso restaurado", description: "O aviso foi movido para rascunhos." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_announcements")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso excluído", description: "O aviso foi excluído permanentemente." });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("system_announcements")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({
        title: variables.is_active ? "Aviso ativado" : "Aviso desativado",
        description: variables.is_active
          ? "O aviso está visível para os usuários."
          : "O aviso foi desativado.",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (announcement: Announcement) => {
      const { error } = await supabase
        .from("system_announcements")
        .insert({
          title: `Cópia de ${announcement.title}`,
          message: announcement.message,
          type: announcement.type,
          priority: announcement.priority,
          category: announcement.category,
          is_active: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso duplicado", description: "O aviso foi duplicado como rascunho." });
    },
  });

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setEditingAnnouncement(null);
    setIsFormOpen(true);
  };

  const getCategoryBadge = (category?: string) => {
    const colors: Record<string, string> = {
      informativo: "bg-blue-500/10 text-blue-900 dark:text-blue-100",
      financeiro: "bg-green-500/10 text-green-900 dark:text-green-100",
      comunicado: "bg-purple-500/10 text-purple-900 dark:text-purple-100",
      manutencao: "bg-orange-500/10 text-orange-900 dark:text-orange-100",
    };
    return colors[category || "informativo"] || colors.informativo;
  };

  const activeCount = announcements?.filter(a => a.is_active)?.length || 0;

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mural de Avisos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie avisos e comunicados do sistema
            </p>
          </div>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Avisos Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">
              {announcements?.filter(a => !a.is_active && !a.archived)?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Rascunhos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">
              {announcements?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total nesta aba</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="drafts">Rascunhos</TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {isLoading ? (
            <CenteredSpinner />
          ) : announcements && announcements.length > 0 ? (
            <div className="grid gap-4">
              {announcements.map((announcement) => (
                <Card key={announcement.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{announcement.title}</CardTitle>
                          <Badge className={getCategoryBadge(announcement.category)}>
                            {announcement.category || "informativo"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            P{announcement.priority || 5}
                          </Badge>
                          {announcement.is_active && (
                            <Badge className="bg-primary/10 text-primary text-xs">Ativo</Badge>
                          )}
                        </div>
                        {(announcement.starts_at || announcement.ends_at) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {announcement.starts_at && (
                              <span>
                                Início: {format(new Date(announcement.starts_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            )}
                            {announcement.ends_at && (
                              <span>
                                | Fim: {format(new Date(announcement.ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Criado em {format(new Date(announcement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Toggle ativo/inativo */}
                        {!announcement.archived && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              {announcement.is_active ? "Ativo" : "Inativo"}
                            </span>
                            <Switch
                              checked={announcement.is_active}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({ id: announcement.id, is_active: checked })
                              }
                            />
                          </div>
                        )}
                        <Button variant="outline" size="icon" onClick={() => handleEdit(announcement)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => duplicateMutation.mutate(announcement)} title="Duplicar">
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!announcement.archived ? (
                          <Button variant="outline" size="icon" onClick={() => archiveMutation.mutate(announcement.id)} title="Arquivar">
                            <Archive className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" size="icon" onClick={() => restoreMutation.mutate(announcement.id)} title="Restaurar">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" title="Excluir permanentemente">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir aviso permanentemente?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O aviso "{announcement.title}" será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(announcement.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <AnnouncementPreview
                      title={announcement.title}
                      message={announcement.message}
                      type={announcement.type || "info"}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhum aviso nesta categoria</p>
              <p className="text-sm mt-1">
                {selectedTab === "active" && "Crie um novo aviso para comunicar seus usuários."}
                {selectedTab === "drafts" && "Rascunhos salvos aparecerão aqui."}
                {selectedTab === "archived" && "Avisos arquivados aparecerão aqui."}
              </p>
              {selectedTab !== "archived" && (
                <Button onClick={handleNew} className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Aviso
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AnnouncementForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingAnnouncement(null);
        }}
        announcement={editingAnnouncement}
      />
    </div>
  );
}
