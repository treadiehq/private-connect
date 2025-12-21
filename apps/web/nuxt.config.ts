import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: [],
  
  css: ['~/assets/css/main.css'],
  
  ssr: false,
  
  vite: {
    plugins: [tailwindcss()],
    server: {
      hmr: {
        overlay: false,
      },
    },
  },
  
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001',
    },
  },

  app: {
    layoutTransition: false,
    pageTransition: false,
    head: {
      title: 'Private Connect',
      meta: [
        { name: 'description', content: 'Secure tunneling for internal services' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
      script: [
        { src: 'https://cdn.seline.com/seline.js', async: true, 'data-token': 'd5fd31a3538303d' },
      ],
    },
  },

  compatibilityDate: '2024-01-01',
});
