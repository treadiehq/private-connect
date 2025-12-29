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
        { name: 'description', content: 'Securely reach databases, APIs, and services behind firewalls. No VPN setup, no firewall rules, no port forwarding.' },
        { property: 'og:image', content: 'https://privateconnect.co/img/privateconnect.png' },
        { property: 'og:title', content: 'Private Connect' },
        { property: 'og:type', content: 'website' },
        { property: 'og:description', content: 'Securely reach databases, APIs, and services behind firewalls. No VPN setup, no firewall rules, no port forwarding.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Private Connect' },
        { name: 'twitter:description', content: 'Securely reach databases, APIs, and services behind firewalls. No VPN setup, no firewall rules, no port forwarding.' },
        { name: 'twitter:image', content: 'https://privateconnect.co/img/privateconnect.png' },
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
