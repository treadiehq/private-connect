<template>
  <div class="animate-fade-in space-y-6">
    <!-- Back link skeleton -->
    <div class="flex items-center gap-2">
      <SkeletonLoader variant="text" class="!w-4 !h-4" />
      <SkeletonLoader variant="text" class="!w-28" />
    </div>

    <!-- Header skeleton -->
    <div class="flex items-start justify-between flex-wrap gap-4">
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <SkeletonLoader variant="title" class="!w-56" />
          <SkeletonLoader variant="badge" class="!w-20" />
        </div>
        <SkeletonLoader variant="text" class="!w-72" />
      </div>
      <SkeletonLoader variant="button" class="!w-32" />
    </div>

    <!-- Connection Flow skeleton -->
    <div class="relative p-6 rounded-xl bg-gradient-to-br from-gray-500/5 to-transparent border border-gray-500/10">
      <div class="flex items-center justify-center gap-4">
        <SkeletonLoader class="!w-28 !h-16 !rounded-lg" />
        <SkeletonLoader class="!w-20 !h-1" />
        <SkeletonLoader class="!w-28 !h-16 !rounded-lg" />
        <SkeletonLoader class="!w-20 !h-1" />
        <SkeletonLoader class="!w-28 !h-16 !rounded-lg" />
      </div>
    </div>

    <!-- Info Cards skeleton -->
    <div class="grid lg:grid-cols-5 gap-4">
      <div class="lg:col-span-3 bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 space-y-4">
        <SkeletonLoader variant="text" class="!w-32 !h-3" />
        <div class="space-y-3">
          <div v-for="i in 4" :key="i" class="flex justify-between">
            <SkeletonLoader class="!w-20" />
            <SkeletonLoader class="!w-40" />
          </div>
        </div>
      </div>
      <div class="lg:col-span-2 bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 space-y-4">
        <SkeletonLoader variant="text" class="!w-24 !h-3" />
        <div class="space-y-3">
          <div v-for="i in 3" :key="i" class="flex justify-between">
            <SkeletonLoader class="!w-24" />
            <SkeletonLoader class="!w-20" />
          </div>
        </div>
      </div>
    </div>

    <!-- Diagnostic skeleton -->
    <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 space-y-4">
      <SkeletonLoader variant="text" class="!w-36 !h-3" />
      <div class="grid grid-cols-5 gap-3">
        <div v-for="i in 5" :key="i" class="bg-gray-500/5 rounded-lg p-4 space-y-2">
          <SkeletonLoader class="!w-12 !h-3 mx-auto" />
          <SkeletonLoader class="!w-16 !h-5 mx-auto" />
        </div>
      </div>
    </div>
  </div>
</template>

