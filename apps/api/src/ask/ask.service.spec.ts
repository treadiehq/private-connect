import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AskService } from './ask.service';
import type { AskReceipt } from './ask.types';

describe('AskService', () => {
  let service: AskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AskService],
    }).compile();
    service = module.get<AskService>(AskService);
  });

  describe('normalizeServiceInput', () => {
    it('adds http:// for localhost', () => {
      expect(service.normalizeServiceInput('localhost')).toBe('http://localhost');
      expect(service.normalizeServiceInput('localhost:3000')).toBe('http://localhost:3000');
    });

    it('adds http:// for 127.0.0.1', () => {
      expect(service.normalizeServiceInput('127.0.0.1')).toBe('http://127.0.0.1');
      expect(service.normalizeServiceInput('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    });

    it('adds https:// for other hostnames', () => {
      expect(service.normalizeServiceInput('example.com')).toBe('https://example.com');
      expect(service.normalizeServiceInput('my-api.internal')).toBe('https://my-api.internal');
      // URL origin normalizes default ports (443 for https → omitted)
      expect(service.normalizeServiceInput('api.example.com:443')).toBe('https://api.example.com');
    });

    it('keeps full URLs and returns origin only', () => {
      expect(service.normalizeServiceInput('http://localhost:3000')).toBe('http://localhost:3000');
      expect(service.normalizeServiceInput('https://example.com')).toBe('https://example.com');
      expect(service.normalizeServiceInput('https://example.com/path')).toBe('https://example.com');
    });

    it('trims whitespace', () => {
      expect(service.normalizeServiceInput('  localhost:3000  ')).toBe('http://localhost:3000');
    });

    it('throws for empty input', () => {
      expect(() => service.normalizeServiceInput('')).toThrow(BadRequestException);
      expect(() => service.normalizeServiceInput('   ')).toThrow(BadRequestException);
    });

    it('throws for invalid URL', () => {
      expect(() => service.normalizeServiceInput('not a url!!!')).toThrow(BadRequestException);
    });
  });

  describe('classifyReachability', () => {
    it('returns PUBLIC_OR_LOCAL when at least one check succeeded', () => {
      const receipts: AskReceipt[] = [
        { method: 'GET', path: '/health', url: 'http://localhost:3000/health', status: null, latencyMs: 100, ok: false, error: 'ECONNREFUSED' },
        { method: 'GET', path: '/', url: 'http://localhost:3000/', status: 200, latencyMs: 5, ok: true },
      ];
      const result = service.classifyReachability(receipts);
      expect(result.reachable).toBe(true);
      expect(result.classification).toBe('PUBLIC_OR_LOCAL');
    });

    it('returns UNREACHABLE_OR_PRIVATE when all checks failed with DNS error', () => {
      const receipts: AskReceipt[] = [
        { method: 'GET', path: '/health', url: 'https://no-such-host.invalid/health', status: null, latencyMs: 2000, ok: false, error: 'getaddrinfo ENOTFOUND no-such-host.invalid' },
        { method: 'GET', path: '/', url: 'https://no-such-host.invalid/', status: null, latencyMs: 2000, ok: false, error: 'getaddrinfo ENOTFOUND no-such-host.invalid' },
      ];
      const result = service.classifyReachability(receipts);
      expect(result.reachable).toBe(false);
      expect(result.classification).toBe('UNREACHABLE_OR_PRIVATE');
      expect(result.reason).toBeDefined();
    });

    it('returns UNREACHABLE_OR_PRIVATE when all checks failed with timeout', () => {
      const receipts: AskReceipt[] = [
        { method: 'GET', path: '/health', url: 'https://10.0.0.1/health', status: null, latencyMs: 2000, ok: false, error: 'The operation was aborted due to timeout' },
      ];
      const result = service.classifyReachability(receipts);
      expect(result.reachable).toBe(false);
      expect(result.classification).toBe('UNREACHABLE_OR_PRIVATE');
    });

    it('returns UNREACHABLE_OR_PRIVATE when all checks failed with ECONNREFUSED', () => {
      const receipts: AskReceipt[] = [
        { method: 'GET', path: '/health', url: 'http://localhost:9999/health', status: null, latencyMs: 10, ok: false, error: 'connect ECONNREFUSED 127.0.0.1:9999' },
      ];
      const result = service.classifyReachability(receipts);
      expect(result.reachable).toBe(false);
      expect(result.classification).toBe('UNREACHABLE_OR_PRIVATE');
    });

    it('returns UNREACHABLE_OR_PRIVATE when all checks returned 403', () => {
      const receipts: AskReceipt[] = [
        { method: 'GET', path: '/health', url: 'https://example.com/health', status: 403, latencyMs: 100, ok: false },
      ];
      const result = service.classifyReachability(receipts);
      expect(result.reachable).toBe(false);
      expect(result.classification).toBe('UNREACHABLE_OR_PRIVATE');
    });

    it('returns PUBLIC_OR_LOCAL when no receipts (edge case)', () => {
      const result = service.classifyReachability([]);
      expect(result.classification).toBe('PUBLIC_OR_LOCAL');
    });
  });

  describe('inferBlockedActions', () => {
    it('returns empty array for simple health check question', () => {
      const result = service.inferBlockedActions('Is it healthy?');
      expect(result).toEqual([]);
    });

    it('infers POST /deploy for deploy question', () => {
      const result = service.inferBlockedActions('Can you deploy the latest version?');
      expect(result).toContainEqual({ method: 'POST', path: '/deploy', reason: 'writes are disabled' });
    });

    it('infers POST /restart for restart question', () => {
      const result = service.inferBlockedActions('Please restart the service');
      expect(result).toContainEqual({ method: 'POST', path: '/restart', reason: 'writes are disabled' });
    });

    it('infers DELETE /resource for delete question', () => {
      const result = service.inferBlockedActions('Delete the old data');
      expect(result).toContainEqual({ method: 'DELETE', path: '/resource', reason: 'writes are disabled' });
    });

    it('infers multiple blocked actions for complex question', () => {
      const result = service.inferBlockedActions('Deploy the update and restart');
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result).toContainEqual({ method: 'POST', path: '/deploy', reason: 'writes are disabled' });
      expect(result).toContainEqual({ method: 'POST', path: '/restart', reason: 'writes are disabled' });
    });
  });
});
