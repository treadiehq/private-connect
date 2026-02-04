<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Loading State -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-xl bg-blue-300/10 flex items-center justify-center">
          <svg class="animate-spin h-6 w-6 text-blue-300" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-gray-400">Connecting to shared service...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full text-center">
        <div class="w-16 h-16 mx-auto mb-6 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold mb-3">Access Denied</h1>
        <p class="text-gray-400 mb-6">{{ error }}</p>
        <NuxtLink 
          to="/" 
          class="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Go to Private Connect</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Database Client -->
    <div v-else-if="shareInfo && isDatabase" class="h-screen flex flex-col">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-6 py-3 bg-gray-500/5 border-b border-gray-500/10">
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="text-gray-500 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div class="h-6 w-px bg-gray-500/20"></div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-white">{{ shareInfo.name }}</span>
              <span class="text-xs bg-emerald-300/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300/20">
                {{ getDatabaseType(shareInfo.service.targetPort) }}
              </span>
            </div>
            <p class="text-xs text-gray-500">Shared by {{ shareInfo.workspaceName }}</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span v-if="shareInfo.expiresAt" class="text-xs text-gray-500">
            Expires {{ formatExpiry(shareInfo.expiresAt) }}
          </span>
          <span class="text-xs text-gray-600">No installation required</span>
          <a href="/" class="text-xs text-blue-300 hover:text-blue-400 transition-colors hidden sm:block">
            Powered by Private Connect
          </a>
        </div>
      </div>

      <!-- SQL Client -->
      <div class="flex-1">
        <WebSQLClient
          :token="token"
          :service-name="shareInfo.service.name"
          :connection-info="`${shareInfo.service.targetHost}:${shareInfo.service.targetPort}`"
          :is-connected="isConnected"
        />
      </div>
    </div>

    <!-- SSH Terminal -->
    <div v-else-if="shareInfo && isSSH" class="h-screen flex flex-col">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-6 py-3 bg-gray-500/5 border-b border-gray-500/10">
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="text-gray-500 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div class="h-6 w-px bg-gray-500/20"></div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-white">{{ shareInfo.name }}</span>
              <span class="text-xs bg-purple-300/10 text-purple-300 px-2 py-0.5 rounded-full border border-purple-300/20">
                SSH
              </span>
            </div>
            <p class="text-xs text-gray-500">Shared by {{ shareInfo.workspaceName }}</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span v-if="shareInfo.expiresAt" class="text-xs text-gray-500">
            Expires {{ formatExpiry(shareInfo.expiresAt) }}
          </span>
          <span class="text-xs text-gray-600">Web Terminal Preview</span>
          <a href="/" class="text-xs text-blue-300 hover:text-blue-400 transition-colors hidden sm:block">
            Powered by Private Connect
          </a>
        </div>
      </div>

      <!-- Terminal -->
      <div class="flex-1">
        <WebTerminal
          :token="token"
          :service-name="shareInfo.service.name"
          :connection-info="`${shareInfo.service.targetHost}:${shareInfo.service.targetPort}`"
        />
      </div>
    </div>

    <!-- HTTP Service Preview -->
    <div v-else-if="shareInfo && isHTTP" class="min-h-screen">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-6 py-3 bg-gray-500/5 border-b border-gray-500/10">
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="text-gray-500 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div class="h-6 w-px bg-gray-500/20"></div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-white">{{ shareInfo.name }}</span>
              <span class="text-xs bg-blue-300/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-300/20">
                HTTP
              </span>
            </div>
            <p class="text-xs text-gray-500">Shared by {{ shareInfo.workspaceName }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button 
            @click="openInNewTab"
            class="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Open in new tab</span>
          </button>
          <a href="/" class="text-xs text-blue-300 hover:text-blue-400 transition-colors hidden sm:block">
            Powered by Private Connect
          </a>
        </div>
      </div>

      <!-- URL Bar -->
      <div class="px-6 py-3 bg-gray-500/5 border-b border-gray-500/10">
        <div class="flex items-center gap-3 max-w-4xl mx-auto">
          <div class="flex-1 flex items-center gap-2 bg-black/50 rounded-lg px-4 py-2 border border-gray-500/10">
            <svg class="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input 
              v-model="httpPath"
              @keydown.enter="loadPath"
              class="flex-1 bg-transparent text-sm text-gray-300 focus:outline-none font-mono"
              placeholder="/"
            />
          </div>
          <button 
            @click="loadPath"
            :disabled="httpLoading"
            class="px-4 py-2 bg-blue-300 text-black text-sm font-medium rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors"
          >
            Go
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="p-6">
        <div v-if="httpLoading" class="flex items-center justify-center py-20">
          <svg class="animate-spin h-6 w-6 text-blue-300" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>

        <div v-else-if="httpResponse" class="max-w-4xl mx-auto">
          <!-- Response Header -->
          <div class="flex items-center gap-3 mb-4">
            <span 
              class="text-xs font-medium px-2.5 py-1 rounded-full border"
              :class="httpResponse.status < 400 ? 'bg-emerald-300/10 text-emerald-300 border-emerald-300/10' : 'bg-red-400/10 text-red-400 border-red-400/10'"
            >
              {{ httpResponse.status }} {{ httpResponse.statusText }}
            </span>
            <span class="text-xs text-gray-500">{{ httpResponse.contentType }}</span>
            <span class="text-xs text-gray-500">{{ httpResponse.size }}</span>
          </div>

          <!-- Response Body -->
          <div class="bg-gray-500/5 rounded-xl border border-gray-500/10 overflow-hidden">
            <pre v-if="httpResponse.isJSON" class="p-4 text-sm text-gray-300 font-mono overflow-x-auto">{{ JSON.stringify(httpResponse.body, null, 2) }}</pre>
            <div v-else-if="httpResponse.isHTML" class="p-4">
              <div class="text-xs text-gray-500 mb-2">HTML Preview</div>
              <iframe 
                :srcdoc="httpResponse.body" 
                class="w-full h-96 bg-white rounded-lg"
                sandbox=""
              ></iframe>
            </div>
            <pre v-else class="p-4 text-sm text-gray-300 font-mono overflow-x-auto">{{ httpResponse.body }}</pre>
          </div>
        </div>

        <div v-else class="text-center py-20 text-gray-500">
          <p>Enter a path and click Go to load content</p>
        </div>
      </div>
    </div>

    <!-- Generic Service Info (with Branded Interstitial) -->
    <div v-else-if="shareInfo" class="min-h-screen flex flex-col">
      <!-- Branded Header -->
      <div class="flex items-center justify-between px-6 py-4 bg-gray-500/5 border-b border-gray-500/10">
        <NuxtLink to="/" class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-blue-300">
            <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-semibold text-white">Private Connect</span>
        </NuxtLink>
        <div class="flex items-center gap-4">
          <span v-if="shareInfo.expiresAt" class="text-xs text-gray-500">
            Expires {{ formatExpiry(shareInfo.expiresAt) }}
          </span>
          <NuxtLink to="/register" class="text-xs text-blue-300 hover:text-blue-200 transition-colors">
            Get Private Connect →
          </NuxtLink>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="max-w-lg w-full">
          <div class="bg-gray-500/5 rounded-xl border border-gray-500/10 p-8 text-center">
            <!-- Shared By Badge -->
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-300/10 border border-emerald-300/10 mb-6">
              <span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span class="text-xs text-emerald-300">Shared by {{ shareInfo.workspaceName }}</span>
            </div>
            
            <h1 class="text-2xl font-bold text-white mb-2">{{ shareInfo.name }}</h1>
            <p v-if="shareInfo.description" class="text-gray-400 mb-6">{{ shareInfo.description }}</p>
            
            <div class="bg-black/50 rounded-xl p-6 mb-6 border border-gray-500/10">
              <div class="text-sm text-gray-500 mb-2">Service</div>
              <div class="text-lg font-mono text-white">{{ shareInfo.service.name }}</div>
              <div class="text-sm text-gray-500 mt-1">
                {{ shareInfo.service.targetHost }}:{{ shareInfo.service.targetPort }}
              </div>
            </div>

            <div class="text-sm text-gray-500 mb-6">
              <p>This service requires the Private Connect CLI to access.</p>
            </div>

            <!-- Install Command -->
            <div class="bg-black/50 rounded-lg p-4 mb-4 border border-gray-500/10">
              <div class="text-xs text-gray-500 mb-2">Quick install:</div>
              <code class="text-sm text-blue-300 font-mono">curl -fsSL https://privateconnect.co/install.sh | bash</code>
            </div>

            <div class="bg-black/50 rounded-lg p-4 border border-gray-500/10">
              <div class="text-xs text-gray-500 mb-2">Then connect:</div>
              <code class="text-sm text-emerald-300 font-mono">connect {{ shareInfo.service.name }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Branded Footer -->
      <div class="px-6 py-4 border-t border-gray-500/10 bg-gray-500/5">
        <div class="flex items-center justify-between max-w-lg mx-auto">
          <div class="text-xs text-gray-500">
            Access private services anywhere. No VPN. No installs.
          </div>
          <NuxtLink to="/" class="text-xs text-gray-500 hover:text-white transition-colors">
            privateconnect.co
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
});

