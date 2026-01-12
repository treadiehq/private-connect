<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="mb-10 flex items-start justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Admin</h1>
        <p class="text-sm text-gray-400 mt-1">Manage all users, workspaces, and plans</p>
      </div>
      <button 
        @click="refreshData" 
        :disabled="loading"
        class="inline-flex items-center gap-2 px-3 py-2 bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 text-sm text-gray-200 rounded-lg transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
          class="size-4" :class="loading ? 'animate-spin' : ''">
          <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />
        </svg>
        Refresh
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="animate-spin w-8 h-8 border-2 border-blue-300 border-t-transparent rounded-full"></div>
    </div>

    <template v-else>
      <!-- Stats Cards -->
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <!-- Users & Workspaces -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 text-blue-300">
                <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
              </svg>
            </div>
            <div>
              <div class="text-2xl font-bold text-white">{{ stats?.users || 0 }}</div>
              <div class="text-xs text-gray-500">Users</div>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm pt-2 border-t border-gray-500/10">
            <div>
              <span class="text-white font-medium">{{ stats?.workspaces || 0 }}</span>
              <span class="text-gray-500 ml-1">workspaces</span>
            </div>
            <div>
              <span class="text-emerald-300 font-medium">{{ stats?.proWorkspaces || 0 }}</span>
              <span class="text-gray-500 ml-1">PRO</span>
            </div>
          </div>
        </div>

        <!-- Agents -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 text-blue-300">
                <path d="M14 6H6v8h8V6Z" />
                <path fill-rule="evenodd" d="M9.25 3V1.75a.75.75 0 0 1 1.5 0V3h1.5V1.75a.75.75 0 0 1 1.5 0V3h.5A2.75 2.75 0 0 1 17 5.75v.5h1.25a.75.75 0 0 1 0 1.5H17v1.5h1.25a.75.75 0 0 1 0 1.5H17v1.5h1.25a.75.75 0 0 1 0 1.5H17v.5A2.75 2.75 0 0 1 14.25 17h-.5v1.25a.75.75 0 0 1-1.5 0V17h-1.5v1.25a.75.75 0 0 1-1.5 0V17h-1.5v1.25a.75.75 0 0 1-1.5 0V17h-.5A2.75 2.75 0 0 1 3 14.25v-.5H1.75a.75.75 0 0 1 0-1.5H3v-1.5H1.75a.75.75 0 0 1 0-1.5H3v-1.5H1.75a.75.75 0 0 1 0-1.5H3v-.5A2.75 2.75 0 0 1 5.75 3h.5V1.75a.75.75 0 0 1 1.5 0V3h1.5ZM4.5 5.75c0-.69.56-1.25 1.25-1.25h8.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-8.5Z" clip-rule="evenodd" />
              </svg>
            </div>
            <div>
              <div class="text-2xl font-bold text-white">{{ stats?.agents || 0 }}</div>
              <div class="text-xs text-gray-500">Agents</div>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm pt-2 border-t border-gray-500/10">
            <span class="w-2 h-2 rounded-full bg-emerald-300"></span>
            <span class="text-white font-medium">{{ stats?.onlineAgents || 0 }}</span>
            <span class="text-gray-500">online now</span>
          </div>
        </div>

        <!-- Services -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-blue-300/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 text-blue-300">
                <path d="M4.632 3.533A2 2 0 0 1 6.577 2h6.846a2 2 0 0 1 1.945 1.533l1.976 8.234A3.489 3.489 0 0 0 16 11.5H4c-.476 0-.93.095-1.344.267l1.976-8.234Z" />
                <path fill-rule="evenodd" d="M4 13a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4H4Zm11.24 2a.75.75 0 0 1 .75-.75H16a.75.75 0 0 1 0 1.5h-.01a.75.75 0 0 1-.75-.75Zm-2.25-.75a.75.75 0 0 0 0 1.5H13a.75.75 0 0 0 0-1.5h-.01Z" clip-rule="evenodd" />
              </svg>
            </div>
            <div>
              <div class="text-2xl font-bold text-white">{{ stats?.services || 0 }}</div>
              <div class="text-xs text-gray-500">Services</div>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm pt-2 border-t border-gray-500/10">
            <span class="text-gray-500">Exposed endpoints across all agents</span>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-500/10 mb-6">
        <div class="flex gap-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'relative px-3 py-2 text-sm font-medium transition-colors rounded-t-lg',
              activeTab === tab.id ? 'text-white bg-gray-500/10' : 'text-gray-500 hover:text-gray-300'
            ]"
          >
            {{ tab.label }}
            <span v-if="tab.count" class="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-500/20">{{ tab.count }}</span>
          </button>
        </div>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="space-y-4">
        <!-- Search -->
        <div class="flex items-center gap-4 mb-4">
          <div class="flex-1 relative">
            <input 
              v-model="userSearch"
              type="text"
              placeholder="Search users by email..."
              class="w-full bg-gray-500/10 border border-gray-500/10 rounded-lg px-4 py-3 pl-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all"
            >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
              class="size-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>

        <!-- Users Table -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-500/10">
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Workspaces</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th class="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-500/10">
              <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-500/5 transition-colors">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-300/10 flex items-center justify-center text-sm font-medium text-blue-300">
                      {{ user.email.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="text-sm text-white font-medium flex items-center gap-2">
                        {{ user.email }}
                        <span v-if="user.isAdmin" class="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-blue-300/20 text-blue-300 rounded">Admin</span>
                      </div>
                      <div class="text-xs text-gray-500">{{ user.id.slice(0, 8) }}...</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span 
                      v-for="ws in user.workspaces" 
                      :key="ws.id"
                      class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
                      :class="ws.plan === 'PRO' ? 'bg-emerald-300/10 text-emerald-300' : 'bg-gray-500/20 text-gray-400'"
                    >
                      {{ ws.name }}
                      <span class="text-[10px] opacity-70">({{ ws.plan }})</span>
                    </span>
                    <span v-if="user.workspaces.length === 0" class="text-xs text-gray-600">No workspaces</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span 
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full"
                    :class="user.emailVerified ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="user.emailVerified ? 'bg-emerald-300' : 'bg-amber-300'"></span>
                    {{ user.emailVerified ? 'Verified' : 'Unverified' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-400">
                  {{ formatDate(user.createdAt) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <button 
                    v-if="user.email !== currentUser?.email"
                    @click="confirmDeleteUser(user)"
                    class="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete user"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
                      <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <span v-else class="text-xs text-gray-600">You</span>
                </td>
              </tr>
              <tr v-if="filteredUsers.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-gray-500 text-sm">
                  No users found
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Workspaces Tab -->
      <div v-if="activeTab === 'workspaces'" class="space-y-4">
        <!-- Search -->
        <div class="flex items-center gap-4 mb-4">
          <div class="flex-1 relative">
            <input 
              v-model="workspaceSearch"
              type="text"
              placeholder="Search workspaces..."
              class="w-full bg-gray-500/10 border border-gray-500/10 rounded-lg px-4 py-3 pl-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all"
            >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
              class="size-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
            </svg>
          </div>
          <select 
            v-model="planFilter"
            class="bg-gray-500/10 border border-gray-500/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all"
          >
            <option value="all">All Plans</option>
            <option value="FREE">Free</option>
            <option value="PRO">PRO</option>
          </select>
        </div>

        <!-- Workspaces Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="ws in filteredWorkspaces" 
            :key="ws.id"
            class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 hover:border-gray-500/20 transition-colors"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-white font-medium">{{ ws.name }}</h3>
                  <span 
                    class="px-2 py-0.5 text-[10px] font-semibold uppercase rounded"
                    :class="ws.plan === 'PRO' ? 'bg-emerald-300/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'"
                  >
                    {{ ws.plan }}
                  </span>
                </div>
                <div class="text-xs text-gray-500">{{ ws.owner.email }}</div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-4">
              <div class="text-center">
                <div class="text-lg font-bold text-white">{{ ws.agentCount }}</div>
                <div class="text-xs text-gray-500">Agents</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-white">{{ ws.serviceCount }}</div>
                <div class="text-xs text-gray-500">Services</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-white">{{ ws.apiKeyCount }}</div>
                <div class="text-xs text-gray-500">API Keys</div>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-gray-500/10">
              <div class="text-xs text-gray-500">
                Created {{ formatDate(ws.createdAt) }}
              </div>
              <div class="flex items-center gap-2">
                <button 
                  v-if="ws.plan === 'FREE'"
                  @click="upgradeWorkspace(ws.id)"
                  :disabled="actionLoading === ws.id"
                  class="px-3 py-1.5 text-xs font-medium bg-blue-300 text-black hover:bg-blue-400 rounded-lg transition-colors disabled:opacity-50"
                >
                  {{ actionLoading === ws.id ? 'Upgrading...' : 'Upgrade to PRO' }}
                </button>
                <button 
                  v-else
                  @click="downgradeWorkspace(ws.id)"
                  :disabled="actionLoading === ws.id"
                  class="px-3 py-1.5 text-xs font-medium bg-gray-500/10 border border-gray-500/10 text-gray-400 hover:bg-gray-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {{ actionLoading === ws.id ? 'Downgrading...' : 'Downgrade' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="filteredWorkspaces.length === 0" class="col-span-full text-center py-12 text-gray-500">
            No workspaces found
          </div>
        </div>
      </div>
    </template>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="deleteModal.show" 
          class="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="deleteModal.show = false"></div>
          <div class="relative bg-black border border-gray-500/20 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 animate-modal-in">
            <h2 class="text-xl font-bold mb-1">Delete User</h2>
            <p class="text-gray-400 text-sm mb-6">
              Are you sure you want to delete <span class="text-white font-medium">{{ deleteModal.user?.email }}</span>? 
              This will permanently delete all their workspaces, agents, services, and data. This action cannot be undone.
            </p>
            <div class="flex justify-end gap-3">
              <button 
                @click="deleteModal.show = false"
                class="px-4 py-2.5 bg-gray-500/10 border border-gray-500/10 hover:bg-gray-500/20 text-sm text-gray-200 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                @click="deleteUser"
                :disabled="deleteModal.loading"
                class="px-4 py-2.5 bg-red-400/20 text-red-400 hover:bg-red-400/30 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {{ deleteModal.loading ? 'Deleting...' : 'Delete User' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface AdminStats {
  users: number;
  workspaces: number;
  agents: number;
  services: number;
  onlineAgents: number;
  proWorkspaces: number;
  freeWorkspaces: number;
}

interface AdminUser {
  id: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  activeSessions: number;
  workspaces: {
    id: string;
    name: string;
    plan: string;
    agentCount: number;
    serviceCount: number;
    apiKeyCount: number;
  }[];
}

interface AdminWorkspace {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    emailVerified: boolean;
    isAdmin: boolean;
  };
  agentCount: number;
  serviceCount: number;
  apiKeyCount: number;
}

useHead({ title: 'Admin - Private Connect' });

definePageMeta({
  layout: 'default',
  middleware: 'admin',
});

const config = useRuntimeConfig();
const baseUrl = config.public.apiUrl;
const { success: toastSuccess, error: toastError } = useToast();
const { user: currentUser } = useAuth();

const loading = ref(true);
const stats = ref<AdminStats | null>(null);
const users = ref<AdminUser[]>([]);
const workspaces = ref<AdminWorkspace[]>([]);
const activeTab = ref<'users' | 'workspaces'>('users') as Ref<'users' | 'workspaces'>;
const userSearch = ref('');
const workspaceSearch = ref('');
const planFilter = ref('all');
const actionLoading = ref<string | null>(null);

const deleteModal = reactive({
  show: false,
  user: null as AdminUser | null,
  loading: false,
});

const tabs = computed(() => [
  { id: 'users' as const, label: 'Users', count: users.value.length },
  { id: 'workspaces' as const, label: 'Workspaces', count: workspaces.value.length },
]);

const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value;
  const search = userSearch.value.toLowerCase();
  return users.value.filter(u => 
    u.email.toLowerCase().includes(search) ||
    u.workspaces.some(ws => ws.name.toLowerCase().includes(search))
  );
});

const filteredWorkspaces = computed(() => {
  let result = workspaces.value;
  
  if (workspaceSearch.value) {
    const search = workspaceSearch.value.toLowerCase();
    result = result.filter(ws => 
      ws.name.toLowerCase().includes(search) ||
      ws.owner.email.toLowerCase().includes(search)
    );
  }
  
  if (planFilter.value !== 'all') {
    result = result.filter(ws => ws.plan === planFilter.value);
  }
  
  return result;
});

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fetchData = async () => {
  try {
    const [statsRes, usersRes, workspacesRes] = await Promise.all([
      fetch(`${baseUrl}/v1/admin/stats`, { credentials: 'include' }),
      fetch(`${baseUrl}/v1/admin/users`, { credentials: 'include' }),
      fetch(`${baseUrl}/v1/admin/workspaces`, { credentials: 'include' }),
    ]);

    if (!statsRes.ok || !usersRes.ok || !workspacesRes.ok) {
      throw new Error('Failed to fetch admin data');
    }

    stats.value = await statsRes.json();
    users.value = await usersRes.json();
    workspaces.value = await workspacesRes.json();
  } catch (error) {
    console.error('Failed to fetch admin data:', error);
    toastError('Failed to load admin data');
  } finally {
    loading.value = false;
  }
};

const refreshData = async () => {
  loading.value = true;
  await fetchData();
};

const upgradeWorkspace = async (workspaceId: string) => {
  actionLoading.value = workspaceId;
  try {
    const res = await fetch(`${baseUrl}/v1/admin/workspaces/${workspaceId}/upgrade`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) throw new Error('Failed to upgrade');

    toastSuccess('Workspace upgraded to PRO');
    await fetchData();
  } catch (error) {
    toastError('Failed to upgrade workspace');
  } finally {
    actionLoading.value = null;
  }
};

const downgradeWorkspace = async (workspaceId: string) => {
  actionLoading.value = workspaceId;
  try {
    const res = await fetch(`${baseUrl}/v1/admin/workspaces/${workspaceId}/downgrade`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) throw new Error('Failed to downgrade');

    toastSuccess('Workspace downgraded to FREE');
    await fetchData();
  } catch (error) {
    toastError('Failed to downgrade workspace');
  } finally {
    actionLoading.value = null;
  }
};

const confirmDeleteUser = (user: AdminUser) => {
  deleteModal.user = user;
  deleteModal.show = true;
};

const deleteUser = async () => {
  if (!deleteModal.user) return;
  
  deleteModal.loading = true;
  try {
    const res = await fetch(`${baseUrl}/v1/admin/users/${deleteModal.user.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) throw new Error('Failed to delete');

    toastSuccess('User deleted successfully');
    deleteModal.show = false;
    await fetchData();
  } catch (error) {
    toastError('Failed to delete user');
  } finally {
    deleteModal.loading = false;
  }
};

onMounted(fetchData);
</script>

<style scoped>
.modal-enter-active {
  animation: modal-in 0.2s ease-out;
}

.modal-leave-active {
  animation: modal-out 0.15s ease-in;
}

@keyframes modal-in {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes modal-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}

.animate-modal-in {
  animation: modal-in 0.2s ease-out;
}
</style>
