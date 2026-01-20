<template>
  <div v-if="pending" class="max-w-4xl mx-auto">
    <div class="animate-pulse space-y-4">
      <div class="h-8 bg-gray-500/10 rounded w-3/4"></div>
      <div class="h-4 bg-gray-500/10 rounded w-full"></div>
      <div class="h-4 bg-gray-500/10 rounded w-5/6"></div>
    </div>
  </div>

  <div v-else-if="error" class="max-w-4xl mx-auto">
    <div class="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
      <h2 class="text-xl font-semibold text-red-400 mb-2">Error loading documentation</h2>
      <p class="text-gray-400">{{ error.message }}</p>
    </div>
  </div>

  <div v-else-if="data" class="max-w-7xl mx-auto">
    <div class="flex gap-12">
      <!-- Main Content -->
      <article class="flex-1 min-w-0">
        <!-- Page Header -->
        <header class="mb-12 pb-8 border-b border-gray-500/10">
          <h1 class="text-5xl font-bold text-white mb-4 tracking-tight">{{ data.title || slug }}</h1>
          <p v-if="data.description" class="text-xl text-gray-400 leading-relaxed mb-2">{{ data.description }}</p>
          <p v-if="data.date" class="text-sm text-gray-500">
            Published {{ formatDate(data.date) }}
          </p>
        </header>
        
        <!-- Content -->
        <div class="docs-content-wrapper">
          <ContentRenderer 
            v-if="data" 
            :value="data" 
            class="docs-content"
          />
        </div>
      </article>

      <!-- Table of Contents (Desktop) -->
      <aside class="hidden xl:block w-64 shrink-0">
        <div class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <nav class="text-sm">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">On this page</div>
            <ul v-if="toc.length > 0" class="space-y-2">
              <li v-for="heading in toc" :key="heading.id" :class="[
                'transition-colors',
                heading.depth === 2 ? 'ml-0' : heading.depth === 3 ? 'ml-4' : 'ml-8'
              ]">
                <a
                  :href="`#${heading.id}`"
                  :class="[
                    'block py-1 text-gray-400 hover:text-white transition-colors',
                    'border-l-2 border-transparent hover:border-gray-500/30 pl-3 -ml-0.5'
                  ]"
                  @click.prevent="scrollToHeading(heading.id)"
                >
                  {{ heading.text }}
                </a>
              </li>
            </ul>
            <p v-else class="text-xs text-gray-500 italic">No headings found</p>
          </nav>
        </div>
      </aside>
    </div>
  </div>

  <div v-else class="max-w-4xl mx-auto">
    <div class="p-6 rounded-xl bg-amber-300/10 border border-amber-300/10">
      <h2 class="text-xl font-semibold text-amber-300 mb-2">Content Not Available</h2>
      <p class="text-gray-400 mb-4">
        The documentation content could not be loaded. This might be because:
      </p>
      <ul class="list-disc list-inside text-gray-400 space-y-2 mb-4">
        <li><code class="bg-black/40 px-2 py-1 rounded">@nuxt/content</code> is not installed. Run <code class="bg-black/40 px-2 py-1 rounded">pnpm install</code> in the <code class="bg-black/40 px-2 py-1 rounded">apps/web</code> directory.</li>
        <li>The document file doesn't exist in the <code class="bg-black/40 px-2 py-1 rounded">/docs</code> directory.</li>
        <li>The dev server needs to be restarted after installing dependencies.</li>
      </ul>
      <NuxtLink to="/docs" class="text-amber-300 hover:text-amber-200 underline">
        ← Back to Documentation
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'docs',
});

const route = useRoute();
const slug = route.params.slug as string;

// Extract table of contents from rendered headings
const toc = ref<Array<{ id: string; text: string; depth: number }>>([]);

const updateTOC = () => {
  nextTick(() => {
    const headings = document.querySelectorAll('.docs-content h2, .docs-content h3, .docs-content h4');
    const tocItems: Array<{ id: string; text: string; depth: number }> = [];
    
    headings.forEach((heading) => {
      const text = heading.textContent || '';
      const depth = parseInt(heading.tagName.charAt(1)) || 2;
      const id = heading.id || text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      // Ensure heading has an ID
      if (!heading.id) {
        heading.id = id;
      }
      
      tocItems.push({ id, text, depth });
    });
    
    toc.value = tocItems;
  });
};

