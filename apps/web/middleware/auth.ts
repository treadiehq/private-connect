export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check for auth pages
  if (to.path === '/login' || to.path === '/register' || to.path === '/verify') {
    return;
  }

  // Skip for diagnostic share links (public)
  if (to.path.startsWith('/diagnostics/')) {
    return;
  }

  const { isAuthenticated, isLoading, fetchCurrentUser } = useAuth();

  // If still loading, fetch the current user
  if (isLoading.value) {
    await fetchCurrentUser();
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }
});

