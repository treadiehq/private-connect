<template>
  <div v-if="pending" class="max-w-4xl mx-auto">
    <div class="animate-pulse space-y-4">
      <div class="h-8 bg-gray-500/10 rounded w-3/4"></div>
      <div class="h-4 bg-gray-500/10 rounded w-full"></div>
    </div>
  </div>

  <div v-else-if="error" class="max-w-4xl mx-auto">
    <div class="p-6 rounded-xl bg-red-400/10 border border-red-500/10">
      <h2 class="text-xl font-semibold text-red-400 mb-2">Error loading documentation</h2>
      <p class="text-gray-400">{{ error.message }}</p>
    </div>
  </div>

  <div v-else-if="data" class="max-w-4xl mx-auto">
    <!-- Page Header -->
    <header class="mb-12 pb-8 border-b border-gray-500/10">
      <h1 class="text-5xl font-bold text-white mb-4 tracking-tight">{{ data.title || 'Documentation' }}</h1>
      <p v-if="data.description" class="text-xl text-gray-400 leading-relaxed mb-2">{{ data.description }}</p>
      <p v-if="data.date" class="text-sm text-gray-500">
        Published {{ formatDate(data.date) }}
      </p>
    </header>

    <!-- Markdown Content -->
    <div class="docs-content-wrapper mb-12">
      <ContentRenderer 
        v-if="data" 
        :value="data" 
        class="docs-content"
      />
    </div>

    <!-- Documentation Cards -->
    <div>
      <h2 class="text-2xl font-semibold text-white mb-6">Guides</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <NuxtLink
          v-for="doc in allDocs"
          :key="doc.slug"
          :to="`/docs/${doc.slug}`"
          class="group block p-6 rounded-xl bg-gray-500/5 border border-gray-500/10 hover:bg-gray-500/10 hover:border-gray-500/20 transition-all duration-200"
        >
          <h3 class="text-lg font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">{{ doc.title }}</h3>
          <p class="text-gray-400 text-sm leading-relaxed">{{ doc.description }}</p>
          <div class="mt-3 flex items-center text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
            <span>Read more</span>
            <svg class="w-3 h-3 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'docs',
});

// Load index.md content
const { data, pending, error } = await useAsyncData('docs-index', async () => {
  try {
    if (typeof queryContent === 'undefined') {
      throw new Error('Content module not available.');
    }

    // Try to find index.md
    const allDocs = await queryContent('docs').find();
    const indexDoc = allDocs.find((d: any) => {
      const id = d._id || '';
      const path = d._path || '';
      const filenameFromId = id.split(':').pop() || id.split('/').pop() || id;
      const filenameWithoutExt = filenameFromId.replace(/\.md$/, '');
      return filenameWithoutExt.toLowerCase() === 'index' || 
             path === '/' || 
             path === '/index' ||
             path === '/index.md';
    });

    return indexDoc || null;
  } catch (e: any) {
    console.error('Error loading index doc:', e);
    return null;
  }
}, {
  default: () => null,
});

// Load all docs for the guides section
const allDocs = ref<Array<{ slug: string; title: string; description: string }>>([]);

onMounted(async () => {
  try {
    if (typeof queryContent !== 'undefined') {
      const docs = await queryContent('docs').find();
      // Filter out index.md and map to the format we need
      allDocs.value = docs
        .filter((d: any) => {
          const id = d._id || '';
          const filenameFromId = id.split(':').pop() || id.split('/').pop() || id;
          const filenameWithoutExt = filenameFromId.replace(/\.md$/, '').toLowerCase();
          return filenameWithoutExt !== 'index';
        })
        .map((d: any) => {
          const id = d._id || '';
          const filenameFromId = id.split(':').pop() || id.split('/').pop() || id;
          const filenameWithoutExt = filenameFromId.replace(/\.md$/, '');
          return {
            slug: filenameWithoutExt,
            title: d.title || filenameWithoutExt,
            description: d.description || '',
          };
        });
    }
  } catch (e) {
    console.error('Error loading docs:', e);
  }

  // Add copy-to-clipboard buttons to code blocks
  nextTick(() => {
    addCopyButtons();
  });
});

// Format date for display
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

