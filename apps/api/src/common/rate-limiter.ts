/**
 * Simple in-memory rate limiter using sliding window
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be allowed
   * @param key Unique identifier (IP, subdomain, etc.)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      // New window
      this.limits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() - entry.windowStart > this.windowMs) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  getResetTime(key: string): number {
    const entry = this.limits.get(key);
    if (!entry) return 0;
    const resetAt = entry.windowStart + this.windowMs;
    return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.windowStart > this.windowMs * 2) {
        this.limits.delete(key);
      }
    }
  }
}

// Shared rate limiters
export const proxyRateLimiter = new RateLimiter(60000, 100); // 100 req/min per IP
export const proxySubdomainLimiter = new RateLimiter(60000, 500); // 500 req/min per subdomain
export const authRateLimiter = new RateLimiter(60000, 10); // 10 req/min per IP for auth

