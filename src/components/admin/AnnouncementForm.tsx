import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { AnnouncementPreview } from "./AnnouncementPreview";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bell, Pin, Send, Clock, Shield } from "lucide-react";
import { sendPushNotification } from "@/utils/pushNotificationService";

const CATEGORIES = [
  { value: "informativo", label: "📋 Informativo" },
  { value: "alerta", label: "⚠️ Alerta" },
  { value: "promocao", label: "🎁 Promoção" },
  { value: "atualizacao", label: "🔄 Atualização" },
  { value: "financeiro", label: "💰 Financeiro" },
  { value: "comunicado", label: "📢 Comunicado" },
  { value: "manutencao", label: "🔧 Manutenção" },
];

const AUDIENCES = [
  { value: "todos", label: "Todos" },
  { value: "motoristas", label: "Motoristas" },
  { value: "produtores", label: "Produtores" },
  { value: "transportadoras", label: "Transportadoras" },
  { value: "prestadores", label: "Prestadores" },
];

const AUDIENCE_TO_ROLE: Record<string, string[]> = {
  todos: [],
  motoristas: ["MOTORISTA", "MOTORISTA_AFILIADO"],
  produtores: ["PRODUTOR"],
  transportadoras: ["TRANSPORTADORA"],
  prestadores: ["PRESTADOR_SERVICOS"],
};

type AnnouncementFormProps = {
  isOpen: boolean;
  onClose: () => void;
  announcement?: any;
};