// Add copy buttons to code blocks
const addCopyButtons = () => {
  nextTick(() => {
    const codeBlocks = document.querySelectorAll('.docs-content pre');
    codeBlocks.forEach((pre) => {
      // Skip if already has copy button
      if (pre.querySelector('.copy-code-btn')) return;

      const code = pre.querySelector('code');
      if (!code) return;

      const button = document.createElement('button');
      button.className = 'copy-code-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 hover:text-white';
      button.title = 'Copy';
      button.innerHTML = `
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      `;
      
      button.addEventListener('click', async () => {
        const text = code.textContent || '';
        try {
          await navigator.clipboard.writeText(text);
          button.innerHTML = `
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          `;
          setTimeout(() => {
            button.innerHTML = `
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            `;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });

      // Make pre relative and add group class
      (pre as HTMLElement).style.position = 'relative';
      pre.classList.add('group');
      pre.appendChild(button);
    });
  });
};

// Watch for content changes
watch(() => data.value, () => {
  if (data.value) {
    addCopyButtons();
  }
}, { immediate: true });

// SEO Meta tags
const ogImageUrl = computed(() => {
  if (!data.value?.title) return 'https://privateconnect.co/img/privateconnect.png';
  const baseUrl = 'https://privateconnect.co';
  const title = encodeURIComponent(data.value.title);
  const description = encodeURIComponent(data.value.description || '');
  return `${baseUrl}/api/og-image?title=${title}&description=${description}`;
});

useHead({
  title: computed(() => data.value?.title ? `${data.value.title} - Private Connect` : 'Documentation - Private Connect'),
  meta: computed(() => {
    if (!data.value) return [];
    
    const title = data.value.title || 'Documentation';
    const description = data.value.description || 'Learn how to use Private Connect to access private services, integrate with AI tools, and collaborate with your team.';
    const url = 'https://privateconnect.co/docs';
    const image = ogImageUrl.value || 'https://privateconnect.co/img/privateconnect.png';
    
    return [
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
    ];
  }),
});
</script>

<style scoped>
.docs-content-wrapper {
  position: relative;
}
</style>

<style>
/* Reuse the same styles from [slug].vue */
.docs-content {
  font-size: 1rem;
  line-height: 1.75;
  color: rgb(209 213 219);
  font-family: -apple-system, BlinkMacSystemFont, Inter, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif;
  letter-spacing: -0.01em;
}

.docs-content h1 {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 700;
  color: white;
  margin-top: 3rem;
  margin-bottom: 1.5rem;
  letter-spacing: -0.03em;
}

.docs-content h1:first-of-type {
  display: none; /* Hide H1 since we show it in header */
}

.docs-content h2 {
  font-size: 1.75rem;
  line-height: 2.25rem;
  font-weight: 600;
  color: white;
  margin-top: 3rem;
  margin-bottom: 1rem;
  letter-spacing: -0.025em;
  border-bottom: 1px solid rgba(107, 114, 128, 0.15);
  padding-bottom: 0.75rem;
}

.docs-content h3 {
  font-size: 1.375rem;
  line-height: 1.875rem;
  font-weight: 600;
  color: white;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}

.docs-content p {
  margin-bottom: 1.5rem;
  color: rgb(209 213 219);
  line-height: 1.75;
}

.docs-content pre {
  background-color: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(107, 114, 128, 0.2);
  border-radius: 0.75rem;
  padding: 1.25rem;
  overflow-x: auto;
  margin-bottom: 1.5rem;
  position: relative;
}

.docs-content code:not(pre code) {
  background-color: rgba(107, 114, 128, 0.2);
  color: rgb(147 197 253);
  padding: 0.1875rem 0.4375rem;
  border-radius: 0.375rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.docs-content pre code {
  background-color: transparent;
  color: rgb(209 213 219);
  padding: 0;
  border: 0;
}

.docs-content a {
  color: rgb(147 197 253);
  text-decoration: none;
  border-bottom: 1px solid rgba(147, 197, 253, 0.3);
  transition: all 0.2s ease;
}

.docs-content a:hover {
  color: rgb(191 219 254);
  border-bottom-color: rgb(191 219 254);
}
</style>
