import { defineStore } from 'pinia'
import { ref } from 'vue'
import { sanitizeLogoText } from '@/utils/sanitize'

export const MAX_ACTIVE_STICKERS = 5
export const MAX_LOGO_TEXT_LENGTH = 24

export const useCustomizeStore = defineStore('customize', () => {
  const activeFilterId = ref<string>('normal')
  const frameColor = ref<string>('#ffffff')
  const selectedStickerIds = ref<string[]>([])
  const showDateTime = ref(false)
  const logoText = ref('')

  function setFilter(id: string) {
    activeFilterId.value = id
  }

  function setFrameColor(color: string) {
    frameColor.value = color
  }

  function toggleSticker(id: string) {
    const index = selectedStickerIds.value.indexOf(id)
    if (index === -1) {
      if (selectedStickerIds.value.length < MAX_ACTIVE_STICKERS) {
        selectedStickerIds.value.push(id)
      }
    } else {
      selectedStickerIds.value.splice(index, 1)
    }
  }

  function setDateTime(show: boolean) {
    showDateTime.value = show
  }

  function setLogoText(text: string) {
    logoText.value = sanitizeLogoText(text, MAX_LOGO_TEXT_LENGTH)
  }

  function reset() {
    activeFilterId.value = 'normal'
    frameColor.value = '#ffffff'
    selectedStickerIds.value = []
    showDateTime.value = false
    logoText.value = ''
  }

  return {
    activeFilterId,
    frameColor,
    selectedStickerIds,
    showDateTime,
    logoText,
    setFilter,
    setFrameColor,
    toggleSticker,
    setDateTime,
    setLogoText,
    reset,
  }
})