interface ShareInfo {
  name: string;
  description?: string;
  expiresAt?: string;
  workspaceName: string;
  service: {
    name: string;
    targetHost: string;
    targetPort: number;
    protocol: string;
  };
}

interface HTTPResponse {
  status: number;
  statusText: string;
  contentType: string;
  size: string;
  body: any;
  isJSON: boolean;
  isHTML: boolean;
}

const route = useRoute();
const token = computed(() => route.params.token as string);

const loading = ref(true);
const error = ref<string | null>(null);
const shareInfo = ref<ShareInfo | null>(null);
const isConnected = ref(false);

// HTTP preview state
const httpPath = ref('/');
const httpLoading = ref(false);
const httpResponse = ref<HTTPResponse | null>(null);

// Database ports
const DB_PORTS = [5432, 3306, 27017, 6379, 9200, 5984, 8529, 7687, 9042];
// SSH port
const SSH_PORT = 22;

const isDatabase = computed(() => {
  if (!shareInfo.value) return false;
  return DB_PORTS.includes(shareInfo.value.service.targetPort);
});

const isSSH = computed(() => {
  if (!shareInfo.value) return false;
  return shareInfo.value.service.targetPort === SSH_PORT;
});

const isHTTP = computed(() => {
  if (!shareInfo.value) return false;
  const port = shareInfo.value.service.targetPort;
  const protocol = shareInfo.value.service.protocol;
  return protocol === 'http' || protocol === 'https' || [80, 443, 3000, 8000, 8080].includes(port);
});

