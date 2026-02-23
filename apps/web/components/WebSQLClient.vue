<template>
  <div class="h-full flex flex-col bg-black">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 bg-gray-500/5 border-b border-gray-500/10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-emerald-300/10 flex items-center justify-center">
          <svg class="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <div>
          <h1 class="text-sm font-semibold text-white">{{ serviceName }}</h1>
          <p class="text-xs text-gray-500">{{ connectionInfo }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="isConnected" class="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-300/10 px-2.5 py-1 rounded-full border border-emerald-300/20">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
          Connected
        </span>
        <span v-else class="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-300/10 px-2.5 py-1 rounded-full border border-amber-300/20">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
          Connecting...
        </span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <!-- Query Editor Panel -->
      <div class="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-500/10">
        <!-- Editor Header -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-gray-500/5 border-b border-gray-500/10">
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Query</span>
          <div class="flex items-center gap-1">
            <button 
              @click="formatQuery"
              class="text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-500/10"
            >
              Format
            </button>
            <button 
              @click="clearQuery"
              class="text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-500/10"
            >
              Clear
            </button>
          </div>
        </div>

        <!-- Editor -->
        <div class="flex-1 relative min-h-[200px] bg-black/50">
          <textarea
            ref="editorRef"
            v-model="query"
            @keydown="handleKeydown"
            class="w-full h-full p-4 bg-transparent text-gray-200 font-mono text-sm resize-none focus:outline-none placeholder-gray-600"
            placeholder="SELECT * FROM users LIMIT 10;"
            spellcheck="false"
          ></textarea>
          
          <!-- Run Button Overlay -->
          <div class="absolute bottom-4 right-4">
            <button 
              @click="executeQuery"
              :disabled="isExecuting || !query.trim()"
              class="flex items-center gap-2 px-4 py-2 bg-blue-300 text-black text-sm font-medium rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg v-if="isExecuting" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              <span>{{ isExecuting ? 'Running...' : 'Run Query' }}</span>
              <kbd class="hidden sm:inline-block text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">⌘↵</kbd>
            </button>
          </div>
        </div>
      </div>

      <!-- Results Panel -->
      <div class="flex-1 flex flex-col min-h-[300px]">
        <!-- Results Header -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-gray-500/5 border-b border-gray-500/10">
          <div class="flex items-center gap-4">
            <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Results</span>
            <span v-if="result" class="text-xs text-gray-400">
              {{ result.rowCount }} row{{ result.rowCount !== 1 ? 's' : '' }} 
              <span v-if="result.duration" class="text-gray-500">• {{ result.duration }}ms</span>
            </span>
          </div>
          <div v-if="result?.rows?.length" class="flex items-center gap-1">
            <button 
              @click="copyAsCSV"
              class="text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-500/10"
            >
              Copy CSV
            </button>
            <button 
              @click="copyAsJSON"
              class="text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-500/10"
            >
              Copy JSON
            </button>
          </div>
        </div>

        <!-- Results Content -->
        <div class="flex-1 overflow-auto bg-black/50">
          <!-- Empty State -->
          <div v-if="!result && !error" class="h-full flex items-center justify-center text-gray-500">
            <div class="text-center">
              <div class="w-12 h-12 mx-auto mb-3 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <p class="text-sm text-gray-400">Run a query to see results</p>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="p-4">
            <div class="bg-red-400/10 border border-red-400/20 rounded-xl p-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-red-400">Query Error</p>
                  <p class="text-sm text-gray-400 mt-1 font-mono">{{ error }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Results Table -->
          <div v-else-if="result?.rows?.length" class="min-w-full">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-gray-500/5 border-b border-gray-500/10">
                <tr>
                  <th 
                    v-for="column in result.columns" 
                    :key="column"
                    class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {{ column }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-500/10">
                <tr 
                  v-for="(row, index) in result.rows" 
                  :key="index"
                  class="hover:bg-gray-500/5 transition-colors"
                >
                  <td 
                    v-for="column in result.columns" 
                    :key="column"
                    class="px-4 py-2.5 text-gray-300 font-mono text-xs whitespace-nowrap"
                  >
                    <span v-if="row[column] === null" class="text-gray-600 italic">NULL</span>
                    <span v-else-if="typeof row[column] === 'boolean'" :class="row[column] ? 'text-emerald-300' : 'text-red-400'">
                      {{ row[column] }}
                    </span>
                    <span v-else>{{ formatValue(row[column]) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- No Results -->
          <div v-else-if="result" class="h-full flex items-center justify-center">
            <div class="text-center">
              <div class="w-12 h-12 mx-auto mb-3 rounded-lg bg-emerald-300/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-sm text-white">Query executed successfully</p>
              <p class="text-xs text-gray-500 mt-1">{{ result.rowCount }} rows affected</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Query History (Collapsible) -->
    <div v-if="queryHistory.length > 0" class="border-t border-gray-500/10">
      <button 
        @click="showHistory = !showHistory"
        class="w-full flex items-center justify-between px-4 py-2.5 bg-gray-500/5 hover:bg-gray-500/10 transition-colors"
      >
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">History</span>
        <svg 
          class="w-4 h-4 text-gray-500 transition-transform"
          :class="{ 'rotate-180': showHistory }"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="showHistory" class="max-h-32 overflow-y-auto bg-black/50">
        <button 
          v-for="(item, index) in queryHistory" 
          :key="index"
          @click="loadFromHistory(item)"
          class="w-full text-left px-4 py-2.5 hover:bg-gray-500/10 transition-colors border-b border-gray-500/10 last:border-b-0"
        >
          <code class="text-xs text-gray-400 font-mono line-clamp-1">{{ item }}</code>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  token: string;
  serviceName: string;
  connectionInfo: string;
  isConnected?: boolean;
  queryUrl?: string;
}>();

const emit = defineEmits<{
  (e: 'query', query: string): void;
}>();

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  duration?: number;
}

const { success } = useToast();
const config = useRuntimeConfig();

const query = ref('');
const result = ref<QueryResult | null>(null);
const error = ref<string | null>(null);
const isExecuting = ref(false);
const queryHistory = ref<string[]>([]);
const showHistory = ref(false);
const editorRef = ref<HTMLTextAreaElement | null>(null);

const executeQuery = async () => {
  if (!query.value.trim() || isExecuting.value) return;
  
  isExecuting.value = true;
  error.value = null;
  result.value = null;

  const startTime = Date.now();
  
  try {
    const endpoint = props.queryUrl || `${config.public.apiBase}/api/shared/${props.token}/query`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.value }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Query failed');
    }

    result.value = {
      ...data,
      duration: Date.now() - startTime,
    };

    // Add to history
    const trimmed = query.value.trim();
    if (!queryHistory.value.includes(trimmed)) {
      queryHistory.value.unshift(trimmed);
      if (queryHistory.value.length > 10) {
        queryHistory.value.pop();
      }
    }

    emit('query', query.value);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    isExecuting.value = false;
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    executeQuery();
  }
};

const formatQuery = () => {
  // Simple formatting - uppercase keywords
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'NULL', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'TRUE', 'FALSE', 'ASC', 'DESC'];
  
  let formatted = query.value;
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    formatted = formatted.replace(regex, kw);
  });
  query.value = formatted;
};

const clearQuery = () => {
  query.value = '';
  result.value = null;
  error.value = null;
  editorRef.value?.focus();
};

const loadFromHistory = (item: string) => {
  query.value = item;
  showHistory.value = false;
  editorRef.value?.focus();
};

const formatValue = (value: any): string => {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const copyAsCSV = async () => {
  if (!result.value) return;
  
  const header = result.value.columns.join(',');
  const rows = result.value.rows.map(row => 
    result.value!.columns.map(col => {
      const val = row[col];
      if (val === null) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    }).join(',')
  ).join('\n');
  
  await navigator.clipboard.writeText(`${header}\n${rows}`);
  success('Copied as CSV');
};

const copyAsJSON = async () => {
  if (!result.value) return;
  await navigator.clipboard.writeText(JSON.stringify(result.value.rows, null, 2));
  success('Copied as JSON');
};

onMounted(() => {
  editorRef.value?.focus();
});
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
