import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { formatEndpoint, suggestedName, defaultPortForType } from './endpoint';
import { parseResourceConfig, resolveResource, ConfigValidationError } from './parser';
import { parseTtl, formatDuration, createSession, buildSuccessJson, buildErrorJson } from './session';

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint formatting
// ─────────────────────────────────────────────────────────────────────────────

describe('formatEndpoint', () => {
  it('formats postgres endpoint', () => {
    expect(formatEndpoint('postgres', '127.0.0.1', 5432)).toBe('postgres://127.0.0.1:5432');
  });

  it('formats mysql endpoint', () => {
    expect(formatEndpoint('mysql', '127.0.0.1', 3306)).toBe('mysql://127.0.0.1:3306');
  });

  it('formats redis endpoint', () => {
    expect(formatEndpoint('redis', '127.0.0.1', 6379)).toBe('redis://127.0.0.1:6379');
  });

  it('formats http endpoint', () => {
    expect(formatEndpoint('http', '127.0.0.1', 4010)).toBe('http://127.0.0.1:4010');
  });

  it('formats generic-tcp endpoint', () => {
    expect(formatEndpoint('generic-tcp', '127.0.0.1', 9090)).toBe('tcp://127.0.0.1:9090');
  });
});

describe('suggestedName', () => {
  it('appends .pc suffix', () => {
    expect(suggestedName('staging-db')).toBe('staging-db.pc');
  });
});

