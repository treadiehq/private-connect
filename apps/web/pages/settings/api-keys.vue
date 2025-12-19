<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">API Keys</h1>
        <p class="text-sm text-gray-400 mt-1">Manage API keys for connecting agents to your workspace</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create Key
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg class="animate-spin h-8 w-8 text-blue-300" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Empty State -->
    <div v-else-if="apiKeys.length === 0" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-12 text-center">
      <div class="w-12 h-12 mx-auto rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium mb-2">No API Keys</h3>
      <p class="text-gray-400 mb-6">Create an API key to connect agents to your workspace</p>
      <button
        @click="showCreateModal = true"
        class="px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black font-medium rounded-lg transition-colors"
      >
        Create your first key
      </button>
    </div>

    <!-- API Keys List -->
    <div v-else class="space-y-3">
      <div
        v-for="key in apiKeys"
        :key="key.id"
        class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4 flex items-center justify-between"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-lg bg-gray-500/5 border border-gray-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <div class="font-medium">{{ key.name }}</div>
            <div class="text-sm text-gray-500 font-mono">{{ key.keyPrefix }}•••••••••••••</div>
          </div>
        </div>

        <div class="flex items-center gap-6">
          <div class="text-right text-sm">
            <div class="text-gray-400">Created {{ formatDate(key.createdAt) }}</div>
            <div v-if="key.lastUsedAt" class="text-gray-500">Last used {{ formatDate(key.lastUsedAt) }}</div>
            <div v-else class="text-gray-500">Never used</div>
          </div>
          <button
            @click="confirmRevoke(key)"
            class="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Revoke key"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" @click.self="closeCreateModal">
      <div class="bg-black border border-gray-500/20 rounded-lg w-full max-w-md p-6 animate-fade-in">
        <h2 class="text-xl font-semibold mb-4">Create API Key</h2>

        <!-- Show key after creation -->
        <div v-if="newlyCreatedKey">
          <div class="mb-4">
            <p class="text-gray-400 mb-4">Your new API key has been created. Copy it now — you won't be able to see it again.</p>
            <label class="block text-sm font-medium text-white mb-2">API Key</label>
            <div class="relative">
              <input
                :value="newlyCreatedKey.key"
                readonly
                class="w-full px-4 py-3 pr-12 bg-black border border-gray-500/10 rounded-lg font-mono text-sm"
              />
              <button
                @click="copyKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg v-if="copied" class="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            <p class="mt-2 text-xs text-amber-300">Save this key now. It won't be shown again!</p>
          </div>

          <div class="p-3 bg-black rounded-lg mb-4">
            <p class="text-xs text-gray-500 mb-1">Connect an agent:</p>
            <code class="text-sm text-blue-300">connect up --api-key {{ newlyCreatedKey.key }}</code>
          </div>

          <button
            @click="closeCreateModal"
            class="w-full py-3 bg-gray-500/10 hover:bg-gray-500/20 rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>

        <!-- Create form -->
        <form v-else @submit.prevent="createKey">
          <div class="mb-6">
            <label class="block text-sm font-medium text-white mb-2">Key Name</label>
            <input
              v-model="newKeyName"
              type="text"
              placeholder="e.g. Production, Development, CI/CD"
              class="w-full px-3 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-colors"
              required
              autofocus
            />
            <!-- <p class="mt-2 text-xs text-gray-500">A name to help you identify this key</p> -->
          </div>

          <p v-if="createError" class="mb-4 text-sm text-red-400">{{ createError }}</p>

          <div class="flex gap-3">
            <button
              type="button"
              @click="closeCreateModal"
              class="flex-1 py-2 bg-gray-500/10 hover:bg-gray-500/15 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creating || !newKeyName.trim()"
              class="flex-1 py-2 bg-blue-300 text-sm hover:bg-blue-400 disabled:opacity-50 text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg v-if="creating" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ creating ? 'Creating...' : 'Create Key' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Revoke Confirmation Modal -->
    <div v-if="keyToRevoke" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" @click.self="keyToRevoke = null">
      <div class="bg-black border border-gray-500/20 rounded-xl w-full max-w-md p-6 animate-fade-in">
        <h2 class="text-xl font-semibold mb-4">Revoke API Key</h2>
        <p class="text-gray-400 mb-6">
          Are you sure you want to revoke <span class="text-white font-medium">{{ keyToRevoke.name }}</span>? 
          Any agents using this key will immediately lose access.
        </p>

        <p v-if="revokeError" class="mb-4 text-sm text-red-400">{{ revokeError }}</p>

        <div class="flex gap-3">
          <button
            @click="keyToRevoke = null"
            class="flex-1 py-3 bg-gray-500/10 hover:bg-gray-500/20 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            @click="revokeKey"
            :disabled="revoking"
            class="flex-1 py-3 bg-red-400 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg v-if="revoking" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ revoking ? 'Revoking...' : 'Revoke Key' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ApiKey {
  id: string;
  name: string;
  key?: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const config = useRuntimeConfig();
const baseUrl = config.public.apiUrl;

const loading = ref(true);
const apiKeys = ref<ApiKey[]>([]);

// Create modal
const showCreateModal = ref(false);
const newKeyName = ref('');
const creating = ref(false);
const createError = ref('');
const newlyCreatedKey = ref<ApiKey | null>(null);
const copied = ref(false);

// Revoke modal
const keyToRevoke = ref<ApiKey | null>(null);
const revoking = ref(false);
const revokeError = ref('');

const fetchApiKeys = async () => {
  try {
    const response = await fetch(`${baseUrl}/v1/api-keys`, {
      credentials: 'include',
    });
    if (response.ok) {
      apiKeys.value = await response.json();
    }
  } catch (e) {
    console.error('Failed to fetch API keys:', e);
  } finally {
    loading.value = false;
  }
};

const createKey = async () => {
  creating.value = true;
  createError.value = '';

  try {
    const response = await fetch(`${baseUrl}/v1/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newKeyName.value.trim() }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create API key');
    }

    const newKey = await response.json();
    newlyCreatedKey.value = newKey;
    apiKeys.value.unshift({
      id: newKey.id,
      name: newKey.name,
      keyPrefix: newKey.keyPrefix,
      createdAt: newKey.createdAt,
      lastUsedAt: null,
    });
  } catch (e: any) {
    createError.value = e.message || 'Failed to create API key';
  } finally {
    creating.value = false;
  }
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  newKeyName.value = '';
  newlyCreatedKey.value = null;
  createError.value = '';
  copied.value = false;
};

const copyKey = async () => {
  if (newlyCreatedKey.value?.key) {
    await navigator.clipboard.writeText(newlyCreatedKey.value.key);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }
};

const confirmRevoke = (key: ApiKey) => {
  keyToRevoke.value = key;
  revokeError.value = '';
};

const revokeKey = async () => {
  if (!keyToRevoke.value) return;

  revoking.value = true;
  revokeError.value = '';

  try {
    const response = await fetch(`${baseUrl}/v1/api-keys/${keyToRevoke.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to revoke API key');
    }

    apiKeys.value = apiKeys.value.filter(k => k.id !== keyToRevoke.value?.id);
    keyToRevoke.value = null;
  } catch (e: any) {
    revokeError.value = e.message || 'Failed to revoke API key';
  } finally {
    revoking.value = false;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'just now' : `${diffMins} mins ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

onMounted(() => {
  fetchApiKeys();
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

