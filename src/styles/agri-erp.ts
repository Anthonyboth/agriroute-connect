/**
 * AgriRoute ERP Design Tokens
 * Reusable Tailwind class compositions for enterprise UI
 * 60/30/10: card (60%), muted/border (30%), primary accent (10%)
 */

export const ERP = {
  // ── Card base ──
  card:
    "rounded-2xl bg-card border border-border shadow-sm transition-all duration-200 " +
    "hover:shadow-md hover:border-primary/25",
  cardSoftGreen:
    "bg-primary/[0.035] border-primary/[0.16] " +
    "hover:bg-primary/[0.06] hover:border-primary/[0.28]",

  // ── Icon box ──
  iconBox:
    "h-11 w-11 rounded-xl flex items-center justify-center " +
    "bg-primary/10 text-primary border border-primary/15 " +
    "transition-all duration-150 group-hover:scale-105",

  // ── Typography ──
  title: "text-base font-bold text-foreground leading-tight tracking-tight",
  subtitle: "text-xs text-muted-foreground leading-tight",
  desc: "text-sm text-muted-foreground leading-relaxed line-clamp-3",

  // ── Footer ──
  footer: "mt-auto pt-3 space-y-3",

  // ── Chips ──
  chipNeutral:
    "h-6 inline-flex items-center gap-1.5 px-2.5 rounded-full border " +
    "bg-muted/60 text-muted-foreground border-border text-[11px] font-semibold leading-none whitespace-nowrap",
  chipVerified:
    "h-6 inline-flex items-center gap-1.5 px-2.5 rounded-full border " +
    "bg-primary/[0.12] text-primary border-primary/[0.22] text-[11px] font-semibold leading-none whitespace-nowrap",

  // ── CTA ──
  cta: "w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90",

  // ── Category colors (multicolored ERP) ──
  catColors: {
    agricultural: { bg: 'bg-emerald-500/[0.06]', bgHover: 'hover:bg-emerald-500/[0.12]', border: 'border-emerald-500/[0.20]', text: 'text-emerald-600 dark:text-emerald-400', chipBg: 'bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 border-emerald-500/[0.18]' },
    freight:      { bg: 'bg-orange-500/[0.06]',  bgHover: 'hover:bg-orange-500/[0.12]',  border: 'border-orange-500/[0.20]',  text: 'text-orange-600 dark:text-orange-400',   chipBg: 'bg-orange-500/[0.12] text-orange-600 dark:text-orange-400 border-orange-500/[0.18]' },
    logistics:    { bg: 'bg-sky-500/[0.06]',     bgHover: 'hover:bg-sky-500/[0.12]',     border: 'border-sky-500/[0.20]',     text: 'text-sky-600 dark:text-sky-400',         chipBg: 'bg-sky-500/[0.12] text-sky-600 dark:text-sky-400 border-sky-500/[0.18]' },
    technical:    { bg: 'bg-violet-500/[0.06]',  bgHover: 'hover:bg-violet-500/[0.12]',  border: 'border-violet-500/[0.20]',  text: 'text-violet-600 dark:text-violet-400',   chipBg: 'bg-violet-500/[0.12] text-violet-600 dark:text-violet-400 border-violet-500/[0.18]' },
    urban:        { bg: 'bg-cyan-500/[0.06]',    bgHover: 'hover:bg-cyan-500/[0.12]',    border: 'border-cyan-500/[0.20]',    text: 'text-cyan-600 dark:text-cyan-400',       chipBg: 'bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-400 border-cyan-500/[0.18]' },
  } as Record<string, { bg: string; bgHover: string; border: string; text: string; chipBg: string }>,
} as const;
