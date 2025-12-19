<template>
  <div class="rounded-xl overflow-hidden border border-gray-500/20 bg-[#0d1117]">
    <!-- Terminal Header -->
    <div class="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-gray-500/20">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div class="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div class="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <span class="ml-3 text-xs text-gray-400 font-mono">{{ title }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="isRunning" class="flex items-center gap-1.5 text-xs text-emerald-400">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Running
        </span>
        <span v-else-if="lines.length > 0" class="text-xs text-gray-500">
          Completed
        </span>
        <button 
          @click="copyOutput"
          class="p-1.5 hover:bg-white/10 rounded transition-colors"
          title="Copy output"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Terminal Body -->
    <div 
      ref="terminalBody"
      class="p-4 font-mono text-sm leading-relaxed max-h-80 overflow-y-auto scroll-smooth"
    >
      <!-- Empty state -->
      <div v-if="lines.length === 0 && !isRunning" class="text-gray-500 italic">
        Waiting to start...
      </div>

      <!-- Terminal Lines -->
      <div 
        v-for="(line, index) in lines" 
        :key="index"
        class="flex items-start gap-2 animate-terminal-line"
        :style="{ animationDelay: `${index * 30}ms` }"
      >
        <!-- Line prefix -->
        <span class="text-gray-600 select-none shrink-0">{{ getPrefix(line) }}</span>
        
        <!-- Line content -->
        <span :class="getLineClass(line)">{{ line.text }}</span>
      </div>

      <!-- Cursor -->
      <div v-if="isRunning" class="flex items-center gap-2 mt-1">
        <span class="text-gray-600">$</span>
        <span class="w-2 h-4 bg-blue-300 animate-blink"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TerminalLine {
  type: 'command' | 'output' | 'success' | 'error' | 'info' | 'warning';
  text: string;
  timestamp?: Date;
}

const props = withDefaults(defineProps<{
  title?: string;
  lines: TerminalLine[];
  isRunning?: boolean;
}>(), {
  title: 'Diagnostic Output',
  isRunning: false,
});

const terminalBody = ref<HTMLElement | null>(null);
const { success } = useToast();

// Auto-scroll to bottom when new lines are added
watch(() => props.lines.length, () => {
  nextTick(() => {
    if (terminalBody.value) {
      terminalBody.value.scrollTop = terminalBody.value.scrollHeight;
    }
  });
});

const getPrefix = (line: TerminalLine) => {
  switch (line.type) {
    case 'command': return '$';
    case 'success': return '✓';
    case 'error': return '✗';
    case 'warning': return '!';
    case 'info': return '→';
    default: return ' ';
  }
};

const getLineClass = (line: TerminalLine) => {
  switch (line.type) {
    case 'command': return 'text-blue-300 font-medium';
    case 'success': return 'text-emerald-400';
    case 'error': return 'text-red-400';
    case 'warning': return 'text-amber-400';
    case 'info': return 'text-gray-400';
    default: return 'text-gray-300';
  }
};

const copyOutput = async () => {
  const text = props.lines.map(l => `${getPrefix(l)} ${l.text}`).join('\n');
  await navigator.clipboard.writeText(text);
  success('Copied to clipboard');
};
</script>

<style scoped>
@keyframes terminal-line {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.animate-terminal-line {
  animation: terminal-line 0.2s ease-out forwards;
}

.animate-blink {
  animation: blink 1s step-end infinite;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

