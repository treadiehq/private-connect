<template>
  <div class="min-h-screen bg-black">
    <!-- Subtle background gradient -->
    <!-- <div class="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-black to-purple-950/10 pointer-events-none"></div> -->
    
    <!-- Header -->
    <header class="border-b border-white/[0.05] bg-black/80 backdrop-blur-xl sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-6 py-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <NuxtLink to="/" class="flex items-center gap-3 group">
              <div class="relative flex items-center justify-center transition-shadow">
                <!-- <svg class="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg> -->
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4 text-white">
                  <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
                </svg>
              </div>
              <span class="text-gray-500/40">/</span>
              <span v-if="workspace" class="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors">{{ workspace.name }}</span>
            </NuxtLink>
          </div>

          <!-- Navigation with animated indicator -->
          <nav class="hidden md:flex items-center relative">
            <div class="flex items-center gap-1 relative z-10">
              <NuxtLink 
                v-for="item in navItems"
                :key="item.path"
                :to="item.path" 
                :class="[
                  'relative px-3 py-1 text-xs text-center border border-transparent rounded-full font-medium transition-colors duration-200',
                  isActive(item.path) ? 'text-white bg-gray-500/20 !border-gray-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-500/15 border-transparent'
                ]"
              >
                {{ item.label }}
              </NuxtLink>
            </div>
            
            <!-- Sliding indicator pill -->
            <!-- <div 
              class="absolute h-7 bg-gray-500/10 text-center border border-gray-500/10 rounded-full transition-all duration-300 ease-out"
              :style="indicatorStyle"
            ></div> -->
          </nav>
          
          <div class="flex items-center gap-4">
            <!-- Live indicator -->
            <!-- <LiveIndicator :connected="isSocketConnected" /> -->
            
            <!-- Workspace Header -->
            <WorkspaceHeader />
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="relative max-w-7xl mx-auto px-6 py-8">
      <slot />
    </main>
    
    <!-- Toast Container -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { workspace } = useAuth();
const { getSocket } = useSocket();

const navItems = [
  { path: '/', label: 'Services' },
  { path: '/agents', label: 'Agents' },
];

const isActive = (path: string) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};

const activeIndex = computed(() => {
  const idx = navItems.findIndex(item => isActive(item.path));
  return idx >= 0 ? idx : 0;
});

const indicatorStyle = computed(() => {
  const width = 80; // approximate width per nav item
  const left = 4 + activeIndex.value * (width + 4);
  return {
    width: `${width}px`,
    left: `${left}px`,
    top: '50%',
    transform: 'translateY(-50%)',
  };
});

const isSocketConnected = ref(false);

onMounted(() => {
  const socket = getSocket();
  if (socket) {
    isSocketConnected.value = socket.connected;
    socket.on('connect', () => isSocketConnected.value = true);
    socket.on('disconnect', () => isSocketConnected.value = false);
  }
});
</script>
