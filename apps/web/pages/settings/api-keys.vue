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

        <div class="flex items-center gap-4">
          <!-- IP Restriction Badge -->
          <div v-if="key.allowedIpRanges && key.allowedIpRanges.length > 0" class="flex items-center gap-1.5 px-2 py-1 bg-emerald-300/10 text-emerald-300 rounded text-xs font-medium">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {{ key.allowedIpRanges.length }} IP{{ key.allowedIpRanges.length > 1 ? 's' : '' }}
          </div>
          <div v-else class="flex items-center gap-1.5 px-2 py-1 bg-amber-300/10 text-amber-300 rounded text-xs font-medium">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Any IP
          </div>

          <div class="text-right text-sm">
            <div class="text-gray-400">Created {{ formatDate(key.createdAt) }}</div>
            <div v-if="key.lastUsedAt" class="text-gray-500">
              Last used {{ formatDate(key.lastUsedAt) }}
              <span v-if="key.lastUsedIp" class="text-gray-600">from {{ key.lastUsedIp }}</span>
            </div>
            <div v-else class="text-gray-500">Never used</div>
          </div>

          <!-- Edit IP Restrictions -->
          <button
            @click="openIpModal(key)"
            class="p-2 text-gray-400 hover:text-blue-300 transition-colors"
            title="Edit IP restrictions"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

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
    <div v-if="showCreateModal" class="fixed inset-0 bg-[#09090b]/80 flex items-center justify-center z-50 p-4" @click.self="closeCreateModal">
      <div class="bg-black-main border border-gray-500/20 rounded-lg w-full max-w-md p-6 animate-fade-in">
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
                class="w-full px-4 py-3 pr-12 bg-black-main border border-gray-500/10 rounded-lg font-mono text-sm"
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

          <div class="p-3 bg-black-main rounded-lg mb-4 overflow-hidden">
            <p class="text-xs text-gray-500 mb-1">Connect an agent:</p>
            <code class="text-sm text-blue-300 break-all">connect up --api-key {{ newlyCreatedKey.key }}</code>
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
    <div v-if="keyToRevoke" class="fixed inset-0 bg-[#09090b]/80 flex items-center justify-center z-50 p-4" @click.self="keyToRevoke = null">
      <div class="bg-black-main border border-gray-500/20 rounded-xl w-full max-w-md p-6 animate-fade-in">
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

    <!-- IP Restrictions Modal -->
    <div v-if="ipEditKey" class="fixed inset-0 bg-[#09090b]/80 flex items-center justify-center z-50 p-4" @click.self="closeIpModal">
      <div class="bg-black-main border border-gray-500/20 rounded-xl w-full max-w-lg p-6 animate-fade-in">
        <h2 class="text-xl font-semibold mb-2">IP Restrictions</h2>
        <p class="text-gray-400 text-sm mb-6">
          Limit which IP addresses can use <span class="text-white font-medium">{{ ipEditKey.name }}</span>. 
          Leave empty to allow all IPs.
        </p>

        <!-- Current IP ranges -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-white mb-2">Allowed IP Ranges (CIDR)</label>
          
          <div v-if="editingIpRanges.length > 0" class="space-y-2 mb-3">
            <div 
              v-for="(range, index) in editingIpRanges" 
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="editingIpRanges[index]"
                type="text"
                placeholder="e.g., 10.0.0.0/8"
                class="flex-1 px-3 py-2 bg-gray-500/10 border border-gray-500/10 rounded-lg font-mono text-sm focus:border-blue-300 focus:ring-1 focus:ring-blue-300 focus:outline-none transition-colors"
              />
              <button
                @click="removeIpRange(index)"
                class="p-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <button
            @click="addIpRange"
            class="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add IP range
          </button>
        </div>

        <!-- Examples -->
        <div class="p-3 bg-gray-500/5 rounded-lg mb-6 text-xs text-gray-500">
          <p class="font-medium text-gray-400 mb-1">Examples:</p>
          <ul class="space-y-0.5">
            <li><code class="text-gray-400">10.0.0.0/8</code> — Private network</li>
            <li><code class="text-gray-400">192.168.1.0/24</code> — Office subnet</li>
            <li><code class="text-gray-400">203.0.113.45/32</code> — Single IP</li>
          </ul>
        </div>

        <p v-if="ipError" class="mb-4 text-sm text-red-400">{{ ipError }}</p>

        <div class="flex gap-3">
          <button
            @click="closeIpModal"
            class="flex-1 py-3 bg-gray-500/10 hover:bg-gray-500/20 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            @click="saveIpRestrictions"
            :disabled="savingIp"
            class="flex-1 py-3 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg v-if="savingIp" class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ savingIp ? 'Saving...' : 'Save Restrictions' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'API Keys - Private Connect' })

interface ApiKey {
  id: string;
  name: string;
  key?: string;
  keyPrefix: string;
  allowedIpRanges?: string[];
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedIp?: string | null;
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

// IP restrictions modal
const ipEditKey = ref<ApiKey | null>(null);
const editingIpRanges = ref<string[]>([]);
const savingIp = ref(false);
const ipError = ref('');

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

const openIpModal = (key: ApiKey) => {
  ipEditKey.value = key;
  editingIpRanges.value = [...(key.allowedIpRanges || [])];
  ipError.value = '';
};

const closeIpModal = () => {
  ipEditKey.value = null;
  editingIpRanges.value = [];
  ipError.value = '';
};

const addIpRange = () => {
  editingIpRanges.value.push('');
};

const removeIpRange = (index: number) => {
  editingIpRanges.value.splice(index, 1);
};

const saveIpRestrictions = async () => {
  if (!ipEditKey.value) return;

  // Filter out empty entries and validate
  const ranges = editingIpRanges.value
    .map(r => r.trim())
    .filter(r => r.length > 0);

  // Basic CIDR validation
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  for (const range of ranges) {
    if (!cidrRegex.test(range)) {
      ipError.value = `Invalid CIDR format: ${range}`;
      return;
    }
  }

  savingIp.value = true;
  ipError.value = '';

  try {
    const response = await fetch(`${baseUrl}/v1/api-keys/${ipEditKey.value.id}/ip-restrictions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ allowedIpRanges: ranges }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update IP restrictions');
    }

    // Update local state
    const keyIndex = apiKeys.value.findIndex(k => k.id === ipEditKey.value?.id);
    if (keyIndex !== -1) {
      apiKeys.value[keyIndex].allowedIpRanges = ranges;
    }

    closeIpModal();
  } catch (e: any) {
    ipError.value = e.message || 'Failed to update IP restrictions';
  } finally {
    savingIp.value = false;
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

