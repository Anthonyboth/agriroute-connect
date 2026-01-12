import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Archive, Copy, Calendar } from "lucide-react";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { AnnouncementPreview } from "@/components/admin/AnnouncementPreview";
import { BackButton } from "@/components/BackButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function AdminAnnouncementsManager() {
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
      } else if (selectedTab === "scheduled") {
        const now = new Date().toISOString();
        query = query.eq("is_active", true).gt("starts_at", now);
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
      toast({
        title: "Aviso arquivado",
        description: "O aviso foi arquivado com sucesso.",
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
      toast({
        title: "Aviso duplicado",
        description: "O aviso foi duplicado com sucesso.",
      });
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
    const colors = {
      informativo: "bg-blue-500/10 text-blue-900 dark:text-blue-100",
      financeiro: "bg-green-500/10 text-green-900 dark:text-green-100",
      comunicado: "bg-purple-500/10 text-purple-900 dark:text-purple-100",
      manutencao: "bg-orange-500/10 text-orange-900 dark:text-orange-100",
    };
    return colors[category as keyof typeof colors] || colors.informativo;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <BackButton label="Voltar" className="mb-4" to="/admin" />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Avisos</h1>
          <p className="text-muted-foreground">
            Crie, edite e gerencie avisos do sistema
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="scheduled">Agendados</TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : announcements && announcements.length > 0 ? (
            <div className="grid gap-4">
              {announcements.map((announcement) => (
                <Card key={announcement.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle>{announcement.title}</CardTitle>
                          <Badge className={getCategoryBadge(announcement.category)}>
                            {announcement.category || "informativo"}
                          </Badge>
                          <Badge variant="outline">
                            Prioridade: {announcement.priority || 5}
                          </Badge>
                        </div>
                        {announcement.starts_at && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Início:{" "}
                              {format(new Date(announcement.starts_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            {announcement.ends_at && (
                              <span>
                                | Fim:{" "}
                                {format(new Date(announcement.ends_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(announcement)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => duplicateMutation.mutate(announcement)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!announcement.archived && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => archiveMutation.mutate(announcement.id)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{announcement.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum aviso encontrado nesta categoria
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
