<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { publicNavItems } from '@/features/public-info/content'
</script>

<template>
  <footer class="border-stc-border mt-auto border-t">
    <div
      class="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <RouterLink to="/" class="inline-flex w-fit" aria-label="Stecute beranda">
        <img
          class="h-auto w-[96px]"
          src="/icons.svg"
          alt=""
          width="442"
          height="123"
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
      </RouterLink>

      <nav
        class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]"
        aria-label="Halaman publik Stecute"
      >
        <RouterLink
          v-for="item in publicNavItems"
          :key="item.id"
          :to="item.path"
          class="text-stc-text-soft hover:text-stc-text inline-flex h-8 items-center"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </footer>
</template>
