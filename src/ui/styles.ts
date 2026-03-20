export const ui = {
  page: 'mx-auto flex min-h-dvh w-full max-w-6xl flex-col bg-stc-bg text-stc-text',
  header: 'flex items-center justify-between gap-4 px-4 pb-5 pt-12 sm:px-6 lg:px-10',
  headerGroup: 'flex min-w-0 items-center gap-4',
  title: 'text-[1.125rem] font-bold tracking-tight text-stc-text leading-snug',
  subtitle: 'text-sm text-stc-text-soft leading-snug',
  content: 'flex-1 px-4 pb-6 sm:px-6 lg:px-10',
  contentWrap: 'mx-auto flex w-full max-w-5xl flex-1 flex-col',
  iconButton:
    'inline-flex size-11 items-center justify-center rounded-full border border-stc-border bg-white text-stc-text-soft shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-stc-bg-2 hover:text-stc-text active:scale-95',
  primaryButton:
    'inline-flex min-h-11 items-center justify-center rounded-2xl bg-stc-pink px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(244,91,141,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(244,91,141,0.36)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60',
  secondaryButton:
    'inline-flex min-h-11 items-center justify-center rounded-2xl border border-stc-border bg-white px-5 py-3 text-sm font-semibold text-stc-text shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-stc-bg-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60',
  successButton:
    'inline-flex min-h-11 items-center justify-center rounded-2xl bg-stc-green px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(16,185,129,0.3)] active:scale-[0.98]',
  badge:
    'inline-flex items-center rounded-full border border-stc-border bg-white px-3 py-1 text-xs font-semibold text-stc-text-soft shadow-stc-sm',
  pinkBadge: 'inline-flex items-center rounded-full bg-stc-pink-soft px-3 py-1 text-xs font-bold text-stc-pink',
  sectionLabel: 'text-xs font-bold uppercase tracking-[0.16em] text-stc-text-faint',
  panel: 'rounded-[28px] border border-stc-border bg-white shadow-stc-md',
  panelSoft: 'rounded-3xl border border-stc-border bg-white shadow-stc-sm',
} as const
