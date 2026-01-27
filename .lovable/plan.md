CÂMERA AO VIVO NO MODAL DE SELFIE (WEB + ANDROID + iOS)

Objetivo P0

Em /complete-profile (e em qualquer lugar que use CameraSelfie):

Ao abrir o modal de selfie:

Exibir preview ao vivo da câmera frontal dentro do modal, usando getUserMedia e <video playsInline muted>.

Mostrar botão “Capturar” (verde, padrão do app) que:

tira a foto via canvas,

congela o preview,

mostra botões “Refazer” e “Confirmar”.

Fechar o modal sempre desliga a câmera (chamar track.stop() em todas as tracks) e apaga o LED.

Fallback nativo com <input type="file" capture="user"> só quando:

getUserMedia não existir ou

falhar de verdade (após tentativa com gesto do usuário).

1. Contexto atual (não mudar o que está certo)

SelfieCaptureModal (portal baseado em createPortal) já está OK para z-index e para rodar em web/Capacitor. Não mude a lógica básica dele.

CameraSelfie.tsx hoje está 100% no modo fallback, usando <input type="file" capture="user"> e galeria.
👉 Não existe modo de preview ao vivo (getUserMedia) dentro do modal.

O tema do app já tem verde padrão em bg-primary/bg-success.

2. O que implementar em src/components/CameraSelfie.tsx

Transformar CameraSelfie para ter 3 modos claros:

stream – preview ao vivo (câmera ligada)

preview – foto capturada, imagem congelada

fallback – câmera nativa via input capture="user" / galeria (como hoje)

2.1. Novos estados e refs

Adicionar ao componente:

const videoRef = useRef<HTMLVideoElement | null>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null);
const streamRef = useRef<MediaStream | null>(null);

const [mode, setMode] = useState<'stream' | 'preview' | 'fallback'>('stream');
const [videoReady, setVideoReady] = useState(false);
const [starting, setStarting] = useState(false);
const [needsUserAction, setNeedsUserAction] = useState(false); // iOS / autoplay bloqueado
const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
const [previewUrl, setPreviewUrl] = useState<string | null>(null); // URL.createObjectURL


Manter os estados de galeria/fallback que já existem, mas separar semanticamente:
– quando estiver em fallback, usar esses estados;
– quando estiver em stream/preview, usar capturedBlob + previewUrl.

2.2. Função startCamera(origin: 'auto' | 'user')

Implementar algo neste espírito:

Se já houver streamRef.current, não recriar.

Tentar:

const constraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};


const stream = await navigator.mediaDevices.getUserMedia(constraints);

videoRef.current!.srcObject = stream;

aguardar loadedmetadata / canplay e depois:

try {
  await video.play();
  setVideoReady(true);
  setNeedsUserAction(false);
  setMode('stream');
} catch {
  // típico de iOS/WKWebView: autoplay bloqueado
  setNeedsUserAction(true);
  setMode('stream');
}


Em qualquer erro:

Se origin === 'auto', NÃO cair direto para fallback. Apenas marcar needsUserAction=true e exibir botão “Ativar câmera”.

Se origin === 'user' (o usuário clicou explicitamente) e ainda assim falhar com erros definitivos (NotFoundError, NotReadableError, etc.), então:

logar o erro,

mostrar toast simples,

setMode('fallback').

2.3. Função stopCamera()

Se streamRef.current existir:

streamRef.current.getTracks().forEach(t => t.stop());

streamRef.current = null;

Limpar videoRef.current!.srcObject = null;

setVideoReady(false);

Usar em:

captureFrame

reset

useEffect de cleanup (unmount/fechar modal).

2.4. Função captureFrame()

Só válida quando mode === 'stream' e videoReady.

Pegar dimensões do vídeo: video.videoWidth / video.videoHeight

Ajustar canvas e desenhar:

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);


Usar canvas.toBlob (preferível a toDataURL):

canvas.toBlob((blob) => {
  if (!blob) { ...erro...; return; }
  const url = URL.createObjectURL(blob);
  setCapturedBlob(blob);
  setPreviewUrl(url);
  setMode('preview');
  stopCamera();
}, 'image/jpeg', 0.9);


Não chamar onCapture aqui – só quando o usuário confirmar.

2.5. Função reset()

Se mode === 'preview':

revogar URL.revokeObjectURL(previewUrl) se existir,

limpar capturedBlob, previewUrl,

setMode('stream'),

chamar startCamera('user').

Se estiver em fallback → apenas limpar estados de arquivo como já faz hoje.

2.6. Função confirm()

Hoje você já converte file em blob e chama onCapture.
Atualizar para:

