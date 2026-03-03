import React, { useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateThread } from '../hooks/useCreateThread';
import { useForumCategories } from '../hooks/useForumCategories';
import { ForumLayout } from '../components/ForumLayout';
import { AutoModBanner } from '../components/AutoModBanner';
import { ForumFileUpload } from '../components/ForumFileUpload';
import { THREAD_TYPE_LABELS } from '../types';
import { toast } from 'sonner';
import { checkClientRateLimit, validateForumFile, FORUM_MAX_FILES } from '../utils/sanitize';
import { runAutoMod, maskPhoneNumbers } from '../utils/automod';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const MARKETPLACE_TYPES = ['VENDA', 'COMPRA', 'SERVICO', 'FRETE', 'PARCERIA'];
const PRICE_REQUIRED_TYPES = ['VENDA', 'SERVICO'];

export default function ForumNewThread() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const boardId = searchParams.get('board') || '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [threadType, setThreadType] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [automodAcknowledged, setAutomodAcknowledged] = useState(false);

  const createThread = useCreateThread();
  const { data: categories } = useForumCategories();
  const isMarketplace = MARKETPLACE_TYPES.includes(threadType);

  // Load board config to check flair requirements
  const boardQuery = useQuery({
    queryKey: ['forum-board-config', boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data } = await supabase
        .from('forum_boards')
        .select('id, name, requires_flair, allowed_flairs, requires_market_fields_for_flairs, block_phone_in_body')
        .eq('id', boardId)
        .maybeSingle();
      return data as any;
    },
  });

  const board = boardQuery.data;
  const requiresFlair = board?.requires_flair !== false;
  const allowedFlairs: string[] = board?.allowed_flairs || Object.keys(THREAD_TYPE_LABELS);
  const marketFieldFlairs: string[] = board?.requires_market_fields_for_flairs || MARKETPLACE_TYPES;
  const requiresMarketFields = marketFieldFlairs.includes(threadType);
  const blockPhoneInBody = board?.block_phone_in_body || false;

  // AutoMod check
  const automodResult = useMemo(() => runAutoMod(body), [body]);
  const hasAutoModWarnings = automodResult.flags.length > 0;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      const err = validateForumFile(f);
      if (err) { toast.error(err); return false; }
      return true;
    });
    setFiles(prev => [...prev, ...valid].slice(0, FORUM_MAX_FILES));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate flair
    if (requiresFlair && !threadType) {
      toast.error('Selecione o tipo (flair) do post.');
      return;
    }

    if (!title.trim() || !body.trim() || !boardId) {
      toast.error('Preencha título e conteúdo.');
      return;
    }

    // Validate marketplace required fields
    if (requiresMarketFields) {
      if (!location.trim()) {
        toast.error('Localização é obrigatória para este tipo de post.');
        return;
      }
      if (!contact) {
        toast.error('Selecione a forma de contato.');
        return;
      }
      if (PRICE_REQUIRED_TYPES.includes(threadType) && !price) {
        toast.error('Preço é obrigatório para posts de venda/serviço.');
        return;
      }
    }

    // AutoMod acknowledgement
    if (hasAutoModWarnings && !automodAcknowledged) {
      toast.error('Revise os avisos do AutoMod e confirme que entende os riscos.');
      return;
    }

    if (!checkClientRateLimit('thread', 3)) {
      toast.error('Aguarde um momento antes de criar outro tópico.');
      return;
    }

    // Process body (mask phones if needed)
    let processedBody = body.trim();
    if (blockPhoneInBody) {
      processedBody = maskPhoneNumbers(processedBody);
    }

    try {
      const thread = await createThread.mutateAsync({
        board_id: boardId,
        title: title.trim(),
        thread_type: threadType || 'GERAL',
        body: processedBody,
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
          {board && <p className="text-sm text-muted-foreground">em r/{board.name}</p>}
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
                <Label>Tipo (Flair) {requiresFlair && '*'}</Label>
                <Select value={threadType} onValueChange={setThreadType}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {allowedFlairs.map(flair => (
                      <SelectItem key={flair} value={flair}>
                        {THREAD_TYPE_LABELS[flair] || flair}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marketplace fields */}
            {requiresMarketFields && (
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  📋 Detalhes do Anúncio
                  <span className="text-xs text-muted-foreground font-normal">(obrigatórios para {THREAD_TYPE_LABELS[threadType]})</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Preço (R$) {PRICE_REQUIRED_TYPES.includes(threadType) && '*'}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="0,00"
                        className="flex-1"
                      />
                      <Input
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        placeholder="ton, saca..."
                        className="w-24"
                        maxLength={20}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Localização *</Label>
                    <Input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Cidade, UF"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contato preferido *</Label>
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
                <div className="space-y-2">
                  <Label>Data de disponibilidade (opcional)</Label>
                  <Input
                    type="date"
                    value={availabilityDate}
                    onChange={e => setAvailabilityDate(e.target.value)}
                    className="w-48"
                  />
                </div>
              </div>
            )}

            {/* Non-marketplace but still show optional price/location */}
            {isMarketplace && !requiresMarketFields && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Cidade, Estado" maxLength={100} />
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

            {/* AutoMod warnings */}
            {hasAutoModWarnings && (
              <div className="space-y-3">
                <AutoModBanner flags={automodResult.flags} />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="automod-ack"
                    checked={automodAcknowledged}
                    onCheckedChange={(v) => setAutomodAcknowledged(!!v)}
                  />
                  <label htmlFor="automod-ack" className="text-sm text-muted-foreground cursor-pointer">
                    Entendo os riscos e confirmo que o conteúdo é legítimo.
                  </label>
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Anexos (máx 5 — JPG, PNG, WebP, GIF ou PDF, até 10MB cada)</Label>
              <ForumFileUpload files={files} onFilesChange={setFiles} />
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