export const AnnouncementForm = ({ isOpen, onClose, announcement }: AnnouncementFormProps) => {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [category, setCategory] = useState("informativo");
  const [priority, setPriority] = useState(50);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>(["todos"]);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const [formTab, setFormTab] = useState("content");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title || "");
      setSubtitle(announcement.subtitle || "");
      setMessage(announcement.message || "");
      setType(announcement.type || "info");
      setCategory(announcement.category || "informativo");
      setPriority(announcement.priority || 50);
      setStartsAt(announcement.starts_at ? announcement.starts_at.slice(0, 16) : "");
      setEndsAt(announcement.ends_at ? announcement.ends_at.slice(0, 16) : "");
      setTargetAudience(announcement.target_audience || ["todos"]);
      setCtaText(announcement.cta_text || "");
      setCtaUrl(announcement.cta_url || "");
      setBannerUrl(announcement.banner_url || "");
      setIsPinned(announcement.is_pinned || false);
      setSendPush(false);
    } else {
      resetForm();
    }
  }, [announcement, isOpen]);

  const resetForm = () => {
    setTitle(""); setSubtitle(""); setMessage(""); setType("info");
    setCategory("informativo"); setPriority(50); setStartsAt(""); setEndsAt("");
    setTargetAudience(["todos"]); setCtaText(""); setCtaUrl(""); setBannerUrl("");
    setIsPinned(false); setSendPush(false); setFormTab("content");
  };

  const toggleAudience = (value: string) => {
    if (value === "todos") { setTargetAudience(["todos"]); return; }
    let next = targetAudience.filter(a => a !== "todos");
    if (next.includes(value)) next = next.filter(a => a !== value);
    else next.push(value);
    if (next.length === 0) next = ["todos"];
    setTargetAudience(next);
  };

  const sendPushToAudience = async (announcementTitle: string, announcementMessage: string, audiences: string[]) => {
    try {
      const targetRoles: string[] = [];
      for (const aud of audiences) {
        const roles = AUDIENCE_TO_ROLE[aud];
        if (roles && roles.length > 0) targetRoles.push(...roles);
      }

      let profilesData: any[] | null = null;
      const client = supabase as any;
      if (targetRoles.length > 0) {
        const res = await client.from("profiles").select("user_id").eq("registration_status", "approved").in("role", targetRoles);
        profilesData = res.data;
      } else {
        const res = await client.from("profiles").select("user_id").eq("registration_status", "approved");
        profilesData = res.data;
      }

      if (!profilesData || profilesData.length === 0) return;
      const userIds = profilesData.map((p: any) => p.user_id).filter(Boolean) as string[];
      if (userIds.length === 0) return;

      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await sendPushNotification({
          userIds: batch,
          title: `📢 ${announcementTitle}`,
          message: announcementMessage.length > 100 ? announcementMessage.substring(0, 100) + "..." : announcementMessage,
          type: "system_announcement",
          url: "/dashboard",
        });
      }

      toast({ title: "Push enviado", description: `Notificação enviada para ${userIds.length} usuário(s).` });
    } catch (err) {
      console.error("[AnnouncementForm] Push error:", err);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...data, updated_by: user?.id || null };

      if (announcement) {
        const { data: updated, error } = await supabase
          .from("system_announcements").update(payload).eq("id", announcement.id).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error("Atualização não aplicada.");
        await supabase.from("announcement_audit_log").insert({
          announcement_id: announcement.id, action: "update", changed_by: user?.id,
          old_values: { title: announcement.title, message: announcement.message, priority: announcement.priority },
          new_values: { title: data.title, message: data.message, priority: data.priority },
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("system_announcements").insert(payload).select();
        if (error) throw error;
        if (!inserted || inserted.length === 0) throw new Error("Inserção não aplicada.");
        if (inserted[0]) {
          await supabase.from("announcement_audit_log").insert({
            announcement_id: inserted[0].id, action: "create", changed_by: user?.id,
            new_values: { title: data.title, category: data.category },
          });
        }
      }

      // Send push if enabled and publishing
      if (data.send_push && data.status === "published" && data.is_active) {
        await sendPushToAudience(data.title, data.message, data.target_audience || ["todos"]);
        // Mark push as sent
        if (announcement) {
          await supabase.from("system_announcements").update({ push_sent_at: new Date().toISOString() }).eq("id", announcement.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({
        title: announcement ? "Aviso atualizado" : "Aviso criado",
        description: announcement ? "O aviso foi atualizado." : "O aviso foi criado.",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = (action: "draft" | "pending" | "publish") => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha título e mensagem", variant: "destructive" });
      return;
    }

    const isScheduled = startsAt && new Date(startsAt) > new Date();
    const statusMap = { draft: "draft", pending: "pending_approval", publish: "published" };

    saveMutation.mutate({
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      message: message.trim(),
      type, category, priority,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_active: action === "publish" && !isScheduled,
      archived: false,
      target_audience: targetAudience,
      cta_text: ctaText.trim() || null,
      cta_url: ctaUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      is_pinned: isPinned,
      send_push: sendPush,
      status: statusMap[action],
    });
  };

  const getPriorityLabel = (p: number) => {
    if (p >= 80) return "🔴 Crítica";
    if (p >= 60) return "🟠 Alta";
    if (p >= 40) return "🟡 Média";
    if (p >= 20) return "🟢 Baixa";
    return "⚪ Mínima";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{announcement ? "Editar Aviso" : "Novo Aviso"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Tabs value={formTab} onValueChange={setFormTab}>
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="audience">Público</TabsTrigger>
              <TabsTrigger value="schedule">Período</TabsTrigger>
              <TabsTrigger value="options">Opções</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Digite o título do aviso" />
                <span className="text-xs text-muted-foreground">{title.length}/100</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
                <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={200} placeholder="Subtítulo complementar" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">Conteúdo *</Label>
                <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Digite o conteúdo do aviso." className="font-mono text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo Visual</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">ℹ️ Informação</SelectItem>
                      <SelectItem value="warning">⚠️ Aviso</SelectItem>
                      <SelectItem value="alert">🚨 Alerta</SelectItem>
                      <SelectItem value="success">✅ Sucesso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade: P{priority} — {getPriorityLabel(priority)}</Label>
                <Slider value={[priority]} onValueChange={([v]) => setPriority(v)} min={1} max={100} step={1} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>P1 (mínima)</span><span>P100 (máxima)</span>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <Label className="text-sm font-semibold">Call To Action (opcional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cta_text" className="text-xs">Texto do Botão</Label>
                    <Input id="cta_text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Ex: Saiba Mais" maxLength={50} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cta_url" className="text-xs">URL do Link</Label>
                    <Input id="cta_url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://... ou /rota-interna" />
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="banner_url">URL do Banner (opcional)</Label>
                <Input id="banner_url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." />
                {bannerUrl && (
                  <img src={bannerUrl} alt="Preview" className="w-full max-h-32 object-cover rounded-lg border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="audience" className="space-y-4 mt-4">
              <div className="grid gap-3">
                <Label className="text-sm font-semibold">Público Alvo</Label>
                <p className="text-xs text-muted-foreground">Selecione quem deve ver este aviso</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AUDIENCES.map(a => (
                    <label key={a.value} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      <Checkbox checked={targetAudience.includes(a.value)} onCheckedChange={() => toggleAudience(a.value)} />
                      <span className="text-sm font-medium">{a.label}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Selecionados: {targetAudience.join(", ")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="starts_at">Data de Início</Label>
                  <Input id="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  <span className="text-xs text-muted-foreground">Quando o aviso começa a ser exibido</span>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ends_at">Data de Fim</Label>
                  <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  <span className="text-xs text-muted-foreground">Quando o aviso para de ser exibido</span>
                </div>
              </div>
              {startsAt && new Date(startsAt) > new Date() && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <p className="text-sm text-primary">Este aviso será agendado para publicação automática.</p>
                </div>
              )}
              {!startsAt && !endsAt && (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  Sem datas definidas, o aviso ficará ativo indefinidamente quando publicado.
                </p>
              )}
            </TabsContent>

            <TabsContent value="options" className="space-y-4 mt-4">
              {/* Pin */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Pin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Fixar no Topo</p>
                    <p className="text-xs text-muted-foreground">Este aviso aparecerá sempre no topo do mural</p>
                  </div>
                </div>
                <Switch checked={isPinned} onCheckedChange={setIsPinned} />
              </div>

              {/* Push Notification */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Enviar Push ao Publicar</p>
                    <p className="text-xs text-muted-foreground">
                      Notificação push para o público-alvo selecionado
                    </p>
                    {announcement?.push_sent_at && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        Push já enviado
                      </Badge>
                    )}
                  </div>
                </div>
                <Switch checked={sendPush} onCheckedChange={setSendPush} disabled={!!announcement?.push_sent_at} />
              </div>

              {/* Approval Workflow Info */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Workflow de Aprovação</p>
                    <p className="text-xs text-muted-foreground">
                      Use "Enviar para Aprovação" para que outro admin revise antes de publicar
                    </p>
                    {announcement?.status === "pending_approval" && (
                      <Badge className="mt-1 bg-amber-500/15 text-amber-700">Aguardando aprovação</Badge>
                    )}
                    {announcement?.status === "rejected" && (
                      <div className="mt-1 space-y-1">
                        <Badge variant="destructive" className="text-[10px]">Rejeitado</Badge>
                        {announcement?.rejection_reason && (
                          <p className="text-xs text-destructive">{announcement.rejection_reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <AnnouncementPreview
                title={title} subtitle={subtitle} message={message} type={type}
                category={category} priority={priority} targetAudience={targetAudience}
                ctaText={ctaText} ctaUrl={ctaUrl} bannerUrl={bannerUrl}
              />
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 border-t flex-wrap">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave("draft")} disabled={saveMutation.isPending}>
            Salvar Rascunho
          </Button>
          <Button variant="outline" onClick={() => handleSave("pending")} disabled={saveMutation.isPending} className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Enviar para Aprovação
          </Button>
          <Button onClick={() => handleSave("publish")} disabled={saveMutation.isPending} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Salvando..." : startsAt && new Date(startsAt) > new Date() ? "Agendar" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
