import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: [],

  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('el-'),
    },
  },
  
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
      // apiBase uses same value as apiUrl for consistency
      apiBase: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001',
    },
  },

  app: {
    layoutTransition: false,
    pageTransition: false,
    head: {
      title: 'Private Connect - Access Private Services Without VPN or Firewall Rules',
      meta: [
        { name: 'description', content: 'Access your private services and local database from Sprites, exe.dev, Cursor or anywhere. No VPN, no open ports.' },
        { name: 'keywords', content: 'access local database from Sprites, exe.dev database access, Cursor connect to local Postgres, private connect, vpn alternative, ngrok alternative, tailscale alternative, secure tunneling, service connectivity, private services, database access, firewall bypass, ssh tunnel alternative, service mesh, zero trust networking' },
        { name: 'author', content: 'Private Connect' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
        { property: 'og:url', content: 'https://privateconnect.co' },
        { property: 'og:image', content: 'https://privateconnect.co/img/privateconnect.png' },
        { property: 'og:title', content: 'Private Connect - Access Private Services Without VPN' },
        { property: 'og:type', content: 'website' },
        { property: 'og:description', content: 'Access your private services and local database from Sprites, exe.dev, Cursor or anywhere. No VPN, no open ports.' },
        { property: 'og:site_name', content: 'Private Connect' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Private Connect - Access Private Services Without VPN' },
        { name: 'twitter:description', content: 'Access your private services and local database from Sprites, exe.dev, Cursor or anywhere. No VPN, no open ports.' },
        { name: 'twitter:image', content: 'https://privateconnect.co/img/privateconnect.png' },
        { name: 'twitter:site', content: '@treadieinc' },
        { name: 'application-name', content: 'Private Connect' },
        { name: 'apple-mobile-web-app-title', content: 'Private Connect' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: 'https://privateconnect.co' },
      ],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            'name': 'Private Connect',
            'applicationCategory': 'DeveloperApplication',
            'operatingSystem': 'Linux, macOS, Windows',
            'offers': {
              '@type': 'Offer',
              'price': '0',
              'priceCurrency': 'USD'
            },
            'description': 'Access your private services and local database from Sprites, exe.dev, Cursor or anywhere. No VPN, no open ports.',
            'url': 'https://privateconnect.co',
            'downloadUrl': 'https://privateconnect.co/install.sh',
            'softwareVersion': '0.7.5',
            'releaseNotes': 'https://github.com/treadiehq/private-connect/releases',
            'author': {
              '@type': 'Organization',
              'name': 'Private Connect'
            },
            'aggregateRating': {
              '@type': 'AggregateRating',
              'ratingValue': '5',
              'ratingCount': '1'
            },
            'featureList': [
              'Access private services by name',
              'No VPN configuration required',
              'No firewall rules needed',
              'Team sharing and collaboration',
              'Open source and self-hostable',
              'Works on top of existing networks',
              'End-to-end encryption',
              'Local DNS integration'
            ],
            'screenshot': 'https://privateconnect.co/img/privateconnect.png',
            'codeRepository': 'https://github.com/treadiehq/private-connect',
            'license': 'https://github.com/treadiehq/private-connect/blob/main/LICENSE'
          })
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': 'Private Connect',
            'url': 'https://privateconnect.co',
            'description': 'Access your private services and local database from Sprites, exe.dev, Cursor or anywhere. No VPN, no open ports.',
          })
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            'name': 'Private Connect',
            'url': 'https://privateconnect.co',
            'logo': 'https://privateconnect.co/img/privateconnect.png',
            'sameAs': [
              'https://github.com/treadiehq/private-connect'
            ]
          })
        }
      ],
    },
  },

  compatibilityDate: '2024-01-01',
});
