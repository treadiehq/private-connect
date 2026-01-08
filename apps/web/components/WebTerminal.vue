<template>
  <div class="h-full flex flex-col bg-black">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 bg-gray-500/5 border-b border-gray-500/10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-purple-300/10 flex items-center justify-center">
          <svg class="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
        <span v-else-if="isConnecting" class="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-300/10 px-2.5 py-1 rounded-full border border-amber-300/20">
          <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Connecting...
        </span>
        <span v-else class="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-500/10 px-2.5 py-1 rounded-full border border-gray-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
          Disconnected
        </span>
      </div>
    </div>

    <!-- Terminal Body -->
    <div 
      ref="terminalBody"
      @click="focusInput"
      class="flex-1 p-4 font-mono text-sm leading-relaxed overflow-y-auto bg-black/50 cursor-text"
    >
      <!-- Welcome Message -->
      <div class="text-gray-500 mb-4 pb-4 border-b border-gray-500/10">
        <p class="text-gray-400">Welcome to Private Connect Web Terminal</p>
        <p class="text-xs mt-1">Connected to {{ serviceName }} via secure tunnel</p>
        <div class="mt-3 p-3 bg-gray-500/5 rounded-lg border border-gray-500/10">
          <p class="text-xs text-gray-500 mb-2">For full SSH access, use the CLI:</p>
          <code class="text-xs text-blue-300">connect {{ serviceName }}</code>
        </div>
      </div>

      <!-- Output Lines -->
      <div 
        v-for="(line, index) in lines" 
        :key="index"
        class="flex items-start gap-2 py-0.5"
      >
        <span v-if="line.type === 'input'" class="text-blue-300">$</span>
        <span v-else-if="line.type === 'error'" class="text-red-400">!</span>
        <span v-else class="text-gray-600">&nbsp;</span>
        <span :class="getLineClass(line.type)">{{ line.text }}</span>
      </div>

      <!-- Current Input -->
      <div class="flex items-start gap-2 mt-1">
        <span class="text-blue-300">$</span>
        <div class="flex-1 relative">
          <input
            ref="inputRef"
            v-model="currentInput"
            @keydown="handleKeydown"
            class="w-full bg-transparent text-gray-200 focus:outline-none"
            :disabled="!isConnected"
            spellcheck="false"
            autocomplete="off"
          />
          <span v-if="!isConnected" class="absolute inset-0 text-gray-600">
            {{ isConnecting ? 'Connecting...' : 'Disconnected' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between px-4 py-2.5 bg-gray-500/5 border-t border-gray-500/10 text-xs text-gray-500">
      <div class="flex items-center gap-4">
        <span>Press <kbd class="bg-gray-500/20 px-1.5 py-0.5 rounded text-gray-400">↑</kbd> for history</span>
        <span>Press <kbd class="bg-gray-500/20 px-1.5 py-0.5 rounded text-gray-400">Ctrl+L</kbd> to clear</span>
      </div>
      <div>
        <button 
          @click="clearTerminal"
          class="text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-500/10"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TerminalLine {
  type: 'input' | 'output' | 'error';
  text: string;
}

const props = defineProps<{
  token: string;
  serviceName: string;
  connectionInfo: string;
}>();

const config = useRuntimeConfig();
const lines = ref<TerminalLine[]>([]);
const currentInput = ref('');
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);
const isConnected = ref(false);
const isConnecting = ref(true);

const terminalBody = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

// Simulate connection
onMounted(async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  isConnecting.value = false;
  isConnected.value = true;
  
  lines.value.push({
    type: 'output',
    text: 'Connection established. Type commands to execute remotely.',
  });
  
  scrollToBottom();
  inputRef.value?.focus();
});

const focusInput = () => {
  inputRef.value?.focus();
};

const handleKeydown = async (e: KeyboardEvent) => {
  if (e.key === 'Enter' && currentInput.value.trim()) {
    await executeCommand(currentInput.value.trim());
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    navigateHistory(1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    navigateHistory(-1);
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    clearTerminal();
  }
};

const executeCommand = async (command: string) => {
  // Add to display
  lines.value.push({ type: 'input', text: command });
  
  // Add to history
  if (commandHistory.value[0] !== command) {
    commandHistory.value.unshift(command);
    if (commandHistory.value.length > 50) {
      commandHistory.value.pop();
    }
  }
  historyIndex.value = -1;
  currentInput.value = '';

  try {
    const response = await fetch(`${config.public.apiBase}/api/shared/${props.token}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });

    const data = await response.json();

    if (!response.ok) {
      lines.value.push({ type: 'error', text: data.error || 'Command failed' });
    } else if (data.output) {
      // Split output into lines
      const outputLines = data.output.split('\n');
      outputLines.forEach((line: string) => {
        lines.value.push({ type: 'output', text: line });
      });
    }
  } catch (error: any) {
    lines.value.push({ type: 'error', text: error.message });
  }

  scrollToBottom();
};

const navigateHistory = (direction: number) => {
  const newIndex = historyIndex.value + direction;
  
  if (newIndex < -1 || newIndex >= commandHistory.value.length) return;
  
  historyIndex.value = newIndex;
  
  if (newIndex === -1) {
    currentInput.value = '';
  } else {
    currentInput.value = commandHistory.value[newIndex];
  }
};

const clearTerminal = () => {
  lines.value = [];
};

const scrollToBottom = () => {
  nextTick(() => {
    if (terminalBody.value) {
      terminalBody.value.scrollTop = terminalBody.value.scrollHeight;
    }
  });
};

const getLineClass = (type: string): string => {
  switch (type) {
    case 'input': return 'text-gray-200';
    case 'error': return 'text-red-400';
    default: return 'text-gray-400';
  }
};
</script>
