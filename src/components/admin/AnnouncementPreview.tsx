import { Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AnnouncementPreviewProps = {
  title: string;
  message: string;
  type: string;
};

export const AnnouncementPreview = ({ title, message, type }: AnnouncementPreviewProps) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100';
      case 'alert':
        return 'bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-100';
      case 'success':
        return 'bg-green-500/10 border-green-500/20 text-green-900 dark:text-green-100';
      default:
        return 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-100';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 shrink-0" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4 shrink-0" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 shrink-0" />;
      default:
        return <Info className="h-4 w-4 shrink-0" />;
    }
  };

  return (
    <div className={cn("border rounded-lg p-3 flex items-center gap-3 mt-2", getTypeStyles())}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm block">{title || "Título do aviso"}</span>
        <span className="text-sm block truncate">{message || "Mensagem do aviso"}</span>
      </div>
    </div>
  );
};
