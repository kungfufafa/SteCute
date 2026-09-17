<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    selected?: boolean
    disabled?: boolean
    ariaLabel: string
    title?: string
  }>(),
  {
    label: '',
    selected: false,
    disabled: false,
  },
)
</script>

<template>
  <button
    type="button"
    :aria-label="ariaLabel"
    :aria-pressed="label ? selected : undefined"
    :disabled="disabled"
    :title="title || label"
    :class="[
      'focus-visible:ring-stc-pink/40 flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
    ]"
  >
    <span
      :class="[
        'relative block size-12 overflow-hidden rounded-lg border',
        selected ? 'border-stc-pink ring-1 ring-stc-pink' : 'border-stc-border',
      ]"
    >
      <slot />
    </span>
    <span
      :class="[
        'w-full text-center text-[10px] font-medium leading-none',
        selected ? 'text-stc-pink-strong' : 'text-stc-text-soft',
        label ? '' : 'invisible',
      ]"
    >
      {{ label || '+' }}
    </span>
  </button>
</template>