const scrollToHeading = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Update URL without scrolling
    window.history.pushState(null, '', `#${id}`);
  }
};

const { data, pending, error } = await useAsyncData(`docs-${slug}`, async () => {
  try {
    // Check if queryContent is available
    if (typeof queryContent === 'undefined') {
      throw new Error('Content module not available. Please install @nuxt/content and restart the dev server.');
    }

    // First, get all docs to understand the structure
    const allDocs = await queryContent('docs').find();
    
    // Log the structure for debugging (only in dev)
    if (process.dev) {
      console.log('All docs structure:', allDocs.map((d: any) => ({
        _id: d._id,
        _path: d._path,
        _source: d._source,
        title: d.title
      })));
    }
    
    // Try to find the doc by matching various fields
    const doc = allDocs.find((d: any) => {
      const id = d._id || '';
      const path = d._path || '';
      const source = d._source || '';
      
      // Extract filename from _id (handles formats like 'docs:docs:AI.md' or 'docs:docs:mcp.md')
      const filenameFromId = id.split(':').pop() || id.split('/').pop() || id;
      const filenameWithoutExt = filenameFromId.replace(/\.md$/, '');
      
      // Normalize for case-insensitive matching
      const slugLower = slug.toLowerCase();
      const filenameLower = filenameWithoutExt.toLowerCase();
      
      // Match by various possible formats
      return (
        // Exact matches
        id === slug ||
        id === `${slug}.md` ||
        filenameWithoutExt === slug ||
        filenameLower === slugLower ||
        // Path matches
        path === `/${slug}` ||
        path === `/${slug}.md` ||
        path.includes(`/${slug}.md`) ||
        path.includes(`/${slug}`) ||
        // Source matches
        source.includes(`/${slug}.md`) ||
        source.includes(`/${slug}`) ||
        // Handle colon-separated IDs (docs:docs:filename.md)
        id.endsWith(`:${slug}`) ||
        id.endsWith(`:${slug}.md`) ||
        id.includes(`:${slug}.md`) ||
        id.includes(`:${slug}`)
      );
    });
    
    if (doc) {
      return doc;
    }
    
    // If not found, log available IDs for debugging
    if (process.dev) {
      console.warn(`Document "${slug}" not found. Available IDs:`, allDocs.map((d: any) => d._id));
    }
    
    return null;
  } catch (e: any) {
    console.error('Error loading doc:', e);
    return null;
  }
}, {
  default: () => null,
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

// Generate OG image URL
const ogImageUrl = computed(() => {
  if (!data.value?.title) return 'https://privateconnect.co/img/privateconnect.png';
  const baseUrl = 'https://privateconnect.co';
  const title = encodeURIComponent(data.value.title);
  const description = encodeURIComponent(data.value.description || '');
  return `${baseUrl}/api/og-image?title=${title}&description=${description}`;
});

// SEO Meta tags
useHead({
  title: computed(() => data.value?.title ? `${data.value.title} - Private Connect` : 'Intro - Private Connect'),
  meta: computed(() => {
    if (!data.value) return [];
    
    const title = data.value.title || 'Documentation';
    const description = data.value.description || 'Learn how to use Private Connect to access private services, integrate with AI tools, and collaborate with your team.';
    const url = `https://privateconnect.co/docs/${slug}`;
    const image = ogImageUrl.value || 'https://privateconnect.co/img/privateconnect.png';
    
    return [
      // Basic SEO
      { name: 'description', content: description },
      { name: 'keywords', content: 'private connect, documentation, AI integration, MCP, service connectivity' },
      { name: 'author', content: 'Private Connect' },
      { name: 'robots', content: 'index, follow' },
      
      // Open Graph
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:site_name', content: 'Private Connect' },
      
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:site', content: '@treadieinc' },
    ];
  }),
  link: computed(() => {
    if (!data.value) return [];
    return [
      { rel: 'canonical', href: `https://privateconnect.co/docs/${slug}` },
    ];
  }),
});

// Style experimental/warning callouts and hide duplicate H1
const styleCallouts = () => {
  nextTick(() => {
    // Hide the first H1 in content if it matches the page title (duplicate title fix)
    if (data.value?.title) {
      const firstH1 = document.querySelector('.docs-content h1:first-of-type');
      if (firstH1) {
        const h1Text = firstH1.textContent?.trim() || '';
        const pageTitle = data.value.title.trim();
        // If they match (case-insensitive), hide the H1 in content
        if (h1Text.toLowerCase() === pageTitle.toLowerCase() || 
            h1Text.toLowerCase().includes(pageTitle.toLowerCase()) ||
            pageTitle.toLowerCase().includes(h1Text.toLowerCase())) {
          firstH1.classList.add('hidden-title');
        }
      }
    }
    
    // Style blockquotes that contain warning/experimental text
    const blockquotes = document.querySelectorAll('.docs-content blockquote');
    blockquotes.forEach((blockquote) => {
      const text = blockquote.textContent || '';
      if (text.includes('⚠️') || text.includes('Experimental') || text.includes('Warning')) {
        blockquote.classList.add('warning-callout');
      }
    });
    
    // Style paragraphs that look like alerts
    const paragraphs = document.querySelectorAll('.docs-content p');
    paragraphs.forEach((p) => {
      const text = p.textContent || '';
      if (text.includes('⚠️') && text.length < 200) {
        p.classList.add('alert-paragraph');
      }
    });
  });
};

// Add IDs to headings and update TOC after content is rendered
watch(() => data.value, () => {
  if (data.value) {
    updateTOC();
    styleCallouts();
  }
}, { immediate: true });

onMounted(() => {
  if (data.value) {
    updateTOC();
    styleCallouts();
  }
  
  // Also update TOC when content changes (e.g., after navigation)
  const observer = new MutationObserver(() => {
    updateTOC();
    styleCallouts();
  });
  
  nextTick(() => {
    const contentWrapper = document.querySelector('.docs-content-wrapper');
    if (contentWrapper) {
      observer.observe(contentWrapper, {
        childList: true,
        subtree: true,
      });
    }
  });
  
  onUnmounted(() => {
    observer.disconnect();
  });
});
</script>

<style scoped>
/* Content wrapper */
.docs-content-wrapper {
  position: relative;
}
</style>

<style>
/* Base typography - needs to be global to style ContentRenderer output */
.docs-content {
  font-size: 1rem;
  line-height: 1.75;
  color: rgb(209 213 219);
  font-family: -apple-system, BlinkMacSystemFont, Inter, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif;
  letter-spacing: -0.01em;
}

/* Headings */
.docs-content h1 {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 700;
  color: white;
  margin-top: 3rem;
  margin-bottom: 1.5rem;
  letter-spacing: -0.03em;
  scroll-margin-top: 4rem;
}

/* Hide first H1 if it's a duplicate of page title */
.docs-content h1:first-of-type.hidden-title {
  display: none !important;
}

.docs-content h2 {
  font-size: 1.75rem;
  line-height: 2.25rem;
  font-weight: 600;
  color: white;
  margin-top: 3rem;
  margin-bottom: 1rem;
  letter-spacing: -0.025em;
  border-bottom: 1px solid rgba(107, 114, 128, 0.15) !important;
  padding-bottom: 0.75rem !important;
  scroll-margin-top: 4rem;
  position: relative;
}

.docs-content h2::before {
  content: '';
  position: absolute;
  left: -1rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: transparent;
  transition: background-color 0.2s;
}

.docs-content h2:target::before {
  background-color: rgba(147, 197, 253, 0.5);
}

.docs-content h3 {
  font-size: 1.375rem;
  line-height: 1.875rem;
  font-weight: 600;
  color: white;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
  scroll-margin-top: 4rem;
}

.docs-content h4 {
  font-size: 1.125rem;
  line-height: 1.625rem;
  font-weight: 600;
  color: white;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
  letter-spacing: -0.015em;
  scroll-margin-top: 4rem;
}

.docs-content h5 {
  font-size: 1rem;
  line-height: 1.5rem;
  font-weight: 600;
  color: white;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.docs-content h6 {
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 600;
  color: rgb(156 163 175);
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

/* Paragraphs */
.docs-content p {
  margin-bottom: 1.5rem;
  color: rgb(209 213 219);
  line-height: 1.75;
  font-size: 1rem;
}

.docs-content p:last-child {
  margin-bottom: 0;
}

/* Links */
.docs-content a {
  color: rgb(147 197 253);
  text-decoration: none;
  text-underline-offset: 3px;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(147, 197, 253, 0.3);
}

.docs-content a:hover {
  color: rgb(191 219 254);
  border-bottom-color: rgb(191 219 254);
  text-decoration: none;
}

/* Lists */
.docs-content ul,
.docs-content ol {
  margin-bottom: 1.5rem;
  margin-left: 1.75rem;
  padding-left: 0;
  list-style-position: outside;
}

.docs-content ul {
  list-style-type: disc;
}

.docs-content ol {
  list-style-type: decimal;
}

.docs-content li {
  color: rgb(209 213 219);
  line-height: 1.75;
  margin-bottom: 0.75rem;
  padding-left: 0.5rem;
}

.docs-content li > p {
  margin-bottom: 0.5rem;
}

.docs-content li > :first-child {
  margin-top: 0;
}

.docs-content li > :last-child {
  margin-bottom: 0;
}

.docs-content ul ul,
.docs-content ol ol,
.docs-content ul ol,
.docs-content ol ul {
  margin-top: 0.5rem;
  margin-bottom: 0;
}

/* Code blocks */
.docs-content code:not(pre code) {
  background-color: rgba(107, 114, 128, 0.2) !important;
  color: rgb(147 197 253) !important;
  padding: 0.1875rem 0.4375rem;
  border-radius: 0.375rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  border: 1px solid rgba(107, 114, 128, 0.25);
  font-weight: 500;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.docs-content pre {
  background-color: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(107, 114, 128, 0.2);
  border-radius: 0.75rem;
  padding: 1.25rem;
  overflow-x: auto;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  line-height: 1.75;
  position: relative;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.docs-content pre::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(107, 114, 128, 0.3), transparent);
}

.docs-content pre code {
  background-color: transparent;
  color: rgb(209 213 219);
  padding: 0;
  border: 0;
  font-size: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* Syntax highlighting for common patterns */
.docs-content pre code .comment,
.docs-content pre code .token.comment {
  color: rgb(107 114 128);
  font-style: italic;
}

.docs-content pre code .string,
.docs-content pre code .token.string {
  color: rgb(34 197 94);
}

.docs-content pre code .keyword,
.docs-content pre code .token.keyword {
  color: rgb(147 197 253);
  font-weight: 500;
}

.docs-content pre code .function,
.docs-content pre code .token.function {
  color: rgb(251 191 36);
}

.docs-content pre code .number,
.docs-content pre code .token.number {
  color: rgb(251 146 60);
}

/* Blockquotes */
.docs-content blockquote {
  border-left: 4px solid rgba(147, 197, 253, 0.4);
  padding-left: 1.25rem;
  font-style: italic;
  color: rgb(156 163 175);
  margin: 2rem 0;
  background-color: rgba(107, 114, 128, 0.08);
  border-radius: 0 0.75rem 0.75rem 0;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

/* Experimental/Warning blockquotes */
.docs-content blockquote.warning-callout {
  border-left-color: rgba(251, 191, 36, 0.6) !important;
  background-color: rgba(251, 191, 36, 0.08) !important;
  color: rgb(209 213 219) !important;
}

/* Alert paragraphs */
.docs-content p.alert-paragraph {
  background-color: rgba(251, 191, 36, 0.1) !important;
  border-left: 4px solid rgba(251, 191, 36, 0.6) !important;
  border-radius: 0.5rem;
  padding: 1rem 1rem 1rem 1.5rem !important;
  margin: 1.5rem 0 !important;
  color: rgb(209 213 219) !important;
}

.docs-content blockquote p {
  margin-bottom: 0;
}

.docs-content blockquote > :first-child {
  margin-top: 0;
}

.docs-content blockquote > :last-child {
  margin-bottom: 0;
}

/* Tables */
.docs-content table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid rgba(107, 114, 128, 0.15);
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.docs-content thead {
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
  background-color: rgba(107, 114, 128, 0.05);
}

.docs-content th {
  background-color: rgba(107, 114, 128, 0.1);
  font-weight: 600;
  color: white;
  padding: 1rem 1.25rem;
  text-align: left;
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
  letter-spacing: 0.025em;
}

.docs-content td {
  border-bottom: 1px solid rgba(107, 114, 128, 0.1);
  padding: 0.875rem 1.25rem;
  color: rgb(209 213 219);
}

.docs-content tbody tr:hover {
  background-color: rgba(107, 114, 128, 0.08);
  transition: background-color 0.15s ease;
}

.docs-content tbody tr:last-child td {
  border-bottom: 0;
}

/* Horizontal rules */
.docs-content hr {
  border: 0;
  border-top: 1px solid rgba(107, 114, 128, 0.15);
  margin: 3.5rem 0;
  position: relative;
}

.docs-content hr::after {
  content: '';
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 1px;
  background: rgba(107, 114, 128, 0.3);
}

/* Images */
.docs-content img {
  border-radius: 0.75rem;
  border: 1px solid rgba(107, 114, 128, 0.15);
  margin: 2rem 0;
  max-width: 100%;
  height: auto;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Strong and emphasis */
.docs-content strong {
  font-weight: 600;
  color: white;
}

.docs-content em {
  font-style: italic;
}

/* Definition lists */
.docs-content dl {
  margin-bottom: 1.5rem;
}

.docs-content dt {
  font-weight: 600;
  color: white;
  margin-bottom: 0.25rem;
}

.docs-content dd {
  margin-left: 1.5rem;
  margin-bottom: 1rem;
  color: rgb(209 213 219);
}

/* Keyboard keys */
.docs-content kbd {
  background-color: rgba(107, 114, 128, 0.2);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  color: rgb(209 213 219);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

/* Admonitions / Callouts (if used) */
.docs-content .admonition,
.docs-content .note,
.docs-content .warning,
.docs-content .tip {
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1.5rem 0;
  border: 1px solid rgba(107, 114, 128, 0.1);
}

.docs-content .admonition-title,
.docs-content .note-title,
.docs-content .warning-title,
.docs-content .tip-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

/* Syntax highlighting improvements */
.docs-content pre[class*="language-"] {
  background-color: rgba(0, 0, 0, 0.6);
}

/* Inline code in headings */
.docs-content h1 code,
.docs-content h2 code,
.docs-content h3 code,
.docs-content h4 code {
  color: inherit;
  background-color: rgba(107, 114, 128, 0.2);
  font-size: 0.9em;
}

/* Nested content */
.docs-content > :first-child {
  margin-top: 0;
}

.docs-content > :last-child {
  margin-bottom: 0;
}

/* Special markdown elements */
.docs-content > hr {
  margin: 3rem 0;
  border-color: rgba(107, 114, 128, 0.1);
}

/* Improve spacing between sections */
.docs-content h2 + p,
.docs-content h3 + p,
.docs-content h4 + p {
  margin-top: 0.5rem;
}

/* Better code block styling */
.docs-content pre {
  position: relative;
}

.docs-content pre::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(107, 114, 128, 0.2), transparent);
}

/* Improve list spacing in nested contexts */
.docs-content p + ul,
.docs-content p + ol {
  margin-top: -0.5rem;
}

/* Better blockquote styling */
.docs-content blockquote p:first-of-type::before {
  content: '';
}

.docs-content blockquote p:last-of-type::after {
  content: '';
}

/* Table improvements */
.docs-content table {
  overflow: hidden;
}

.docs-content th:first-child,
.docs-content td:first-child {
  padding-left: 0;
}

.docs-content th:last-child,
.docs-content td:last-child {
  padding-right: 0;
}

/* Improve code in paragraphs */
.docs-content p code,
.docs-content li code {
  position: relative;
  font-size: 0.9em;
}

/* Better link styling */
.docs-content a[href^="http"]::after {
  content: ' ↗';
  color: rgb(107 114 128);
  font-size: 0.75rem;
  margin-left: 0.25rem;
  display: inline-block;
}

.docs-content a[href^="http"]:hover::after {
  color: rgb(156 163 175);
}
</style>
