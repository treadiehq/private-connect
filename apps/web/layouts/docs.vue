<template>
  <div class="min-h-screen bg-black text-gray-100 antialiased">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-500/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
            <span class="font-semibold">Private Connect</span>
          </NuxtLink>

          <!-- Search & Actions -->
          <div class="flex items-center gap-3">
            <!-- GitHub Link -->
            <a
              href="https://github.com/treadiehq/private-connect"
              target="_blank"
              rel="noopener noreferrer"
              class="text-gray-500 hover:text-white transition-colors"
              title="GitHub"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
              </svg>
            </a>
            <!-- Search Button -->
            <button
              @click="openSearch"
              class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 border border-gray-500/10 text-gray-400 hover:text-white hover:bg-gray-500/20 transition-colors text-sm"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span class="text-xs text-gray-500">Ctrl+K</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="flex max-w-7xl mx-auto">
      <!-- Sidebar -->
      <aside
        :class="[
          'fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] overflow-y-auto bg-black border-r border-gray-500/10 w-64 z-40 transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        ]"
        @click.stop
      >
        <nav class="p-4 space-y-1">
          <NuxtLink
            to="/docs"
            class="block px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            :class="isActive('/docs') ? 'bg-gray-500/10 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
            @click="sidebarOpen = false"
          >
            Introduction
          </NuxtLink>

          <div class="pt-2">
            <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guides</div>
            <NuxtLink
              v-for="doc in docs"
              :key="doc.slug"
              :to="`/docs/${doc.slug}`"
              class="block px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
              :class="isActive(`/docs/${doc.slug}`) ? 'bg-gray-500/10 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
              @click="sidebarOpen = false"
            >
              {{ doc.title }}
            </NuxtLink>
          </div>
        </nav>
      </aside>

      <!-- Mobile Sidebar Overlay -->
      <div
        v-if="sidebarOpen"
        @click="sidebarOpen = false"
        class="fixed inset-0 bg-black/50 z-30 lg:hidden"
      ></div>

      <!-- Main Content -->
      <main class="flex-1 min-w-0">
        <!-- Mobile Menu Button -->
        <button
          @click="sidebarOpen = !sidebarOpen"
          class="lg:hidden fixed top-20 left-4 z-50 p-2 rounded-lg bg-gray-500/10 border border-gray-500/10 text-gray-400 hover:text-white"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div class="px-4 sm:px-6 lg:px-8 py-8">
          <slot />
        </div>
      </main>
    </div>

    <!-- Search Modal -->
    <div
      v-if="searchOpen"
      @click.self="searchOpen = false"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-32"
      @keydown.esc="searchOpen = false"
    >
      <div class="w-full max-w-2xl mx-4">
        <div class="bg-gray-900 border border-gray-500/20 rounded-2xl overflow-hidden shadow-2xl">
          <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-500/20 bg-gray-800/50">
            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search documentation..."
              class="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none outline-none border-none focus:ring-0 focus:border-0 focus-visible:outline-0 text-base"
              @keydown.esc="searchOpen = false"
            />
            <kbd class="px-2.5 py-1.5 text-xs font-mono bg-gray-500/20 border border-gray-500/30 rounded-md text-gray-400">Esc</kbd>
          </div>
          <div class="max-h-96 overflow-y-auto">
            <div v-if="searchResults.length === 0 && searchQuery" class="p-12 text-center">
              <div class="text-gray-500 mb-2">No results found</div>
              <div class="text-sm text-gray-600">Try different keywords</div>
            </div>
            <NuxtLink
              v-for="result in searchResults"
              :key="result._id || result._path"
              :to="result._path || `/docs/${result.slug || result._id}`"
              @click="searchOpen = false"
              class="block px-5 py-4 hover:bg-gray-500/10 border-b border-gray-500/10 last:border-0 transition-colors group"
            >
              <div class="font-semibold text-white group-hover:text-blue-300 transition-colors mb-1">{{ result.title || result._path?.split('/').pop() || 'Untitled' }}</div>
              <div class="text-sm text-gray-400 leading-relaxed">{{ result.description || result.excerpt || 'No description' }}</div>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const sidebarOpen = ref(false);
const searchOpen = ref(false);
const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

const docs = [
  { slug: 'mcp', title: 'MCP Integration' },
  { slug: 'AI', title: 'AI Integration' },
  { slug: 'broker', title: 'Permission Broker' },
  { slug: 'security', title: 'Security' },
  { slug: 'tailscale-and-private-connect', title: 'Tailscale & Private Connect' },
  { slug: 'ai-teams', title: 'AI Teams' },
];

const isActive = (path: string) => {
  // Handle exact match and also match with trailing slash
  return route.path === path || route.path === `${path}/`;
};

const openSearch = () => {
  searchOpen.value = true;
  nextTick(() => {
    searchInput.value?.focus();
  });
};

// Search functionality - search through actual content
const allDocs = ref<any[]>([]);
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return [];
  
  const query = searchQuery.value.toLowerCase();
  
  // First, try to match by title/slug
  const titleMatches = allDocs.value.filter((doc: any) => {
    const title = (doc.title || '').toLowerCase();
    const slug = (doc._path || doc._id || '').toLowerCase();
    return title.includes(query) || slug.includes(query);
  });
  
  // Then, try to match by content
  const contentMatches = allDocs.value.filter((doc: any) => {
    // Check if query appears in body text
    const body = doc.body?.children || [];
    const bodyText = extractTextFromBody(body).toLowerCase();
    return bodyText.includes(query);
  });
  
  // Combine and deduplicate
  const combined = [...titleMatches, ...contentMatches];
  const unique = combined.filter((doc: any, index: number, self: any[]) => 
    index === self.findIndex((d: any) => d._id === doc._id || d._path === doc._path)
  );
  
  return unique.slice(0, 10); // Limit to 10 results
});

// Helper to extract text from markdown body
const extractTextFromBody = (children: any[]): string => {
  if (!children || !Array.isArray(children)) return '';
  
  return children.map((child: any) => {
    if (child.type === 'text') return child.value || '';
    if (child.children) return extractTextFromBody(child.children);
    return '';
  }).join(' ');
};

// Load all docs for search
const loadDocs = async () => {
  try {
    if (typeof queryContent !== 'undefined') {
      const docs = await queryContent('docs').find();
      allDocs.value = docs;
    }
  } catch (e) {
    console.error('Error loading docs for search:', e);
  }
};

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  loadDocs();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>
