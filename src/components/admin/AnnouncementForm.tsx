import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { AnnouncementPreview } from "./AnnouncementPreview";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    } else {
      resetForm();
    }
  }, [announcement, isOpen]);

  const resetForm = () => {
    setTitle("");
    setSubtitle("");
    setMessage("");
    setType("info");
    setCategory("informativo");
    setPriority(50);
    setStartsAt("");
    setEndsAt("");
    setTargetAudience(["todos"]);
    setCtaText("");
    setCtaUrl("");
    setBannerUrl("");
    setFormTab("content");
  };

  const toggleAudience = (value: string) => {
    if (value === "todos") {
      setTargetAudience(["todos"]);
      return;
    }
    let next = targetAudience.filter(a => a !== "todos");
    if (next.includes(value)) {
      next = next.filter(a => a !== value);
    } else {
      next.push(value);
    }
    if (next.length === 0) next = ["todos"];
    setTargetAudience(next);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...data, updated_by: user?.id || null };

      if (announcement) {
        const { data: updated, error } = await supabase
          .from("system_announcements")
          .update(payload)
          .eq("id", announcement.id)
          .select();
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error("Atualização não aplicada. Verifique permissões de administrador.");
        }
        // Audit log
        await supabase.from("announcement_audit_log").insert({
          announcement_id: announcement.id,
          action: "update",
          changed_by: user?.id,
          old_values: { title: announcement.title, message: announcement.message, priority: announcement.priority, category: announcement.category },
          new_values: { title: data.title, message: data.message, priority: data.priority, category: data.category },
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("system_announcements")
          .insert(payload)
          .select();
        if (error) throw error;
        if (!inserted || inserted.length === 0) {
          throw new Error("Inserção não aplicada. Verifique permissões de administrador.");
        }
        // Audit log
        if (inserted[0]) {
          await supabase.from("announcement_audit_log").insert({
            announcement_id: inserted[0].id,
            action: "create",
            changed_by: user?.id,
            new_values: { title: data.title, category: data.category },
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({
        title: announcement ? "Aviso atualizado" : "Aviso criado",
        description: announcement ? "O aviso foi atualizado com sucesso." : "O aviso foi criado com sucesso.",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = (isActive: boolean) => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha título e mensagem", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      message: message.trim(),
      type,
      category,
      priority,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_active: isActive,
      archived: false,
      target_audience: targetAudience,
      cta_text: ctaText.trim() || null,
      cta_url: ctaUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
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
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="audience">Público</TabsTrigger>
              <TabsTrigger value="schedule">Período</TabsTrigger>
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
                <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Digite o conteúdo do aviso. Suporta quebras de linha." className="font-mono text-sm" />
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
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Prioridade: P{priority} — {getPriorityLabel(priority)}</Label>
                <Slider value={[priority]} onValueChange={([v]) => setPriority(v)} min={1} max={100} step={1} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>P1 (mínima)</span>
                  <span>P100 (máxima)</span>
                </div>
              </div>

              {/* CTA */}
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

              {/* Banner URL */}
              <div className="grid gap-2">
                <Label htmlFor="banner_url">URL do Banner (opcional)</Label>
                <Input id="banner_url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://... (URL da imagem do banner)" />
                {bannerUrl && (
                  <img src={bannerUrl} alt="Preview banner" className="w-full max-h-32 object-cover rounded-lg border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="audience" className="space-y-4 mt-4">
              <div className="grid gap-3">
                <Label className="text-sm font-semibold">Público Alvo</Label>
                <p className="text-xs text-muted-foreground">Selecione quem deve ver este aviso</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AUDIENCES.map(a => (
                    <label
                      key={a.value}
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={targetAudience.includes(a.value)}
                        onCheckedChange={() => toggleAudience(a.value)}
                      />
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
              {!startsAt && !endsAt && (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  Sem datas definidas, o aviso ficará ativo indefinidamente quando publicado.
                </p>
              )}
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <AnnouncementPreview
                title={title}
                subtitle={subtitle}
                message={message}
                type={type}
                category={category}
                priority={priority}
                targetAudience={targetAudience}
                ctaText={ctaText}
                ctaUrl={ctaUrl}
                bannerUrl={bannerUrl}
              />
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={saveMutation.isPending}>
            Salvar Rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : startsAt && new Date(startsAt) > new Date() ? "Agendar Publicação" : "Publicar Agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
