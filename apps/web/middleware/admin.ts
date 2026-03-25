export default defineNuxtRouteMiddleware(async (_to, _from) => {
  const { isAuthenticated, isAdmin, fetchCurrentUser, isLoading } = useAuth();

  // Wait for auth to be checked if still loading
  if (isLoading.value) {
    await fetchCurrentUser();
  }

  // Check if authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }

  // Check if admin
  if (!isAdmin.value) {
    return navigateTo('/dashboard');
  }
});
