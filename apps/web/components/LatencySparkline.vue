<template>
  <div class="relative h-6 w-20 flex items-end gap-px">
    <!-- Sparkline bars -->
    <div
      v-for="(point, index) in normalizedData"
      :key="index"
      class="flex-1 rounded-t-sm transition-all duration-300"
      :class="getBarColor(data[index])"
      :style="{ height: `${point}%`, minHeight: '2px' }"
      :title="`${data[index]}ms`"
    ></div>
    
    <!-- Latest value tooltip -->
    <div 
      v-if="data.length > 0" 
      class="absolute -right-1 -top-5 text-[10px] font-mono px-1 rounded bg-gray-800/80 whitespace-nowrap"
      :class="getTextColor(data[data.length - 1])"
    >
      {{ data[data.length - 1] }}ms
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: number[];
  maxBars?: number;
  threshold?: number; // ms threshold for "slow"
}>(), {
  maxBars: 10,
  threshold: 100,
});

const normalizedData = computed(() => {
  const values = props.data.slice(-props.maxBars);
  if (values.length === 0) return [];
  
  const max = Math.max(...values, 1);
  return values.map(v => Math.max((v / max) * 100, 5)); // Min 5% height
});

const getBarColor = (value: number) => {
  if (value < props.threshold * 0.5) return 'bg-emerald-400/80';
  if (value < props.threshold) return 'bg-amber-400/80';
  return 'bg-red-400/80';
};

const getTextColor = (value: number) => {
  if (value < props.threshold * 0.5) return 'text-emerald-400';
  if (value < props.threshold) return 'text-amber-400';
  return 'text-red-400';
};
</script>

