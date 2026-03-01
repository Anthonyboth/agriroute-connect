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
import { toast } from "@/hooks/use-toast";
import { AnnouncementPreview } from "./AnnouncementPreview";

type AnnouncementFormProps = {
  isOpen: boolean;
  onClose: () => void;
  announcement?: any;
};

export const AnnouncementForm = ({ isOpen, onClose, announcement }: AnnouncementFormProps) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [category, setCategory] = useState("informativo");
  const [priority, setPriority] = useState(5);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setMessage(announcement.message);
      setType(announcement.type || "info");
      setCategory(announcement.category || "informativo");
      setPriority(announcement.priority || 5);
      setStartsAt(announcement.starts_at || "");
      setEndsAt(announcement.ends_at || "");
    } else {
      resetForm();
    }
  }, [announcement, isOpen]);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setType("info");
    setCategory("informativo");
    setPriority(5);
    setStartsAt("");
    setEndsAt("");
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (announcement) {
        const { data: updated, error } = await supabase
          .from("system_announcements")
          .update(data)
          .eq("id", announcement.id)
          .select();
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error("Atualização não aplicada (0 linhas). Verifique permissões de administrador.");
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("system_announcements")
          .insert(data)
          .select();
        if (error) throw error;
        if (!inserted || inserted.length === 0) {
          throw new Error("Inserção não aplicada (0 linhas). Verifique permissões de administrador.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({
        title: announcement ? "Aviso atualizado" : "Aviso criado",
        description: announcement
          ? "O aviso foi atualizado com sucesso."
          : "O aviso foi criado com sucesso.",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = (isActive: boolean) => {
    if (!title || !message) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título e mensagem",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      title,
      message,
      type,
      category,
      priority,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_active: isActive,
      archived: false,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {announcement ? "Editar Aviso" : "Novo Aviso"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Digite o título do aviso"
            />
            <span className="text-xs text-muted-foreground">
              {title.length}/100 caracteres
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Digite a mensagem do aviso"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informação</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="alert">Alerta</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informativo">Informativo</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="comunicado">Comunicado</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="priority">Prioridade (1-10)</Label>
            <Input
              id="priority"
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="starts_at">Data de Início (opcional)</Label>
              <Input
                id="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ends_at">Data de Fim (opcional)</Label>
              <Input
                id="ends_at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>Preview</Label>
            <AnnouncementPreview
              title={title}
              message={message}
              type={type}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => handleSave(false)}>
            Salvar como Rascunho
          </Button>
          <Button onClick={() => handleSave(true)}>
            {startsAt && new Date(startsAt) > new Date()
              ? "Agendar Publicação"
              : "Publicar Agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
