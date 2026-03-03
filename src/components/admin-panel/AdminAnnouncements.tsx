/**
 * AdminAnnouncements - Sistema estratégico de comunicação
 * Pinning, workflow de aprovação, push, histórico de versões, relatório de performance
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
  Pin, Bell, Shield, CheckCircle, XCircle, History, TrendingUp,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  is_pinned?: boolean;
  status?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  send_push?: boolean;
  push_sent_at?: string;
  version?: number;
};

type VersionEntry = {
  id: string;
  version: number;
  title: string;
  message: string;
  category?: string;
  priority?: number;
  changed_by?: string;
  changed_at: string;
  change_summary?: string;
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
  todos: "Todos", motoristas: "Motoristas", produtores: "Produtores",
  transportadoras: "Transportadoras", prestadores: "Prestadores",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground", icon: Edit },
  pending_approval: { label: "Aguardando", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: Shield },
  published: { label: "Publicado", color: "bg-primary/10 text-primary", icon: CheckCircle },
  rejected: { label: "Rejeitado", color: "bg-destructive/10 text-destructive", icon: XCircle },
  archived: { label: "Arquivado", color: "bg-muted text-muted-foreground", icon: Archive },
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
  const [versionHistoryId, setVersionHistoryId] = useState<string | null>(null);
  const [rejectionDialogId, setRejectionDialogId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAudience, setFilterAudience] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const queryClient = useQueryClient();

  // Fetch announcements
  const { data: allAnnouncements, isLoading } = useQuery({
    queryKey: ["admin-announcements", selectedTab],
    queryFn: async () => {
      let query = supabase
        .from("system_announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (selectedTab === "active") {
        query = query.eq("is_active", true).eq("archived", false);
      } else if (selectedTab === "drafts") {
        query = query.eq("archived", false).in("status", ["draft", "rejected"]);
      } else if (selectedTab === "pending") {
        query = query.eq("status", "pending_approval").eq("archived", false);
      } else if (selectedTab === "archived") {
        query = query.eq("archived", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Announcement[];
    },
  });

  // Fetch version history
  const { data: versionHistory } = useQuery({
    queryKey: ["announcement-versions", versionHistoryId],
    queryFn: async () => {
      if (!versionHistoryId) return [];
      const { data, error } = await supabase
        .from("announcement_versions")
        .select("*")
        .eq("announcement_id", versionHistoryId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data as VersionEntry[];
    },
    enabled: !!versionHistoryId,
  });

  // Filters
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

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE));
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useMemo(() => setCurrentPage(1), [filterCategory, filterAudience, filterPriority, selectedTab]);

  // --- Mutations ---
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated, error } = await supabase.from("system_announcements").update({ archived: true, is_active: false, status: "archived" }).eq("id", id).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Operação bloqueada.");
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: "archive", changed_by: user?.id });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: "Aviso arquivado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated, error } = await supabase.from("system_announcements").update({ archived: false, is_active: false, status: "draft" }).eq("id", id).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Operação bloqueada.");
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: "restore", changed_by: user?.id });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: "Aviso restaurado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: "Aviso excluído" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: updated, error } = await supabase.from("system_announcements")
        .update({ is_active, status: is_active ? "published" : "draft" }).eq("id", id).select();
      if (error) throw error;
      if (!updated?.length) throw new Error("Operação bloqueada.");
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: is_active ? "activate" : "deactivate", changed_by: user?.id });
    },
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: v.is_active ? "Aviso ativado" : "Aviso desativado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("system_announcements").update({ is_pinned }).eq("id", id);
      if (error) throw error;
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: is_pinned ? "pin" : "unpin", changed_by: user?.id });
    },
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: v.is_pinned ? "Aviso fixado" : "Aviso desafixado" }); },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (a: Announcement) => {
      const { error } = await supabase.from("system_announcements").insert({
        title: `Cópia de ${a.title}`, subtitle: a.subtitle, message: a.message,
        type: a.type, priority: a.priority, category: a.category,
        target_audience: a.target_audience, cta_text: a.cta_text, cta_url: a.cta_url,
        banner_url: a.banner_url, is_active: false, status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: "Aviso duplicado como rascunho" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("system_announcements")
        .update({ status: "published", is_active: true, approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await supabase.from("announcement_audit_log").insert({ announcement_id: id, action: "approve", changed_by: user?.id });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }); toast({ title: "Aviso aprovado e publicado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("system_announcements")
        .update({ status: "rejected", is_active: false, rejection_reason: reason }).eq("id", id);
      if (error) throw error;
      await supabase.from("announcement_audit_log").insert({
        announcement_id: id, action: "reject", changed_by: user?.id,
        new_values: { rejection_reason: reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Aviso rejeitado" });
      setRejectionDialogId(null);
      setRejectionReason("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (a: Announcement) => { setEditingAnnouncement(a); setIsFormOpen(true); };
  const handleNew = () => { setEditingAnnouncement(null); setIsFormOpen(true); };

  // Stats
  const totalAll = allAnnouncements?.length || 0;
  const activeCount = allAnnouncements?.filter(a => a.is_active)?.length || 0;
  const pendingCount = allAnnouncements?.filter(a => a.status === "pending_approval")?.length || 0;
  const totalViews = allAnnouncements?.reduce((s, a) => s + (a.view_count || 0), 0) || 0;
  const totalClicks = allAnnouncements?.reduce((s, a) => s + (a.click_count || 0), 0) || 0;
  const pinnedCount = allAnnouncements?.filter(a => a.is_pinned)?.length || 0;

  const hasActiveFilters = filterCategory !== "all" || filterAudience !== "all" || filterPriority !== "all";

  // Top performers for report
  const topPerformers = useMemo(() => {
    if (!allAnnouncements) return [];
    return [...allAnnouncements]
      .filter(a => (a.view_count || 0) > 0)
      .sort((a, b) => {
        const engA = (a.click_count || 0) / (a.view_count || 1);
        const engB = (b.click_count || 0) / (b.view_count || 1);
        return engB - engA;
      })
      .slice(0, 5);
  }, [allAnnouncements]);

  const renderAnnouncementCard = (a: Announcement) => {
    const cat = CATEGORY_CONFIG[a.category || "informativo"] || CATEGORY_CONFIG.informativo;
    const statusCfg = STATUS_CONFIG[a.status || "draft"] || STATUS_CONFIG.draft;
    const engagement = (a.view_count || 0) > 0 ? (((a.click_count || 0) / (a.view_count || 1)) * 100).toFixed(1) : "0.0";

    return (
      <Card key={a.id} className={cn("group hover:shadow-md transition-shadow", a.is_pinned && "border-primary/30 bg-primary/[0.02]")}>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {a.is_pinned && <Pin className="h-3.5 w-3.5 text-primary fill-primary" />}
                <Badge className={cn("text-[10px] font-bold", getPriorityColor(a.priority || 50))}>P{a.priority || 50}</Badge>
                <CardTitle className="text-base">{a.title}</CardTitle>
                <Badge className={cn("text-[10px]", statusCfg.color)}>{statusCfg.label}</Badge>
                {a.send_push && a.push_sent_at && (
                  <Badge variant="outline" className="text-[10px] gap-1"><Bell className="h-2.5 w-2.5" />Push enviado</Badge>
                )}
              </div>
              {a.subtitle && <p className="text-sm text-muted-foreground">{a.subtitle}</p>}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge className={cn("text-[10px]", cat.color)}>{cat.label}</Badge>
                {(a.target_audience || ["todos"]).map(t => (
                  <Badge key={t} variant="outline" className="text-[10px]">{AUDIENCE_LABELS[t] || t}</Badge>
                ))}
              </div>
              {(a.starts_at || a.ends_at) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  {a.starts_at && <span>{format(new Date(a.starts_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>}
                  {a.ends_at && <span>→ {format(new Date(a.ends_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>}
                </div>
              )}
              {a.version && a.version > 1 && (
                <span className="text-[10px] text-muted-foreground">v{a.version}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-3 mr-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1" title="Visualizações"><Eye className="h-3 w-3" />{a.view_count || 0}</span>
                <span className="flex items-center gap-1" title="Cliques"><MousePointerClick className="h-3 w-3" />{a.click_count || 0}</span>
                <span className="flex items-center gap-1" title="Engajamento"><BarChart3 className="h-3 w-3" />{engagement}%</span>
              </div>

              {/* Approval actions */}
              {a.status === "pending_approval" && (
                <div className="flex gap-1 border-l pl-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate(a.id)} title="Aprovar">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRejectionDialogId(a.id)} title="Rejeitar">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {!a.archived && a.status !== "pending_approval" && (
                <div className="flex items-center gap-1.5 border-l pl-2">
                  <span className="text-[10px] text-muted-foreground">{a.is_active ? "Ativo" : "Inativo"}</span>
                  <Switch checked={a.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: a.id, is_active: checked })} />
                </div>
              )}

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePinMutation.mutate({ id: a.id, is_pinned: !a.is_pinned })} title={a.is_pinned ? "Desafixar" : "Fixar"}>
                <Pin className={cn("h-4 w-4", a.is_pinned && "fill-primary text-primary")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewAnnouncement(a)} title="Preview"><Eye className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(a)} title="Editar"><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMutation.mutate(a)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVersionHistoryId(a.id)} title="Histórico"><History className="h-4 w-4" /></Button>
              {!a.archived ? (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archiveMutation.mutate(a.id)} title="Arquivar"><Archive className="h-4 w-4" /></Button>
              ) : (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => restoreMutation.mutate(a.id)} title="Restaurar"><RotateCcw className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                        <AlertDialogDescription>O aviso "{a.title}" será removido. Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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
          {a.cta_text && <span className="inline-flex items-center gap-1 text-xs text-primary mt-1.5">🔗 CTA: {a.cta_text}</span>}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl"><Megaphone className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mural de Avisos</h1>
            <p className="text-sm text-muted-foreground">Sistema de comunicação estratégica</p>
          </div>
        </div>
        <Button onClick={handleNew} size="default"><Plus className="h-4 w-4 mr-2" />Novo Aviso</Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Megaphone className="h-4 w-4 text-primary" /></div>
          <div><div className="text-xl font-bold text-foreground">{activeCount}</div><p className="text-xs text-muted-foreground">Ativos</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg"><Shield className="h-4 w-4 text-amber-600" /></div>
          <div><div className="text-xl font-bold text-foreground">{pendingCount}</div><p className="text-xs text-muted-foreground">Pendentes</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Pin className="h-4 w-4 text-primary" /></div>
          <div><div className="text-xl font-bold text-foreground">{pinnedCount}</div><p className="text-xs text-muted-foreground">Fixados</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg"><Eye className="h-4 w-4 text-blue-600" /></div>
          <div><div className="text-xl font-bold text-foreground">{totalViews.toLocaleString("pt-BR")}</div><p className="text-xs text-muted-foreground">Visualizações</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg"><MousePointerClick className="h-4 w-4 text-green-600" /></div>
          <div><div className="text-xl font-bold text-foreground">{totalClicks.toLocaleString("pt-BR")}</div><p className="text-xs text-muted-foreground">Cliques CTA</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg"><TrendingUp className="h-4 w-4 text-amber-600" /></div>
          <div><div className="text-xl font-bold text-foreground">{totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : "0.0"}%</div><p className="text-xs text-muted-foreground">Engajamento</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Filter className="h-4 w-4" /><span>Filtros:</span></div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAudience} onValueChange={setFilterAudience}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Público" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos públicos</SelectItem>
                {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              <Button variant="ghost" size="sm" className="text-xs h-8"
                onClick={() => { setFilterCategory("all"); setFilterAudience("all"); setFilterPriority("all"); }}>
                Limpar filtros
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filteredAnnouncements.length} resultado(s)</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            Aprovação
            {pendingCount > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="drafts">Rascunhos</TabsTrigger>
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
          <TabsTrigger value="report">📊 Relatório</TabsTrigger>
        </TabsList>

        {/* Active / Pending / Drafts / Archived */}
        {["active", "pending", "drafts", "archived"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? <CenteredSpinner /> : paginatedAnnouncements.length > 0 ? (
              <div className="grid gap-3">{paginatedAnnouncements.map(renderAnnouncementCard)}</div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Nenhum aviso encontrado</p>
                <p className="text-sm mt-1">
                  {hasActiveFilters ? "Tente ajustar os filtros." : tab === "pending" ? "Nenhum aviso aguardando aprovação." : "Crie um novo aviso."}
                </p>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <span className="text-xs text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </TabsContent>
        ))}

        {/* Performance Report Tab */}
        <TabsContent value="report" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" />Relatório de Performance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{totalAll}</div>
                  <p className="text-xs text-muted-foreground">Total de Avisos</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{totalViews.toLocaleString("pt-BR")}</div>
                  <p className="text-xs text-muted-foreground">Total de Views</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{totalClicks.toLocaleString("pt-BR")}</div>
                  <p className="text-xs text-muted-foreground">Total de Cliques</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : "0.0"}%</div>
                  <p className="text-xs text-muted-foreground">Taxa de Engajamento</p>
                </div>
              </div>

              {topPerformers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">🏆 Top 5 Avisos por Engajamento</h3>
                  <div className="space-y-2">
                    {topPerformers.map((a, i) => {
                      const eng = ((a.click_count || 0) / (a.view_count || 1) * 100).toFixed(1);
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.title}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{a.view_count || 0} views</span>
                              <span>{a.click_count || 0} cliques</span>
                              <span className="font-semibold text-primary">{eng}% engajamento</span>
                            </div>
                          </div>
                          <Badge className={cn("text-[10px]", CATEGORY_CONFIG[a.category || "informativo"]?.color)}>
                            {CATEGORY_CONFIG[a.category || "informativo"]?.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              <div>
                <h3 className="text-sm font-semibold mb-3">📊 Avisos por Categoria</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                    const count = allAnnouncements?.filter(a => a.category === key).length || 0;
                    return (
                      <div key={key} className="flex items-center gap-2 p-2 border rounded-lg">
                        <Badge className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
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
          <DialogHeader><DialogTitle>Preview do Aviso</DialogTitle></DialogHeader>
          {previewAnnouncement && (
            <AnnouncementPreview
              title={previewAnnouncement.title} subtitle={previewAnnouncement.subtitle}
              message={previewAnnouncement.message} type={previewAnnouncement.type || "info"}
              category={previewAnnouncement.category} priority={previewAnnouncement.priority}
              targetAudience={previewAnnouncement.target_audience}
              ctaText={previewAnnouncement.cta_text} ctaUrl={previewAnnouncement.cta_url}
              bannerUrl={previewAnnouncement.banner_url}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!versionHistoryId} onOpenChange={() => setVersionHistoryId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Histórico de Versões</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {versionHistory && versionHistory.length > 0 ? (
              <div className="space-y-3">
                {versionHistory.map(v => (
                  <div key={v.id} className="p-3 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(v.changed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{v.message}</p>
                    {v.change_summary && <Badge className="text-[10px] bg-muted text-muted-foreground">{v.change_summary}</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma versão anterior encontrada.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectionDialogId} onOpenChange={() => { setRejectionDialogId(null); setRejectionReason(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rejeitar Aviso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Motivo da Rejeição</Label>
              <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Descreva o motivo da rejeição..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectionDialogId(null); setRejectionReason(""); }}>Cancelar</Button>
              <Button variant="destructive" disabled={!rejectionReason.trim() || rejectMutation.isPending}
                onClick={() => rejectionDialogId && rejectMutation.mutate({ id: rejectionDialogId, reason: rejectionReason.trim() })}>
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
