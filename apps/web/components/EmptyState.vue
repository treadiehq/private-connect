<template>
  <div class="py-16 animate-fade-in">
    <div class="max-w-lg mx-auto text-center mb-10">
      <!-- Animated illustration -->
      <div class="relative w-32 h-32 mx-auto mb-8">
        <!-- Background glow -->
        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-2xl"></div>
        
        <!-- Main icon container -->
        <div class="relative w-full h-full rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] flex items-center justify-center">
          <!-- Icon -->
          <slot name="icon">
            <svg class="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </slot>
          
          <!-- Floating particles -->
          <div 
            v-for="i in 4" 
            :key="i"
            class="absolute w-2 h-2 rounded-full bg-blue-400/30 animate-float"
            :style="{
              top: `${[10, 70, 20, 80][i-1]}%`,
              left: `${[80, 20, 10, 90][i-1]}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + i * 0.5}s`
            }"
          ></div>
        </div>
      </div>

      <h3 class="text-2xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
        {{ title }}
      </h3>
      <p class="text-gray-400 max-w-sm mx-auto">
        {{ description }}
      </p>
    </div>

    <!-- CLI Instructions -->
    <div class="max-w-md mx-auto">
      <div class="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.08] rounded-xl overflow-hidden">
        <div class="flex items-center gap-2 px-4 py-2 border-b border-white/[0.05] bg-white/[0.02]">
          <div class="flex gap-1.5">
            <div class="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
          </div>
          <span class="text-[10px] text-gray-500 uppercase tracking-wider ml-2">Terminal</span>
        </div>
        
        <div class="p-5 space-y-4 font-mono text-sm">
          <slot name="commands">
            <div v-for="(cmd, index) in commands" :key="index" class="group">
              <p class="text-gray-500 mb-1 text-xs"># {{ cmd.comment }}</p>
              <div class="flex items-center gap-2">
                <span class="text-blue-400 select-none">$</span>
                <code class="text-gray-200 flex-1">{{ cmd.command }}</code>
                <button 
                  @click="copyCommand(cmd.command)"
                  class="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                  title="Copy command"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  description: string;
  commands?: Array<{ comment: string; command: string }>;
}>();

const { success } = useToast();

const copyCommand = async (command: string) => {
  try {
    await navigator.clipboard.writeText(command);
    success('Copied to clipboard');
  } catch (e) {
    console.error('Failed to copy:', e);
  }
};
</script>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
  50% { transform: translateY(-10px) scale(1.2); opacity: 0.6; }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
</style>