Se mode === 'preview' e capturedBlob existir:

onCapture(capturedBlob, 'CAMERA');

Se estiver em fallback por galeria:

manter o comportamento atual (onCapture(blob, 'GALLERY')).

Depois de confirmar, liberar previewUrl e parar câmera se por algum motivo ainda estiver ativa.

3. UX dentro do modal (layout)

Dentro do <Card> de CameraSelfie, ajustar a área principal assim:

3.1. Container de preview
<div className="relative bg-black rounded-lg overflow-hidden min-h-[320px] max-h-[50vh] flex items-center justify-center">
  {/* conteúdo por modo */}
</div>
<canvas ref={canvasRef} className="hidden" />

3.2. Quando mode === 'stream'

Mostrar <video>:

<video
  ref={videoRef}
  autoPlay
  muted
  playsInline
  className="w-full h-full object-cover"
/>


Se !videoReady e não needsUserAction → overlay:

<div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
  <div className="text-center text-sm">Carregando câmera...</div>
</div>


Se needsUserAction → overlay com botão:

<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white p-4">
  <p className="text-sm text-center">
    Toque no botão abaixo para ativar a câmera.
  </p>
  <Button
    type="button"
    className="bg-primary hover:bg-primary/90 text-primary-foreground"
    onClick={() => startCamera('user')}
  >
    <Camera className="mr-2 h-4 w-4" />
    Ativar câmera
  </Button>
</div>

3.3. Quando mode === 'preview'

Mostrar <img src={previewUrl} className="w-full h-full object-cover" />.

3.4. Quando mode === 'fallback'

Manter a ideia atual de labels + inputs capture="user" e galeria.

Botões:

“Tirar selfie (câmera do dispositivo)” – verde (bg-primary / bg-success).

“Enviar da galeria” – outline.

“Cancelar” – ghost.

4. Barra de ações (botões inferiores)

Trocar a lógica dos botões conforme o mode:

mode === 'stream'
Mostrar:

<Button
  type="button"
  onClick={captureFrame}
  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
  disabled={!videoReady || starting}
>
  <Camera className="mr-2 h-4 w-4" />
  Capturar
</Button>

{onCancel && (
  <Button type="button" variant="outline" onClick={onCancel}>
    <X className="h-4 w-4" /> Cancelar
  </Button>
)}


mode === 'preview'

<Button type="button" onClick={reset} variant="outline" size="lg">
  <RotateCcw className="mr-2 h-4 w-4" />
  Refazer
</Button>
<Button
  type="button"
  onClick={confirm}
  size="lg"
  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
  disabled={confirming}
>
  <Check className="mr-2 h-4 w-4" />
  {confirming ? 'Confirmando...' : 'Confirmar'}
</Button>


mode === 'fallback'
Usa os botões/labels já existentes hoje (selfie nativa + galeria + cancelar).

5. Ciclo de vida / cleanup (fundamental)

Em useEffect(() => () => stopCamera(), []) → garantir que ao desmontar o CameraSelfie (fechar modal) a câmera seja desligada.

Sempre que o modal de SelfieCaptureModal for fechado (onClose), o componente é desmontado e isso chama stopCamera().

6. Testes de aceite que eu espero passar

Web/desktop (Chrome/Edge)

Abrir /complete-profile → “Capturar Selfie” → modal abre com preview ao vivo.

Clicar “Capturar” (verde) → imagem congela, LED apaga, aparecem “Refazer/Confirmar”.

“Refazer” volta para preview ao vivo.

“Confirmar” chama onCapture(blob,'CAMERA') e permite seguir no fluxo.

Android (Chrome + Capacitor/WebView)

Mesmo comportamento, com LED da câmera ligando e desligando no tempo certo.

Fechar o modal sempre desliga a câmera (sem LED travado).

iOS (Safari + Capacitor/WKWebView)

Caso autoplay seja bloqueado: ao abrir o modal aparece botão “Ativar câmera”; ao tocar, preview ao vivo inicia.

Captura/Refazer/Confirmar funcionam.

Fechar modal encerra tracks.

Fallback

Bloqueando permissões ou simulando erro de getUserMedia:

UI muda para modo fallback,

“Tirar selfie (câmera do dispositivo)” abre câmera nativa,

Após tirar foto, aparece preview/confirmar como hoje.

Resumo: não quero apenas abrir a câmera nativa; quero preview ao vivo dentro do modal com getUserMedia, botão Capturar verde, e fallback nativo só se isso não for possível. Tudo isso precisa funcionar tanto no site quanto no app (Android/iOS com Capacitor).