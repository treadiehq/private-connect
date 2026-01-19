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
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
    },
  },

  app: {
    layoutTransition: false,
    pageTransition: false,
    head: {
      title: 'Private Connect - Access Private Services Without VPN or Firewall Rules',
      meta: [
        { name: 'description', content: 'Access private services by name from anywhere. No VPN setup, no firewall rules, no port forwarding. Open source alternative to ngrok and Tailscale for service-level connectivity.' },
        { name: 'keywords', content: 'private connect, vpn alternative, ngrok alternative, tailscale alternative, secure tunneling, service connectivity, private services, database access, firewall bypass, ssh tunnel alternative, service mesh, zero trust networking' },
        { name: 'author', content: 'Private Connect' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
        { property: 'og:url', content: 'https://privateconnect.co' },
        { property: 'og:image', content: 'https://privateconnect.co/img/privateconnect.png' },
        { property: 'og:title', content: 'Private Connect - Access Private Services Without VPN' },
        { property: 'og:type', content: 'website' },
        { property: 'og:description', content: 'Access private services by name from anywhere. No VPN setup, no firewall rules. Open source alternative to ngrok and Tailscale.' },
        { property: 'og:site_name', content: 'Private Connect' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Private Connect - Access Private Services Without VPN' },
        { name: 'twitter:description', content: 'Access private services by name from anywhere. No VPN setup, no firewall rules. Open source alternative to ngrok and Tailscale.' },
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
        { src: 'https://cdn.seline.com/seline.js', async: true, 'data-token': 'd5fd31a3538303d' },
        {
          type: 'application/ld+json',
          children: JSON.stringify({
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
            'description': 'Access private services by name from anywhere. No VPN setup, no firewall rules, no port forwarding. Open source alternative to ngrok and Tailscale for service-level connectivity.',
            'url': 'https://privateconnect.co',
            'downloadUrl': 'https://privateconnect.co/install.sh',
            'softwareVersion': '0.4.3',
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
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': 'Private Connect',
            'url': 'https://privateconnect.co',
            'description': 'Access private services by name from anywhere. No VPN setup, no firewall rules.',
            'potentialAction': {
              '@type': 'SearchAction',
              'target': 'https://privateconnect.co/search?q={search_term_string}',
              'query-input': 'required name=search_term_string'
            }
          })
        },
        {
          type: 'application/ld+json',
          children: JSON.stringify({
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
