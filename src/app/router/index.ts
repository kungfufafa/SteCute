import { createRouter, createWebHistory } from 'vue-router'
import { applySeo, getAppSeo, getIndexableSeo } from '@/app/seo'
import type { SeoRoute } from '@/app/seo'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/features/landing/LandingView.vue'),
      meta: { seo: getIndexableSeo('landing') },
    },
    {
      path: '/camera',
      name: 'camera',
      component: () => import('@/features/camera/CameraView.vue'),
      meta: { seo: getAppSeo('camera') },
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/features/upload/UploadView.vue'),
      meta: { seo: getAppSeo('upload') },
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/features/session-config/SessionConfigView.vue'),
      meta: { seo: getAppSeo('config') },
    },
    {
      path: '/capture',
      name: 'capture-legacy',
      redirect: '/camera',
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('@/features/review/ReviewView.vue'),
      meta: { seo: getAppSeo('review') },
    },
    {
      path: '/render',
      name: 'render',
      component: () => import('@/features/renderer/RendererView.vue'),
      meta: { seo: getAppSeo('render') },
    },
    {
      path: '/output',
      name: 'output',
      component: () => import('@/features/output/OutputView.vue'),
      meta: { seo: getAppSeo('output') },
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: () => import('@/features/gallery/GalleryView.vue'),
      meta: { seo: getAppSeo('gallery') },
    },
    {
      path: '/privacyscreen',
      name: 'privacy-screen',
      redirect: '/privacy',
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'privacy' },
      meta: { seo: getIndexableSeo('privacy') },
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'terms' },
      meta: { seo: getIndexableSeo('terms') },
    },
    {
      path: '/faq',
      name: 'faq',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'faq' },
      meta: { seo: getIndexableSeo('faq') },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'about' },
      meta: { seo: getIndexableSeo('about') },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  applySeo(to.meta.seo as SeoRoute | undefined, to.path)
})

export default router
