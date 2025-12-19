/**
 * Prefetch composable for instant navigation
 * Preloads data on hover to make navigation feel instant
 */

const prefetchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function usePrefetch() {
  const { fetchServices, fetchAgents } = useApi();

  const getCached = <T>(key: string): T | null => {
    const cached = prefetchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  };

  const setCache = (key: string, data: any) => {
    prefetchCache.set(key, { data, timestamp: Date.now() });
  };

  const prefetchServices = async () => {
    const cached = getCached('services');
    if (cached) return cached;
    
    try {
      const data = await fetchServices();
      setCache('services', data);
      return data;
    } catch (error) {
      console.error('Prefetch failed:', error);
    }
  };

  const prefetchAgents = async () => {
    const cached = getCached('agents');
    if (cached) return cached;
    
    try {
      const data = await fetchAgents();
      setCache('agents', data);
      return data;
    } catch (error) {
      console.error('Prefetch failed:', error);
    }
  };

  const prefetchService = async (id: string) => {
    const cacheKey = `service:${id}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    // Prefetch is done via the API
    // For now, we rely on the services list cache
  };

  const prefetchAgent = async (id: string) => {
    const cacheKey = `agent:${id}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
  };

  // Directive for v-prefetch
  const prefetchOnHover = (el: HTMLElement, route: string) => {
    let prefetchTimeout: NodeJS.Timeout | null = null;

    const handleMouseEnter = () => {
      prefetchTimeout = setTimeout(() => {
        if (route.startsWith('/services')) {
          prefetchServices();
        } else if (route.startsWith('/agents')) {
          prefetchAgents();
        }
      }, 100); // Small delay to avoid prefetching on quick mouse movements
    };

    const handleMouseLeave = () => {
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
      }
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    // Cleanup
    return () => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  };

  const invalidateCache = (key?: string) => {
    if (key) {
      prefetchCache.delete(key);
    } else {
      prefetchCache.clear();
    }
  };

  return {
    prefetchServices,
    prefetchAgents,
    prefetchService,
    prefetchAgent,
    prefetchOnHover,
    invalidateCache,
    getCached,
  };
}

