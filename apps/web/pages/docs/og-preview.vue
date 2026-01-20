<template>
  <div class="max-w-7xl mx-auto p-8">
    <h1 class="text-4xl font-bold text-white mb-8">OG Image Preview</h1>
    
    <div class="grid md:grid-cols-2 gap-8">
      <div v-for="doc in docs" :key="doc.slug" class="space-y-4">
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-6">
          <h2 class="text-xl font-semibold text-white mb-2">{{ doc.title }}</h2>
          <p class="text-gray-400 text-sm mb-4">{{ doc.description }}</p>
          
          <div class="bg-white rounded-lg p-2 shadow-lg">
            <img 
              :src="getOgImageUrl(doc.title, doc.description)" 
              :alt="`OG image for ${doc.title}`"
              class="w-full rounded"
              @error="handleImageError"
            />
          </div>
          
          <div class="mt-4 p-3 bg-black/40 rounded text-xs font-mono text-gray-400 break-all">
            {{ getOgImageUrl(doc.title, doc.description) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'docs',
});

const docs = [
  {
    slug: 'mcp',
    title: 'MCP Integration',
    description: 'Connect AI assistants (Cursor, Claude Desktop) to your private services.',
  },
  {
    slug: 'AI',
    title: 'Private Connect for AI',
    description: 'Build AI agents that securely access private services, orchestrate multi-machine workflows, and collaborate with each other.',
  },
  {
    slug: 'broker',
    title: 'Agent Permission Broker',
    description: 'Policy-based access control for AI agents with approval workflows.',
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'Learn about Private Connect\'s security architecture and best practices.',
  },
  {
    slug: 'tailscale-and-private-connect',
    title: 'Tailscale & Private Connect',
    description: 'How Private Connect works alongside Tailscale and other VPN solutions.',
  },
  {
    slug: 'ai-teams',
    title: 'AI Teams',
    description: 'Coordinate multiple AI agents across different machines.',
  },
];

const getOgImageUrl = (title: string, description: string) => {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://privateconnect.co';
  return `${baseUrl}/api/og-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
};

const handleImageError = (event: Event) => {
  console.error('Failed to load OG image:', event);
};
</script>