describe('defaultPortForType', () => {
  it('returns 5432 for postgres', () => {
    expect(defaultPortForType('postgres')).toBe(5432);
  });

  it('returns 3306 for mysql', () => {
    expect(defaultPortForType('mysql')).toBe(3306);
  });

  it('returns 6379 for redis', () => {
    expect(defaultPortForType('redis')).toBe(6379);
  });

  it('returns 80 for http', () => {
    expect(defaultPortForType('http')).toBe(80);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Config validation
// ─────────────────────────────────────────────────────────────────────────────

describe('parseResourceConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(filename: string, content: string): string {
    const p = path.join(tmpDir, filename);
    fs.writeFileSync(p, content);
    return p;
  }

  it('parses a valid YAML config with resources', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  staging-db:
    type: postgres
    host: internal-db
    port: 5432
    access:
      mode: tcp
  api:
    type: http
    url: http://api.internal:3000
    access:
      mode: http
`);
    const result = parseResourceConfig(p);
    expect(Object.keys(result.resources)).toEqual(['staging-db', 'api']);
    expect(result.resources['staging-db'].type).toBe('postgres');
    expect(result.resources['staging-db'].host).toBe('internal-db');
    expect(result.resources['staging-db'].port).toBe(5432);
    expect(result.resources['api'].url).toBe('http://api.internal:3000');
  });

  it('parses a valid JSON config', () => {
    const p = writeConfig('pconnect.json', JSON.stringify({
      resources: {
        redis: {
          type: 'redis',
          host: 'redis.internal',
          port: 6379,
          access: { mode: 'tcp' },
        },
      },
    }));
    const result = parseResourceConfig(p);
    expect(result.resources['redis'].type).toBe('redis');
  });

  it('throws on missing type', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  bad:
    host: db
    access:
      mode: tcp
`);
    expect(() => parseResourceConfig(p)).toThrow(ConfigValidationError);
    expect(() => parseResourceConfig(p)).toThrow(/missing "type"/);
  });

  it('throws on invalid type', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  bad:
    type: oracle
    host: db
    access:
      mode: tcp
`);
    expect(() => parseResourceConfig(p)).toThrow(/invalid type "oracle"/);
  });

  it('throws on missing host for tcp resource', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  bad:
    type: postgres
    port: 5432
    access:
      mode: tcp
`);
    expect(() => parseResourceConfig(p)).toThrow(/requires "host"/);
  });

  it('throws on missing access block', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  bad:
    type: redis
    host: redis.internal
`);
    expect(() => parseResourceConfig(p)).toThrow(/missing "access"/);
  });

  it('throws on invalid port', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  bad:
    type: postgres
    host: db
    port: 99999
    access:
      mode: tcp
`);
    expect(() => parseResourceConfig(p)).toThrow(/invalid port/);
  });

  it('throws on invalid resource name characters', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  "bad name!":
    type: redis
    host: redis.internal
    access:
      mode: tcp
`);
    expect(() => parseResourceConfig(p)).toThrow(/invalid characters/);
  });

  it('returns empty resources when section is absent', () => {
    const p = writeConfig('pconnect.yml', `
services:
  - name: db
    port: 5432
`);
    const result = parseResourceConfig(p);
    expect(Object.keys(result.resources)).toHaveLength(0);
  });

  it('preserves services section alongside resources', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  staging-db:
    type: postgres
    host: internal-db
    port: 5432
    access:
      mode: tcp
services:
  - name: db
    port: 5432
  - name: redis
    port: 6379
hub: https://api.example.com
`);
    const result = parseResourceConfig(p);
    expect(Object.keys(result.resources)).toHaveLength(1);
    expect(result.services).toHaveLength(2);
    expect(result.hub).toBe('https://api.example.com');
  });

  it('handles old config with only services (no resources)', () => {
    const p = writeConfig('pconnect.yml', `
services:
  - name: staging-db
    port: 5432
  - name: redis
    port: 6379
hub: https://api.example.com
`);
    const result = parseResourceConfig(p);
    expect(Object.keys(result.resources)).toHaveLength(0);
    expect(result.services).toHaveLength(2);
    expect(result.hub).toBe('https://api.example.com');
  });

  it('parses typed service entries with all fields', () => {
    const p = writeConfig('pconnect.yml', `
services:
  - name: db
    port: 5432
    localPort: 5433
    protocol: tcp
  - name: api
    port: 3000
`);
    const result = parseResourceConfig(p);
    expect(result.services).toHaveLength(2);
    expect(result.services[0]).toEqual({
      name: 'db',
      port: 5432,
      localPort: 5433,
      protocol: 'tcp',
    });
    expect(result.services[1]).toEqual({
      name: 'api',
      port: 3000,
      localPort: undefined,
      protocol: undefined,
    });
  });

  it('parses typed expose entries', () => {
    const p = writeConfig('pconnect.yml', `
expose:
  web:
    target: localhost:3000
    public: true
    expires: 2h
  api:
    target: localhost:8000
`);
    const result = parseResourceConfig(p);
    expect(result.expose).toHaveLength(2);
    expect(result.expose[0]).toEqual({
      name: 'web',
      target: 'localhost:3000',
      public: true,
      expires: '2h',
    });
    expect(result.expose[1]).toEqual({
      name: 'api',
      target: 'localhost:8000',
      public: false,
      expires: undefined,
    });
  });

  it('returns empty arrays when services and expose are absent', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  db:
    type: postgres
    host: db
    port: 5432
    access:
      mode: tcp
`);
    const result = parseResourceConfig(p);
    expect(result.services).toHaveLength(0);
    expect(result.expose).toHaveLength(0);
  });

  it('supports via: hub in access config', () => {
    const p = writeConfig('pconnect.yml', `
resources:
  prod-db:
    type: postgres
    host: prod-db.vpc
    port: 5432
    access:
      mode: tcp
      via: hub
`);
    const result = parseResourceConfig(p);
    expect(result.resources['prod-db'].access.via).toBe('hub');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Resource resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveResource', () => {
  it('resolves a tcp resource with host + port', () => {
    const resolved = resolveResource('db', {
      type: 'postgres',
      host: 'internal-db',
      port: 5432,
      access: { mode: 'tcp' },
    });
    expect(resolved.targetHost).toBe('internal-db');
    expect(resolved.targetPort).toBe(5432);
    expect(resolved.via).toBe('direct');
  });

  it('resolves an http resource from url', () => {
    const resolved = resolveResource('api', {
      type: 'http',
      url: 'http://api.internal:3000',
      access: { mode: 'http' },
    });
    expect(resolved.targetHost).toBe('api.internal');
    expect(resolved.targetPort).toBe(3000);
  });

  it('falls back to default port when not specified', () => {
    const resolved = resolveResource('redis', {
      type: 'redis',
      host: 'redis.internal',
      access: { mode: 'tcp' },
    });
    expect(resolved.targetPort).toBe(6379);
  });

  it('prefers targetHost over host', () => {
    const resolved = resolveResource('db', {
      type: 'postgres',
      host: 'old',
      targetHost: 'new',
      port: 5432,
      access: { mode: 'tcp' },
    });
    expect(resolved.targetHost).toBe('new');
  });

  it('sets via to hub when configured', () => {
    const resolved = resolveResource('db', {
      type: 'postgres',
      host: 'db',
      access: { mode: 'tcp', via: 'hub' },
    });
    expect(resolved.via).toBe('hub');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TTL parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('parseTtl', () => {
  it('parses minutes', () => {
    expect(parseTtl('15m')).toBe(900);
  });

  it('parses hours', () => {
    expect(parseTtl('1h')).toBe(3600);
  });

  it('parses seconds', () => {
    expect(parseTtl('300s')).toBe(300);
  });

  it('returns default for undefined', () => {
    expect(parseTtl(undefined)).toBe(900);
  });

  it('returns default for invalid input', () => {
    expect(parseTtl('abc')).toBe(900);
  });
});

describe('formatDuration', () => {
  it('formats minutes', () => {
    expect(formatDuration(900)).toBe('15m');
  });

  it('formats hours', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session + JSON output
// ─────────────────────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with correct fields', () => {
    const session = createSession('staging-db', 'postgres', 5432, 900);
    expect(session.id).toMatch(/^sess_[a-f0-9]{16}$/);
    expect(session.resourceName).toBe('staging-db');
    expect(session.resourceType).toBe('postgres');
    expect(session.localPort).toBe(5432);
    expect(session.protocol).toBe('tcp');
    expect(session.status).toBe('active');
    expect(session.endpoint).toBe('postgres://127.0.0.1:5432');

    const createdAt = new Date(session.createdAt);
    const expiresAt = new Date(session.expiresAt);
    const diffMs = expiresAt.getTime() - createdAt.getTime();
    expect(Math.abs(diffMs - 900_000)).toBeLessThan(100);
  });

  it('uses http protocol for http type', () => {
    const session = createSession('api', 'http', 4010, 300);
    expect(session.protocol).toBe('http');
    expect(session.endpoint).toBe('http://127.0.0.1:4010');
  });
});

describe('buildSuccessJson', () => {
  it('returns correct JSON shape', () => {
    const session = createSession('staging-db', 'postgres', 5432, 900);
    const json = buildSuccessJson(session);

    expect(json.ok).toBe(true);
    expect(json.session.resource).toBe('staging-db');
    expect(json.session.type).toBe('postgres');
    expect(json.session.protocol).toBe('tcp');
    expect(json.session.endpoint).toBe('postgres://127.0.0.1:5432');
    expect(json.session.suggestedName).toBe('staging-db.pc');
    expect(typeof json.session.expiresInSeconds).toBe('number');
    expect(json.session.expiresInSeconds).toBeGreaterThan(0);
    expect(json.session.expiresInSeconds).toBeLessThanOrEqual(900);
  });
});

describe('buildErrorJson', () => {
  it('returns correct error shape', () => {
    const json = buildErrorJson('RESOURCE_NOT_FOUND', 'Resource "foo" not found');
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(json.error.message).toBe('Resource "foo" not found');
  });
});
