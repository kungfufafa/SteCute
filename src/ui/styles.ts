export const ui = {
  // Layout
  page: 'mx-auto flex min-h-dvh w-full flex-col overflow-x-hidden bg-stc-bg text-stc-text selection:bg-stc-pink/20 selection:text-stc-pink',
  pageContent: 'mx-auto flex w-full max-w-3xl flex-1 flex-col',
  pageContentWide: 'mx-auto flex w-full max-w-6xl flex-1 flex-col',

  // Header
  header:
    'mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-5 pt-5 sm:px-6 md:px-8 lg:pt-8',
  headerWide:
    'mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-5 pt-5 sm:px-6 md:px-8 lg:pt-8',
  headerGroup: 'flex min-w-0 flex-1 items-center gap-3 sm:gap-4',
  title: 'text-lg font-bold leading-tight text-stc-text sm:text-xl',
  subtitle: 'mt-1 max-w-[34rem] text-xs font-medium leading-relaxed text-stc-text-soft sm:text-sm',

  // Content areas
  content: 'mx-auto flex w-full max-w-6xl flex-1 px-4 pb-6 sm:px-6 sm:pb-8 md:px-8',
  bottomActions:
    'stc-safe-bottom mt-auto flex w-full flex-col items-stretch gap-3 pt-6 sm:flex-row sm:items-center',

  // Buttons (Base states: active scale, focus ring, transition)
  iconButton:
    'inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-stc-border bg-white text-stc-text-soft shadow-stc-xs transition-all duration-200 hover:-translate-y-[1px] hover:bg-stc-bg-2 hover:text-stc-text active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-pink focus-visible:ring-offset-2',
  primaryButton:
    'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-stc-pink px-6 py-3.5 text-[0.9375rem] font-bold text-white shadow-stc-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-stc-pink-strong hover:shadow-stc-md active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-pink focus-visible:ring-offset-2',
  secondaryButton:
    'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-stc-border bg-white px-6 py-3.5 text-[0.9375rem] font-bold text-stc-text shadow-stc-xs transition-all duration-200 hover:-translate-y-[1px] hover:bg-stc-bg-2 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-pink focus-visible:ring-offset-2',
  successButton:
    'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-stc-success px-6 py-3.5 text-[0.9375rem] font-bold text-white shadow-stc-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-stc-success-strong hover:shadow-stc-md active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-success focus-visible:ring-offset-2',
  dangerButton:
    'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-stc-error px-6 py-3.5 text-[0.9375rem] font-bold text-white shadow-stc-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-stc-error-strong active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-error focus-visible:ring-offset-2',

  // Badges
  badge:
    'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-stc-border bg-white px-3 py-1.5 text-xs font-semibold text-stc-text-soft shadow-stc-xs',
  pinkBadge:
    'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-stc-pink-soft px-3 py-1.5 text-[0.6875rem] font-bold uppercase text-stc-pink',

  // Panels & Text
  sectionLabel: 'text-[0.6875rem] font-bold uppercase text-stc-text-faint',
  sectionTitle: 'text-2xl font-bold leading-tight text-stc-text sm:text-3xl',
  sectionCopy:
    'max-w-xl text-sm font-medium leading-relaxed text-stc-text-soft sm:text-[0.9375rem]',
  panel: 'overflow-hidden rounded-xl border border-stc-border bg-white shadow-stc-sm',
  panelSoft: 'overflow-hidden rounded-xl border border-stc-border bg-white shadow-stc-xs',
  emptyPanel:
    'mx-auto w-full max-w-xl rounded-xl border border-stc-border/70 bg-white px-6 py-12 text-center shadow-stc-sm sm:px-8 sm:py-14',
  surfaceIcon:
    'mx-auto mb-5 flex size-16 items-center justify-center rounded-xl bg-stc-pink-soft text-stc-pink shadow-stc-xs',
  statusIcon: 'mx-auto mb-5 flex size-16 items-center justify-center rounded-xl shadow-stc-xs',
  softTile: 'rounded-xl bg-stc-bg-2 px-4 py-3',
  actionTile:
    'flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-stc-border bg-white p-3 text-center text-xs font-bold text-stc-text shadow-stc-xs transition-all duration-200 hover:-translate-y-[1px] hover:bg-stc-bg-2 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-pink focus-visible:ring-offset-2',
} as const
