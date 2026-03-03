import { Info, AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AnnouncementPreviewProps = {
  title: string;
  subtitle?: string;
  message: string;
  type: string;
  category?: string;
  priority?: number;
  targetAudience?: string[];
  ctaText?: string;
  ctaUrl?: string;
  bannerUrl?: string;
  compact?: boolean;
};

const AUDIENCE_LABELS: Record<string, string> = {
  todos: "Todos",
  motoristas: "Motoristas",
  produtores: "Produtores",
  transportadoras: "Transportadoras",
  prestadores: "Prestadores",
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  informativo: { label: "Informativo", color: "bg-blue-500/10 text-blue-900 dark:text-blue-100" },
  alerta: { label: "Alerta", color: "bg-red-500/10 text-red-900 dark:text-red-100" },
  promocao: { label: "Promoção", color: "bg-purple-500/10 text-purple-900 dark:text-purple-100" },
  atualizacao: { label: "Atualização", color: "bg-cyan-500/10 text-cyan-900 dark:text-cyan-100" },
  financeiro: { label: "Financeiro", color: "bg-green-500/10 text-green-900 dark:text-green-100" },
  comunicado: { label: "Comunicado", color: "bg-indigo-500/10 text-indigo-900 dark:text-indigo-100" },
  manutencao: { label: "Manutenção", color: "bg-orange-500/10 text-orange-900 dark:text-orange-100" },
};

export const AnnouncementPreview = ({
  title,
  subtitle,
  message,
  type,
  category,
  priority,
  targetAudience,
  ctaText,
  ctaUrl,
  bannerUrl,
  compact = false,
}: AnnouncementPreviewProps) => {
  const getTypeStyles = () => {
    switch (type) {
      case "warning": return "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100";
      case "alert": return "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-100";
      case "success": return "bg-green-500/10 border-green-500/20 text-green-900 dark:text-green-100";
      default: return "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-100";
    }
  };

  const getIcon = () => {
    const cls = "h-5 w-5 shrink-0";
    switch (type) {
      case "warning": return <AlertTriangle className={cls} />;
      case "alert": return <AlertCircle className={cls} />;
      case "success": return <CheckCircle className={cls} />;
      default: return <Info className={cls} />;
    }
  };

  const catConfig = CATEGORY_CONFIG[category || "informativo"] || CATEGORY_CONFIG.informativo;

  if (compact) {
    return (
      <div className={cn("border rounded-lg p-3 flex items-center gap-3", getTypeStyles())}>
        {getIcon()}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm block">{title || "Título"}</span>
          <span className="text-sm block truncate">{message || "Mensagem"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-xl overflow-hidden", getTypeStyles())}>
      {bannerUrl && (
        <img src={bannerUrl} alt="Banner" className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-bold text-base">{title || "Título do aviso"}</h3>
            {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
          </div>
          {priority !== undefined && (
            <Badge variant="outline" className="shrink-0 text-xs">
              P{priority}
            </Badge>
          )}
        </div>

        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message || "Conteúdo do aviso"}</p>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          <Badge className={catConfig.color}>{catConfig.label}</Badge>
          {targetAudience && targetAudience.length > 0 && targetAudience.map(a => (
            <Badge key={a} variant="outline" className="text-xs">
              {AUDIENCE_LABELS[a] || a}
            </Badge>
          ))}
        </div>

        {/* CTA */}
        {ctaText && ctaUrl && (
          <Button size="sm" variant="default" className="gap-1.5 mt-2" asChild>
            <a href={ctaUrl} target={ctaUrl.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              {ctaText}
              {ctaUrl.startsWith("http") && <ExternalLink className="h-3 w-3" />}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};
