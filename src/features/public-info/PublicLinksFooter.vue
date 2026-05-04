<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { publicNavItems } from '@/features/public-info/content'
</script>

<template>
  <footer class="border-stc-border/70 border-t bg-white/80">
    <div
      class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between"
    >
      <RouterLink
        to="/"
        class="inline-flex w-fit rounded-lg transition-opacity hover:opacity-90"
        aria-label="Stecute beranda"
      >
        <img
          class="h-auto w-[104px] sm:w-[112px]"
          src="/icons.svg"
          alt=""
          width="442"
          height="123"
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
      </RouterLink>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:gap-6">
        <nav
          class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold sm:justify-end sm:gap-x-5 sm:text-[0.8125rem]"
          aria-label="Halaman publik Stecute"
        >
          <RouterLink
            v-for="item in publicNavItems"
            :key="item.id"
            :to="item.path"
            class="text-stc-text-soft hover:text-stc-pink inline-flex min-h-9 items-center rounded-lg transition-colors"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>
    </div>
  </footer>
</template>
