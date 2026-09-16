const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-stc-pink/40'

const btn = `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${focus}`

export const ui = {
  page: 'mx-auto flex min-h-dvh w-full flex-col overflow-x-hidden bg-stc-bg text-stc-text selection:bg-stc-pink/15 selection:text-stc-pink-strong',
  pageContent: 'mx-auto flex w-full max-w-3xl flex-1 flex-col',
  pageContentWide: 'mx-auto flex w-full max-w-5xl flex-1 flex-col',

  header:
    'flex w-full shrink-0 items-center justify-between gap-3 border-b border-stc-border px-4 py-3 sm:px-5',
  headerWide:
    'flex w-full shrink-0 items-center justify-between gap-3 border-b border-stc-border px-4 py-3 sm:px-5',
  headerGroup: 'flex min-w-0 flex-1 items-center gap-2',
  title: 'text-[15px] leading-snug font-medium text-stc-text',
  subtitle: 'mt-0.5 max-w-[42em] text-[13px] leading-normal text-stc-text-soft',

  content: 'mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-5 pb-8 sm:px-5 sm:pt-6',
  stack: 'flex flex-col gap-6',
  sectionIntro: 'space-y-1',
  bottomActions:
    'stc-safe-bottom flex w-full flex-col items-stretch gap-2 pt-6 sm:flex-row sm:items-center',

  iconButton: `${btn} size-8 text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text`,
  primaryButton: `${btn} h-8 px-2.5 bg-stc-pink text-white hover:bg-stc-pink-strong`,
  secondaryButton: `${btn} h-8 px-2.5 bg-stc-bg-2 text-stc-text hover:bg-stc-bg-3`,
  successButton: `${btn} h-8 px-2.5 bg-stc-success text-white hover:bg-stc-success-strong`,
  dangerButton: `${btn} h-8 px-2.5 bg-stc-error text-white hover:bg-stc-error-strong`,
  ghostButton: `${btn} h-8 px-2.5 text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text`,
  tertiaryButton: `${btn} h-8 px-1.5 text-stc-text-soft hover:text-stc-text`,

  badge:
    'inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium text-stc-text-soft bg-stc-bg-2',
  pinkBadge:
    'inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium text-stc-pink-strong bg-stc-pink-soft',

  sectionLabel: 'text-[13px] font-medium text-stc-text-soft',
  sectionTitle: 'text-lg leading-snug font-semibold text-stc-text sm:text-xl',
  sectionCopy: 'max-w-[42em] text-[13px] leading-normal text-stc-text-soft sm:text-sm',
  panel: 'overflow-hidden rounded-lg border border-stc-border bg-white',
  panelSoft: 'overflow-hidden rounded-lg border border-stc-border bg-stc-bg-2',
  emptyPanel:
    'mx-auto w-full max-w-md rounded-lg border border-stc-border bg-white px-5 py-8 text-center',
  surfaceIcon:
    'mx-auto mb-3 flex size-8 items-center justify-center rounded-md bg-stc-bg-2 text-stc-text-soft',
  statusIcon: 'mx-auto mb-3 flex size-8 items-center justify-center rounded-md',
  softTile: 'rounded-md bg-stc-bg-2 px-3 py-2',
  actionTile: `${btn} h-auto min-h-16 w-full flex-col gap-1.5 rounded-md border border-stc-border bg-white p-3 text-center text-xs font-medium text-stc-text hover:bg-stc-bg-2`,
  input: `h-8 w-full rounded-md border border-stc-border bg-white px-2.5 text-[13px] text-stc-text placeholder:text-stc-text-faint ${focus}`,
  segmented: 'inline-flex h-8 items-center gap-0.5 rounded-md bg-stc-bg-2 p-0.5',
  segmentedItem: `${btn} h-7 px-2.5 text-stc-text-soft hover:text-stc-text`,
  segmentedItemActive: 'bg-white text-stc-text shadow-stc-xs hover:bg-white hover:text-stc-text',
  alert:
    'rounded-md border border-stc-border bg-white px-3 py-2 text-[13px] leading-normal text-stc-text',
  alertError:
    'rounded-md border border-stc-error/20 bg-stc-error-soft px-3 py-2 text-[13px] leading-normal text-stc-error-strong',
  alertWarning:
    'rounded-md border border-stc-warning/20 bg-stc-warning-soft px-3 py-2 text-[13px] leading-normal text-stc-text',
  selectedCard: 'border-stc-text bg-stc-bg-2',
  card: 'rounded-lg border border-stc-border bg-white transition-colors hover:bg-stc-bg-2',
} as const
