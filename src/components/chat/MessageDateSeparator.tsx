import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessageDateSeparatorProps {
  date: Date;
}

export function MessageDateSeparator({ date }: MessageDateSeparatorProps) {
  const getDateLabel = () => {
    if (isToday(date)) {
      return "Hoje";
    }
    if (isYesterday(date)) {
      return "Ontem";
    }
    if (isThisYear(date)) {
      return format(date, "d 'de' MMMM", { locale: ptBR });
    }
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted px-4 py-1 rounded-full">
        <span className="text-xs text-muted-foreground font-medium">
          {getDateLabel()}
        </span>
      </div>
    </div>
  );
}
