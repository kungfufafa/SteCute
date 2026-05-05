import { createRouter, createWebHistory } from 'vue-router'
import { applySeo, getAppSeo, getIndexableSeo } from '@/app/seo'
import type { SeoRoute } from '@/app/seo'
import LandingView from '@/features/landing/LandingView.vue'
import CameraView from '@/features/camera/CameraView.vue'
import UploadView from '@/features/upload/UploadView.vue'
import SessionConfigView from '@/features/session-config/SessionConfigView.vue'
import ReviewView from '@/features/review/ReviewView.vue'
import RendererView from '@/features/renderer/RendererView.vue'
import OutputView from '@/features/output/OutputView.vue'
import GalleryView from '@/features/gallery/GalleryView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingView,
      meta: { seo: getIndexableSeo('landing') },
    },
    {
      path: '/camera',
      name: 'camera',
      component: CameraView,
      meta: { seo: getAppSeo('camera') },
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
      meta: { seo: getAppSeo('upload') },
    },
    {
      path: '/config',
      name: 'config',
      component: SessionConfigView,
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
      component: ReviewView,
      meta: { seo: getAppSeo('review') },
    },
    {
      path: '/render',
      name: 'render',
      component: RendererView,
      meta: { seo: getAppSeo('render') },
    },
    {
      path: '/output',
      name: 'output',
      component: OutputView,
      meta: { seo: getAppSeo('output') },
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: GalleryView,
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
