import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Render } from '@/db/schema'
import { RenderRepository } from '@/db/repositories'

export const useGalleryStore = defineStore('gallery', () => {
  const recentRenders = ref<Render[]>([])
  const storageUsageEstimate = ref(0)
  const isLoading = ref(false)

  const renderRepo = new RenderRepository()

  async function loadRecent() {
    isLoading.value = true
    try {
      recentRenders.value = await renderRepo.getRecent()
      storageUsageEstimate.value = await renderRepo.getStorageEstimate()
    } catch (error) {
      console.error('Failed to load gallery:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function removeRender(id: string): Promise<boolean> {
    try {
      await renderRepo.delete(id)
      await loadRecent()
      return true
    } catch (error) {
      console.error('Failed to delete render:', error)
      return false
    }
  }

  async function clearAll() {
    await renderRepo.clearAll()
    recentRenders.value = []
    storageUsageEstimate.value = 0
  }

  return {
    recentRenders,
    storageUsageEstimate,
    isLoading,
    loadRecent,
    removeRender,
    clearAll,
  }
})
