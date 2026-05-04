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
            class="block h-auto w-[116px] md:w-[132px]"
            src="/icons.svg"
            alt="Stecute"
            width="442"
            height="123"
            decoding="async"
          />
        </RouterLink>
      </div>

      <div class="flex items-center gap-3">
        <button
          :class="[ui.primaryButton, '!min-h-11 !w-auto !px-5 !py-2.5 !text-sm']"
          @click="startWithCamera"
        >
          Mulai Foto
        </button>
      </div>
    </header>

    <main :class="ui.content">
      <div :class="[ui.pageContentWide, 'gap-7 pb-10 sm:gap-8 sm:pb-12']">
        <nav
          class="border-stc-border/70 shadow-stc-xs flex w-full gap-1 overflow-x-auto rounded-xl border bg-white/85 p-1"
          aria-label="Halaman transparansi Stecute"
        >
          <RouterLink
            v-for="item in publicNavItems"
            :key="item.id"
            :to="item.path"
            :aria-current="item.id === page.id ? 'page' : undefined"
            :class="[
              'inline-flex min-h-10 flex-1 shrink-0 items-center justify-center rounded-lg px-3 py-2 text-center text-xs font-bold transition-colors sm:flex-none sm:px-4 sm:text-sm',
              item.id === page.id
                ? 'bg-stc-pink shadow-stc-xs text-white'
                : 'text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text',
            ]"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <section class="grid gap-5 py-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div class="max-w-3xl">
            <p :class="[ui.sectionLabel, 'text-stc-pink']">{{ page.eyebrow }}</p>
            <h1
              class="text-stc-text mt-4 max-w-2xl text-4xl leading-[1.08] font-bold tracking-[0] sm:text-5xl"
            >
              {{ page.title }}
            </h1>
            <p class="text-stc-text-soft mt-5 max-w-[68ch] text-base leading-relaxed font-medium">
              {{ page.summary }}
            </p>
          </div>

          <p class="text-stc-text-faint text-xs font-bold lg:pb-1">{{ page.updatedLabel }}</p>
        </section>

        <article>
          <template v-for="section in page.sections" :key="section.id">
            <section
              v-if="section.type === 'faq'"
              :id="section.id"
              class="border-stc-border/80 scroll-mt-6 border-t py-6 sm:py-7"
            >
              <div class="mb-5 max-w-3xl">
                <h2 class="text-stc-text text-xl leading-tight font-bold sm:text-2xl">
                  {{ section.title }}
                </h2>
                <p
                  v-if="section.intro"
                  class="text-stc-text-soft mt-2 text-sm leading-relaxed font-medium sm:text-[0.9375rem]"
                >
                  {{ section.intro }}
                </p>
              </div>

              <div class="border-stc-border/80 divide-stc-border/80 max-w-4xl divide-y border-y">
                <details v-for="item in section.items" :key="item.question" class="group">
                  <summary
                    class="text-stc-text flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold"
                  >
                    <span>{{ item.question }}</span>
                    <span
                      class="text-stc-text-soft group-open:bg-stc-pink flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors group-open:text-white"
                      aria-hidden="true"
                    >
                      <svg
                        class="transition-transform group-open:rotate-45"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <div
                    class="text-stc-text-soft max-w-3xl space-y-3 pb-5 text-sm leading-relaxed font-medium sm:text-[0.9375rem]"
                  >
                    <p v-for="paragraph in item.answer" :key="paragraph">{{ paragraph }}</p>
                  </div>
                </details>
              </div>
            </section>

            <section
              v-else
              :id="section.id"
              class="border-stc-border/80 grid scroll-mt-6 gap-4 border-t py-6 sm:py-7 lg:grid-cols-[minmax(12rem,0.32fr)_minmax(0,0.68fr)] lg:gap-10"
            >
              <h2 class="text-stc-text text-xl leading-tight font-bold sm:text-2xl">
                {{ section.title }}
              </h2>

              <div>
                <div
                  class="text-stc-text-soft max-w-[68ch] space-y-3 text-sm leading-relaxed font-medium sm:text-[0.9375rem]"
                >
                  <p v-for="paragraph in section.body" :key="paragraph">{{ paragraph }}</p>
                </div>

                <ul
                  v-if="section.bullets?.length"
                  class="text-stc-text-soft mt-5 grid max-w-[68ch] gap-2 text-sm leading-relaxed font-semibold sm:grid-cols-2"
                >
                  <li v-for="bullet in section.bullets" :key="bullet" class="flex gap-2.5">
                    <span
                      class="bg-stc-pink mt-[0.55rem] size-1.5 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
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
