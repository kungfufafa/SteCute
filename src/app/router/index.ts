import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/features/landing/LandingView.vue'),
    },
    {
      path: '/camera',
      name: 'camera',
      component: () => import('@/features/camera/CameraView.vue'),
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('@/features/upload/UploadView.vue'),
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/features/session-config/SessionConfigView.vue'),
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
    },
    {
      path: '/render',
      name: 'render',
      component: () => import('@/features/renderer/RendererView.vue'),
    },
    {
      path: '/output',
      name: 'output',
      component: () => import('@/features/output/OutputView.vue'),
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: () => import('@/features/gallery/GalleryView.vue'),
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
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'terms' },
    },
    {
      path: '/faq',
      name: 'faq',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'faq' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/features/public-info/PublicInfoView.vue'),
      props: { pageId: 'about' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/',
    },
  ],
})

export default router
