<template>
  <div class="flex items-center gap-3">
    <!-- Authenticated user -->
    <template v-if="isAuthenticated && workspace">
      <div class="flex items-center gap-3">
        <!-- Plan badge -->
        <!-- <span 
          :class="[
            'px-2 py-0.5 text-[10px] font-medium rounded border border-gray-500/10',
            (workspaceData?.workspace?.plan || 'FREE') === 'PRO' 
              ? 'bg-gray-500/20 text-gray-400' 
              : 'bg-gray-500/20 text-gray-400'
          ]"
        >
          {{ workspaceData?.workspace?.plan || 'FREE' }}
        </span>
         -->
        <!-- Upgrade button -->
        <!-- <button
          v-if="(workspaceData?.workspace?.plan || 'FREE') === 'FREE'"
          @click="handleUpgrade"
          class="px-2 py-1 text-[10px] font-medium bg-blue-300 hover:bg-blue-400 text-black rounded transition-colors"
        >
          Upgrade
        </button> -->

        <!-- Avatar dropdown -->
        <div class="relative">
          <button
            @click="showDropdown = !showDropdown"
            class="w-6 h-6 rounded-full bg-amber-300/30 border border-amber-300/10 flex items-center justify-center text-amber-300 font-medium text-[10px] hover:bg-amber-300/40 transition-colors"
          >
            {{ userInitial }}
          </button>
          
          <!-- Dropdown menu -->
          <div 
            v-if="showDropdown"
            class="absolute right-0 mt-2 w-56 bg-black border border-gray-500/20 rounded-lg shadow-xl z-50 py-1"
          >
            <!-- Email -->
            <div class="px-4 py-3 border-b border-gray-500/20">
              <p class="text-xs text-gray-500">Signed in as</p>
              <p class="text-sm font-medium truncate">{{ user?.email }}</p>
            </div>
            
            <!-- API Keys -->
            <NuxtLink
              to="/settings/api-keys"
              @click="showDropdown = false"
              class="w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-500/10 transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              API Keys
            </NuxtLink>

            <!-- Log out -->
        <button
              @click="handleLogout"
              class="w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-500/10 transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
              Log out
        </button>
          </div>
        </div>
      </div>
    </template>
    
    <!-- Not authenticated -->
    <!-- <template v-else-if="!isLoading">
      <NuxtLink
        to="/register"
        class="flex items-center gap-2 px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Get Started
      </NuxtLink>
    </template> -->
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceUsage } from '~/types';

const router = useRouter();
const { user, workspace, isAuthenticated, isLoading, logout, fetchCurrentUser } = useAuth();
const { fetchWorkspace, upgradeWorkspace } = useApi();

const workspaceData = ref<WorkspaceUsage | null>(null);
const showDropdown = ref(false);

const userInitial = computed(() => {
  if (!user.value?.email) return '?';
  return user.value.email[0].toUpperCase();
});

onMounted(async () => {
  // Fetch current user on mount
  await fetchCurrentUser();
  
  // If authenticated, also fetch workspace details
  if (isAuthenticated.value) {
    try {
      workspaceData.value = await fetchWorkspace();
    } catch (e) {
      // Ignore errors
    }
  }

  // Close dropdown on click outside
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.relative')) {
    showDropdown.value = false;
  }
};

const handleUpgrade = async () => {
  try {
    await upgradeWorkspace();
    workspaceData.value = await fetchWorkspace();
  } catch (error) {
    console.error('Upgrade failed:', error);
  }
};

const handleLogout = async () => {
  showDropdown.value = false;
  await logout();
  router.push('/login');
};
</script>
