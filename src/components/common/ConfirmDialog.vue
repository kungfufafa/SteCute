<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ui } from '@/ui/styles'

const props = defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
let previouslyFocused: HTMLElement | null = null

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      cancelButton.value?.focus()
    } else {
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('cancel')
    return
  }

  if (event.key === 'Tab') {
    const active = document.activeElement
    if (event.shiftKey && active === cancelButton.value) {
      event.preventDefault()
      confirmButton.value?.focus()
    } else if (!event.shiftKey && active === confirmButton.value) {
      event.preventDefault()
      cancelButton.value?.focus()
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="bg-stc-text/45 fixed inset-0 z-50 flex items-center justify-center p-4 [contain:layout_style_paint]"
      data-testid="confirm-dialog"
      @click.self="emit('cancel')"
      @keydown="handleKeydown"
    >
      <div
        :class="[ui.panel, 'w-full max-w-sm p-5']"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stc-confirm-title"
      >
        <h2 id="stc-confirm-title" class="text-stc-text text-[15px] font-medium">{{ title }}</h2>
        <p v-if="message" class="text-stc-text-soft mt-1 text-[13px] leading-normal">
          {{ message }}
        </p>
        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            ref="cancelButton"
            :class="ui.secondaryButton"
            data-testid="confirm-dialog-cancel"
            @click="emit('cancel')"
          >
            Batal
          </button>
          <button
            ref="confirmButton"
            :class="ui.dangerButton"
            data-testid="confirm-dialog-confirm"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
