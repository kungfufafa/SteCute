<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ui } from '@/ui/styles'
import PublicLinksFooter from '@/features/public-info/PublicLinksFooter.vue'
import {
  publicNavItems,
  publicPages,
  type PublicPage,
  type PublicPageId,
} from '@/features/public-info/content'

const props = defineProps<{
  pageId: PublicPageId
}>()

const router = useRouter()
const page = computed<PublicPage>(() => publicPages[props.pageId])

function startWithCamera() {
  router.push({ path: '/config', query: { source: 'camera' } })
}
</script>

<template>
  <div :class="ui.page">
    <header :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <RouterLink to="/" class="shrink-0" aria-label="Stecute beranda">
          <img
            class="block h-auto w-[108px]"
            src="/icons.svg"
            alt="Stecute"
            width="442"
            height="123"
            decoding="async"
          />
        </RouterLink>
      </div>

      <div class="flex items-center gap-3">
        <button :class="ui.primaryButton" @click="startWithCamera">Mulai Foto</button>
      </div>
    </header>

    <main :class="ui.content">
      <div :class="[ui.pageContentWide, 'gap-6 pb-10 sm:pb-12']">
        <nav
          :class="[ui.segmented, 'max-w-full self-start overflow-x-auto']"
          aria-label="Halaman transparansi Stecute"
        >
          <RouterLink
            v-for="item in publicNavItems"
            :key="item.id"
            :to="item.path"
            :aria-current="item.id === page.id ? 'page' : undefined"
            :class="[
              ui.segmentedItem,
              'flex-none px-3',
              item.id === page.id ? ui.segmentedItemActive : '',
            ]"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <section class="grid gap-3 py-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div class="max-w-3xl">
            <p :class="ui.sectionLabel">{{ page.eyebrow }}</p>
            <h1
              class="text-stc-text mt-2 max-w-2xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
            >
              {{ page.title }}
            </h1>
            <p class="text-stc-text-soft mt-3 max-w-[42em] text-[13px] leading-normal sm:text-sm">
              {{ page.summary }}
            </p>
          </div>

          <p class="text-stc-text-faint text-[13px] lg:pb-1">{{ page.updatedLabel }}</p>
        </section>

        <article>
          <template v-for="section in page.sections" :key="section.id">
            <section
              v-if="section.type === 'faq'"
              :id="section.id"
              class="border-stc-border/80 scroll-mt-6 border-t py-6 sm:py-7"
            >
              <div class="mb-3 max-w-3xl">
                <h2 class="text-stc-text text-lg leading-tight font-semibold">
                  {{ section.title }}
                </h2>
                <p
                  v-if="section.intro"
                  class="text-stc-text-soft mt-1 text-[13px] leading-normal sm:text-sm"
                >
                  {{ section.intro }}
                </p>
              </div>

              <div class="border-stc-border divide-stc-border max-w-4xl divide-y border-y">
                <details v-for="item in section.items" :key="item.question" class="group">
                  <summary
                    class="text-stc-text flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[13px] font-medium sm:text-sm"
                  >
                    <span>{{ item.question }}</span>
                    <span class="text-stc-text-faint shrink-0 group-open:hidden" aria-hidden="true"
                      >+</span
                    >
                    <span
                      class="text-stc-text-faint hidden shrink-0 group-open:inline"
                      aria-hidden="true"
                      >−</span
                    >
                  </summary>
                  <div
                    class="text-stc-text-soft max-w-3xl space-y-2 pb-4 text-[13px] leading-normal sm:text-sm"
                  >
                    <p v-for="paragraph in item.answer" :key="paragraph">{{ paragraph }}</p>
                  </div>
                </details>
              </div>
            </section>

            <section
              v-else
              :id="section.id"
              class="border-stc-border grid scroll-mt-6 gap-3 border-t py-6 sm:py-7 lg:grid-cols-[minmax(12rem,0.32fr)_minmax(0,0.68fr)] lg:gap-10"
            >
              <h2 class="text-stc-text text-lg leading-tight font-semibold">
                {{ section.title }}
              </h2>

              <div>
                <div
                  class="text-stc-text-soft max-w-[68ch] space-y-2 text-[13px] leading-normal sm:text-sm"
                >
                  <p v-for="paragraph in section.body" :key="paragraph">{{ paragraph }}</p>
                </div>

                <ul
                  v-if="section.bullets?.length"
                  class="text-stc-text-soft mt-4 grid max-w-[68ch] gap-1.5 text-[13px] leading-normal sm:grid-cols-2"
                >
                  <li v-for="bullet in section.bullets" :key="bullet" class="flex gap-2">
                    <span class="text-stc-text-faint">–</span>
                    <span>{{ bullet }}</span>
                  </li>
                </ul>
              </div>
            </section>
          </template>
        </article>
      </div>
    </main>

    <PublicLinksFooter />
  </div>
</template>
