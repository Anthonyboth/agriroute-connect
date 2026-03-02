import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCreateThread } from '../hooks/useCreateThread';
import { ForumLayout } from '../components/ForumLayout';
import { THREAD_TYPE_LABELS } from '../types';
import { toast } from 'sonner';
import { checkClientRateLimit, validateForumFile, FORUM_MAX_FILES } from '../utils/sanitize';

const MARKETPLACE_TYPES = ['VENDA', 'COMPRA', 'SERVICO', 'FRETE', 'PARCERIA'];

export default function ForumNewThread() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const boardId = searchParams.get('board') || '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [threadType, setThreadType] = useState('GERAL');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const createThread = useCreateThread();
  const isMarketplace = MARKETPLACE_TYPES.includes(threadType);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      const err = validateForumFile(f);
      if (err) {
        toast.error(err);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...valid].slice(0, FORUM_MAX_FILES));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !boardId) {
      toast.error('Preencha título e conteúdo.');
      return;
    }
    if (!checkClientRateLimit('thread', 3)) {
      toast.error('Aguarde um momento antes de criar outro tópico.');
      return;
    }

    try {
      const thread = await createThread.mutateAsync({
        board_id: boardId,
        title: title.trim(),
        thread_type: threadType,
        body: body.trim(),
        price: price ? parseFloat(price) : null,
        location_text: location || null,
        contact_preference: contact || null,
        attachments: files,
      });
      toast.success('Tópico criado!');
      navigate(`/forum/topico/${thread.id}`);
    } catch {
      toast.error('Erro ao criar tópico.');
    }
  };

  return (
    <ForumLayout
      title="Novo Tópico"
      breadcrumbs={[
        { label: 'Fórum', href: '/forum' },
        { label: 'Novo Tópico' },
      ]}
    >
      <Card>
        <CardHeader>
          <CardTitle>Criar Tópico</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Título do tópico"
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={threadType} onValueChange={setThreadType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(THREAD_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isMarketplace && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Cidade, Estado"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contato preferido</Label>
                  <Select value={contact} onValueChange={setContact}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHAT_APP">Chat do App</SelectItem>
                      <SelectItem value="TELEFONE">Telefone</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Escreva o conteúdo do tópico..."
                rows={8}
                required
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Anexos (máx 5, até 10MB cada)</Label>
              <div className="flex flex-wrap gap-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm">
                    <span className="truncate max-w-[150px]">{f.name}</span>
                    <button type="button" onClick={() => removeFile(idx)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {files.length < 5 && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      multiple
                      onChange={handleFiles}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-1" /> Anexar
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={createThread.isPending}>
                {createThread.isPending ? 'Criando...' : 'Criar Tópico'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ForumLayout>
  );
}
