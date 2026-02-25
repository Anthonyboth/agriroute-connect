/**
 * Enterprise BI Design System — tokens para Control Tower
 * Usar esses tokens em TODOS os cards/headers/labels do painel PRODUTOR.
 */
export const BI = {
  // ─── Superfícies ───────────────────────────────────────────────────
  radius: 'rounded-2xl',
  card: 'bg-card border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.25)]',
  cardSoft: 'bg-muted/10 border border-border/40',
  cardHover: 'hover:bg-muted/15 transition-all duration-200',
  cardGlass: 'bg-card/80 backdrop-blur-sm border border-border/50',

  // ─── Grid ──────────────────────────────────────────────────────────
  gridGap: 'gap-2.5 sm:gap-3',

  // ─── Tipografia ────────────────────────────────────────────────────
  label: 'text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground',
  value: 'text-xl sm:text-2xl font-extrabold tabular-nums leading-tight',
  valueLg: 'text-3xl sm:text-4xl font-extrabold tabular-nums leading-none',
  sub: 'text-[11px] text-muted-foreground',
  sectionTitle: 'text-sm font-bold text-foreground',
  sectionSub: 'text-[11px] text-muted-foreground',

  // ─── Semânticas ────────────────────────────────────────────────────
  good: 'text-[hsl(142,71%,45%)]',
  goodBg: 'bg-[hsl(142,71%,45%)]/8 border-[hsl(142,71%,45%)]/20',
  warn: 'text-amber-400',
  warnBg: 'bg-amber-400/8 border-amber-400/20',
  bad: 'text-destructive',
  badBg: 'bg-destructive/8 border-destructive/20',

  // ─── Tabela ────────────────────────────────────────────────────────
  tableHeader: 'sticky top-0 bg-card z-10 border-b border-border/60',
  tableHeaderCell: 'h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground align-middle',
  tableRow: 'border-b border-border/30 transition-colors duration-150',
  tableRowEven: 'bg-muted/[0.04]',
  tableRowHover: 'hover:bg-muted/20',
  tableCell: 'px-3 py-2 text-xs',
  tableCellNum: 'px-3 py-2 text-xs tabular-nums text-right',
} as const;
