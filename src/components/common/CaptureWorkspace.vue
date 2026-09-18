<script setup lang="ts">
withDefaults(defineProps<{ panelLabel?: string }>(), {
  panelLabel: 'Pengaturan dan kontrol foto',
})
</script>

<template>
  <div class="capture-workspace" data-testid="capture-workspace">
    <section
      class="capture-preview-area"
      aria-label="Preview kamera"
      data-testid="capture-preview-area"
    >
      <div class="capture-preview-frame">
        <slot name="preview" />
      </div>
    </section>

    <aside class="capture-controls" :aria-label="panelLabel" data-testid="capture-controls">
      <div v-if="$slots.toolbar" class="capture-toolbar">
        <slot name="toolbar" />
      </div>
      <div class="capture-settings" data-testid="capture-settings">
        <slot name="settings" />
      </div>
      <div class="capture-actions" data-testid="capture-actions">
        <slot name="actions" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.capture-workspace {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 100rem;
  min-height: 0;
  margin-inline: auto;
}

.capture-preview-area {
  order: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  align-items: center;
  justify-content: center;
}

.capture-preview-frame {
  width: 100%;
}

.capture-controls {
  display: contents;
}

.capture-toolbar {
  order: 0;
}

.capture-settings {
  order: 3;
  min-width: 0;
}

.capture-actions {
  order: 2;
}

@media (min-width: 1024px) {
  .capture-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24rem;
    gap: 1.5rem;
  }

  .capture-preview-area {
    order: 0;
  }

  .capture-preview-frame {
    /* Keep the photographed 4:3 area intact, with room for the header and padding. */
    width: min(100%, calc((100dvh - 8rem) * 4 / 3));
  }

  .capture-controls {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--surface-raised);
  }

  .capture-toolbar {
    flex-shrink: 0;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .capture-settings {
    order: 1;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.125rem;
    scrollbar-gutter: stable;
  }

  .capture-actions {
    order: 2;
    flex-shrink: 0;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
}
</style>
