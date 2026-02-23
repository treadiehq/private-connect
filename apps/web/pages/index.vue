<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: [
    function () {
      return navigateTo('/login', { replace: true });
    },
  ],
});
</script>
