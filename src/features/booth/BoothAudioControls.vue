<script setup lang="ts">
import { computed } from 'vue'
import { ui } from '@/ui/styles'

const props = defineProps<{
  microphoneEnabled: boolean
  microphoneAvailable: boolean
  microphoneBusy: boolean
  cameraReady: boolean
  speakerMuted: boolean
  playbackBlocked: boolean
  notice: string
}>()
defineEmits<{ toggleMicrophone: []; toggleSpeaker: [] }>()

const microphoneAction = computed(() =>
  props.microphoneEnabled ? 'Matikan mikrofon' : 'Nyalakan mikrofon',
)
const microphoneLabel = computed(() => {
  if (props.microphoneBusy) return 'Menghubungkan mikrofon…'
  if (!props.cameraReady) return 'Menyiapkan mikrofon…'
  if (!props.microphoneAvailable) return 'Nyalakan mikrofon'
  return props.microphoneEnabled ? 'Mikrofon aktif' : 'Mikrofon mati'
})
const speakerOff = computed(() => props.speakerMuted || props.playbackBlocked)
</script>

<template>
  <section class="mx-auto w-full max-w-5xl shrink-0" aria-label="Kontrol audio Duet">
    <div class="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        :class="[
          ui.secondaryButton,
          '!h-10 !rounded-full !px-4',
          microphoneEnabled ? 'ring-stc-success/30 ring-1' : '',
        ]"
        :aria-label="microphoneAction"
        :title="microphoneAction"
        :aria-pressed="!microphoneEnabled"
        :disabled="microphoneBusy || !cameraReady"
        data-testid="booth-microphone-toggle"
        @click="$emit('toggleMicrophone')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
          <path v-if="!microphoneEnabled" d="m3 3 18 18" />
        </svg>
        {{ microphoneLabel }}
      </button>
      <button
        type="button"
        :class="[ui.secondaryButton, '!h-10 !rounded-full !px-4']"
        :aria-label="speakerOff ? 'Nyalakan suara teman' : 'Matikan suara teman'"
        :title="speakerOff ? 'Nyalakan suara teman' : 'Matikan suara teman'"
        :aria-pressed="speakerOff"
        data-testid="booth-speaker-toggle"
        @click="$emit('toggleSpeaker')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m11 5-6 4H2v6h3l6 4V5Z" />
          <path v-if="speakerOff" d="m17 9 5 6m0-6-5 6" />
          <path v-else d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
        </svg>
        {{
          playbackBlocked && !speakerMuted
            ? 'Ketuk untuk dengar'
            : speakerOff
              ? 'Suara teman mati'
              : 'Suara teman aktif'
        }}
      </button>
    </div>
    <p
      v-if="notice"
      class="text-stc-text-soft mx-auto mt-2 max-w-lg text-center text-xs"
      role="status"
    >
      {{ notice }}
    </p>
    <p
      v-else-if="cameraReady && !microphoneAvailable"
      class="text-stc-text-soft mt-2 text-center text-xs"
      role="status"
    >
      Mikrofon belum aktif. Nyalakan untuk berbicara; foto tetap bisa diambil.
    </p>
  </section>
</template>