const getDatabaseType = (port: number): string => {
  const types: Record<number, string> = {
    5432: 'PostgreSQL',
    3306: 'MySQL',
    27017: 'MongoDB',
    6379: 'Redis',
    9200: 'Elasticsearch',
    5984: 'CouchDB',
    8529: 'ArangoDB',
    7687: 'Neo4j',
    9042: 'Cassandra',
  };
  return types[port] || 'Database';
};

const formatExpiry = (date: string): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  
  if (diff < 0) return 'Expired';
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
  return `on ${d.toLocaleDateString()}`;
};

const loadShareInfo = async () => {
  try {
    const config = useRuntimeConfig();
    const response = await fetch(`${config.public.apiBase}/v1/shared/${token.value}/info`);
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'This share link is invalid or has expired');
    }
    
    shareInfo.value = await response.json();
    isConnected.value = true;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

const loadPath = async () => {
  httpLoading.value = true;
  try {
    const config = useRuntimeConfig();
    const response = await fetch(`${config.public.apiBase}/shared/${token.value}${httpPath.value}`);
    
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('json') 
      ? await response.json()
      : await response.text();
    
    httpResponse.value = {
      status: response.status,
      statusText: response.statusText,
      contentType,
      size: formatSize(body),
      body,
      isJSON: contentType.includes('json'),
      isHTML: contentType.includes('html'),
    };
  } catch (e: any) {
    httpResponse.value = {
      status: 0,
      statusText: 'Error',
      contentType: 'text/plain',
      size: '0 B',
      body: e.message,
      isJSON: false,
      isHTML: false,
    };
  } finally {
    httpLoading.value = false;
  }
};

const formatSize = (body: any): string => {
  const size = typeof body === 'string' ? body.length : JSON.stringify(body).length;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const openInNewTab = () => {
  const config = useRuntimeConfig();
  window.open(`${config.public.apiBase}/shared/${token.value}${httpPath.value}`, '_blank');
};

onMounted(async () => {
  await loadShareInfo();
  // Auto-load content for HTTP services
  if (isHTTP.value && !error.value) {
    loadPath();
  }
});

useHead({
  title: computed(() => shareInfo.value ? `${shareInfo.value.name} - Private Connect` : 'Shared Access - Private Connect'),
});
</script>
