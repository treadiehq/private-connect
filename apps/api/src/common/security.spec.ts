import { extractClientIp } from './security';

describe('extractClientIp', () => {
  it('returns the rightmost IP from X-Forwarded-For to prevent spoofing', () => {
    const headers = {
      'x-forwarded-for': '8.8.8.8, 1.2.3.4', // 8.8.8.8 is spoofed, 1.2.3.4 is real client IP added by proxy
    };
    const ip = extractClientIp(headers);
    expect(ip).toBe('1.2.3.4');
  });

  it('returns the only IP when X-Forwarded-For has one entry', () => {
    const headers = { 'x-forwarded-for': '203.0.113.50' };
    expect(extractClientIp(headers)).toBe('203.0.113.50');
  });

  it('prefers Cloudflare cf-connecting-ip when present', () => {
    const headers = {
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '8.8.8.8, 1.2.3.4',
    };
    expect(extractClientIp(headers)).toBe('1.2.3.4');
  });

  it('returns undefined when no IP headers are present', () => {
    expect(extractClientIp({})).toBeUndefined();
  });
});
