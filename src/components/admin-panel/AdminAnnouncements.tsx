/**
 * AdminAnnouncements - Mural de Avisos profissional no painel admin v2
 * Com filtros, métricas, ações por card, paginação e audit log
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Edit, Archive, Copy, Calendar, Megaphone, RotateCcw, Trash2,
  Eye, BarChart3, MousePointerClick, Filter, ChevronLeft, ChevronRight,
} from "lucide-react";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { AnnouncementPreview } from "@/components/admin/AnnouncementPreview";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CenteredSpinner } from "@/components/ui/AppSpinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  subtitle?: string;
  message: string;
  type?: string;
  priority?: number;
  category?: string;
  archived?: boolean;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
  target_audience?: string[];
  cta_text?: string;
  cta_url?: string;
  banner_url?: string;
  view_count?: number;
  click_count?: number;
  last_viewed_at?: string;
};

const ITEMS_PER_PAGE = 20;

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  informativo: { label: "Informativo", color: "bg-blue-500/10 text-blue-900 dark:text-blue-100" },
  alerta: { label: "Alerta", color: "bg-red-500/10 text-red-900 dark:text-red-100" },
  promocao: { label: "Promoção", color: "bg-purple-500/10 text-purple-900 dark:text-purple-100" },
  atualizacao: { label: "Atualização", color: "bg-cyan-500/10 text-cyan-900 dark:text-cyan-100" },
  financeiro: { label: "Financeiro", color: "bg-green-500/10 text-green-900 dark:text-green-100" },
  comunicado: { label: "Comunicado", color: "bg-indigo-500/10 text-indigo-900 dark:text-indigo-100" },
  manutencao: { label: "Manutenção", color: "bg-orange-500/10 text-orange-900 dark:text-orange-100" },
};

const AUDIENCE_LABELS: Record<string, string> = {
  todos: "Todos",
  motoristas: "Motoristas",
  produtores: "Produtores",
  transportadoras: "Transportadoras",
  prestadores: "Prestadores",
};

const getPriorityColor = (p: number) => {
  if (p >= 80) return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20";
  if (p >= 60) return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20";
  if (p >= 40) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/20";
  if (p >= 20) return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20";
  return "bg-muted text-muted-foreground";
};

export default function AdminAnnouncements() {
  const [selectedTab, setSelectedTab] = useState("active");
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAudience, setFilterAudience] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const queryClient = useQueryClient();

  const { data: allAnnouncements, isLoading } = useQuery({
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

  // Apply client-side filters
  const filteredAnnouncements = useMemo(() => {
    if (!allAnnouncements) return [];
    return allAnnouncements.filter(a => {
      if (filterCategory !== "all" && a.category !== filterCategory) return false;
      if (filterAudience !== "all" && !(a.target_audience || ["todos"]).includes(filterAudience)) return false;
      if (filterPriority !== "all") {
        const p = a.priority || 50;
        if (filterPriority === "high" && p < 60) return false;
        if (filterPriority === "medium" && (p < 40 || p >= 60)) return false;
        if (filterPriority === "low" && p >= 40) return false;
      }
      return true;
    });
  }, [allAnnouncements, filterCategory, filterAudience, filterPriority]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE));
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useMemo(() => setCurrentPage(1), [filterCategory, filterAudience, filterPriority, selectedTab]);

  // --- Mutations ---
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated, error } = await supabase.from("system_announcements").update({ archived: true, is_active: false }).eq("id", id).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Operação bloqueada por permissões.");
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: "archive", changed_by: user?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso arquivado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated, error } = await supabase.from("system_announcements").update({ archived: false, is_active: false }).eq("id", id).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Operação bloqueada.");
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: "restore", changed_by: user?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso restaurado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso excluído permanentemente" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated, error } = await supabase.from("system_announcements").update({ is_active }).eq("id", id).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Operação bloqueada.");
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: is_active ? "activate" : "deactivate", changed_by: user?.id });
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: v.is_active ? "Aviso ativado" : "Aviso desativado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (a: Announcement) => {
      const { error } = await supabase.from("system_announcements").insert({
        title: `Cópia de ${a.title}`,
        subtitle: a.subtitle,
        message: a.message,
        type: a.type,
        priority: a.priority,
        category: a.category,
        target_audience: a.target_audience,
        cta_text: a.cta_text,
        cta_url: a.cta_url,
        banner_url: a.banner_url,
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso duplicado como rascunho" });
    },
  });

  const handleEdit = (a: Announcement) => { setEditingAnnouncement(a); setIsFormOpen(true); };
  const handleNew = () => { setEditingAnnouncement(null); setIsFormOpen(true); };

  // Stats
  const totalAll = allAnnouncements?.length || 0;
  const activeCount = allAnnouncements?.filter(a => a.is_active)?.length || 0;
  const totalViews = allAnnouncements?.reduce((s, a) => s + (a.view_count || 0), 0) || 0;
  const totalClicks = allAnnouncements?.reduce((s, a) => s + (a.click_count || 0), 0) || 0;

  const hasActiveFilters = filterCategory !== "all" || filterAudience !== "all" || filterPriority !== "all";

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mural de Avisos</h1>
            <p className="text-sm text-muted-foreground">Gerencie comunicados do sistema</p>
          </div>
        </div>
        <Button onClick={handleNew} size="default">
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Megaphone className="h-4 w-4 text-primary" /></div>
            <div>
              <div className="text-xl font-bold text-foreground">{activeCount}</div>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Eye className="h-4 w-4 text-blue-600" /></div>
            <div>
              <div className="text-xl font-bold text-foreground">{totalViews.toLocaleString("pt-BR")}</div>
              <p className="text-xs text-muted-foreground">Visualizações</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><MousePointerClick className="h-4 w-4 text-green-600" /></div>
            <div>
              <div className="text-xl font-bold text-foreground">{totalClicks.toLocaleString("pt-BR")}</div>
              <p className="text-xs text-muted-foreground">Cliques CTA</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><BarChart3 className="h-4 w-4 text-amber-600" /></div>
            <div>
              <div className="text-xl font-bold text-foreground">
                {totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : "0.0"}%
              </div>
              <p className="text-xs text-muted-foreground">Engajamento</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtros:</span>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAudience} onValueChange={setFilterAudience}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Público" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos públicos</SelectItem>
                {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="high">Alta (≥P60)</SelectItem>
                <SelectItem value="medium">Média (P40–59)</SelectItem>
                <SelectItem value="low">Baixa (&lt;P40)</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={() => { setFilterCategory("all"); setFilterAudience("all"); setFilterPriority("all"); }}
              >
                Limpar filtros
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredAnnouncements.length} resultado(s)
            </span>
          </div>
        </CardContent>
      </Card>

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
          ) : paginatedAnnouncements.length > 0 ? (
            <div className="grid gap-3">
              {paginatedAnnouncements.map((a) => {
                const cat = CATEGORY_CONFIG[a.category || "informativo"] || CATEGORY_CONFIG.informativo;
                const engagement = (a.view_count || 0) > 0
                  ? (((a.click_count || 0) / (a.view_count || 1)) * 100).toFixed(1)
                  : "0.0";

                return (
                  <Card key={a.id} className="group hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        {/* Left: Info */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Priority indicator */}
                            <Badge className={cn("text-[10px] font-bold", getPriorityColor(a.priority || 50))}>
                              P{a.priority || 50}
                            </Badge>
                            <CardTitle className="text-base">{a.title}</CardTitle>
                            {a.is_active && <Badge className="bg-primary/10 text-primary text-[10px]">Ativo</Badge>}
                          </div>
                          {a.subtitle && <p className="text-sm text-muted-foreground">{a.subtitle}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge className={cn("text-[10px]", cat.color)}>{cat.label}</Badge>
                            {(a.target_audience || ["todos"]).map(t => (
                              <Badge key={t} variant="outline" className="text-[10px]">
                                {AUDIENCE_LABELS[t] || t}
                              </Badge>
                            ))}
                          </div>
                          {(a.starts_at || a.ends_at) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              {a.starts_at && <span>{format(new Date(a.starts_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>}
                              {a.ends_at && <span>→ {format(new Date(a.ends_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>}
                            </div>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                          {/* Metrics mini */}
                          <div className="flex items-center gap-3 mr-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1" title="Visualizações"><Eye className="h-3 w-3" />{a.view_count || 0}</span>
                            <span className="flex items-center gap-1" title="Cliques CTA"><MousePointerClick className="h-3 w-3" />{a.click_count || 0}</span>
                            <span className="flex items-center gap-1" title="Engajamento"><BarChart3 className="h-3 w-3" />{engagement}%</span>
                          </div>

                          {!a.archived && (
                            <div className="flex items-center gap-1.5 border-l pl-2">
                              <span className="text-[10px] text-muted-foreground">{a.is_active ? "Ativo" : "Inativo"}</span>
                              <Switch
                                checked={a.is_active}
                                onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: a.id, is_active: checked })}
                              />
                            </div>
                          )}

                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewAnnouncement(a)} title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(a)} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMutation.mutate(a)} title="Duplicar">
                            <Copy className="h-4 w-4" />
                          </Button>
                          {!a.archived ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archiveMutation.mutate(a.id)} title="Arquivar">
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => restoreMutation.mutate(a.id)} title="Restaurar">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O aviso "{a.title}" será removido permanentemente. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(a.id)}
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
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{a.message}</p>
                      {a.cta_text && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary mt-1.5">
                          🔗 CTA: {a.cta_text}
                        </span>
                      )}
                      {a.last_viewed_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Última visualização: {format(new Date(a.last_viewed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhum aviso encontrado</p>
              <p className="text-sm mt-1">
                {hasActiveFilters ? "Tente ajustar os filtros." : selectedTab === "active" ? "Crie um novo aviso." : selectedTab === "drafts" ? "Rascunhos aparecerão aqui." : "Avisos arquivados aparecerão aqui."}
              </p>
              {selectedTab !== "archived" && !hasActiveFilters && (
                <Button onClick={handleNew} className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Aviso
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <AnnouncementForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingAnnouncement(null); }}
        announcement={editingAnnouncement}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewAnnouncement} onOpenChange={() => setPreviewAnnouncement(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview do Aviso</DialogTitle>
          </DialogHeader>
          {previewAnnouncement && (
            <AnnouncementPreview
              title={previewAnnouncement.title}
              subtitle={previewAnnouncement.subtitle}
              message={previewAnnouncement.message}
              type={previewAnnouncement.type || "info"}
              category={previewAnnouncement.category}
              priority={previewAnnouncement.priority}
              targetAudience={previewAnnouncement.target_audience}
              ctaText={previewAnnouncement.cta_text}
              ctaUrl={previewAnnouncement.cta_url}
              bannerUrl={previewAnnouncement.banner_url}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
