export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
  },
  
  ssr: false,
  
  // Disable Vite overlay
  vite: {
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
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap' },
      ],
    },
  },

  compatibilityDate: '2024-01-01',
});
