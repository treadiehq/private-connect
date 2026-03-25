import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';
import * as os from 'os';
import { getConfigDir } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CERTS_DIR = 'certs';
const CA_KEY_FILE = 'ca-key.pem';
const CA_CERT_FILE = 'ca-cert.pem';
const SERVER_KEY_FILE = 'server-key.pem';
const SERVER_CERT_FILE = 'server-cert.pem';
const CA_COMMON_NAME = 'Private Connect Local CA';
const CA_VALIDITY_DAYS = 3650; // 10 years
const CERT_VALIDITY_DAYS = 825;  // ~2 years (macOS limit)
const FILE_MODE = 0o600;

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

function getCertsDir(): string {
  return path.join(getConfigDir(), CERTS_DIR);
}

function ensureCertsDir(): string {
  const dir = getCertsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASN.1 / DER helpers for self-signed cert generation without openssl binary
// ─────────────────────────────────────────────────────────────────────────────

function encodeDERLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x100) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derSequence(items: Buffer[]): Buffer {
  const body = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x30]), encodeDERLength(body.length), body]);
}

function derSet(items: Buffer[]): Buffer {
  const body = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x31]), encodeDERLength(body.length), body]);
}

function derOID(oid: string): Buffer {
  const parts = oid.split('.').map(Number);
  const encoded: number[] = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val < 128) {
      encoded.push(val);
    } else {
      const bytes: number[] = [];
      bytes.unshift(val & 0x7f);
      val >>= 7;
      while (val > 0) {
        bytes.unshift((val & 0x7f) | 0x80);
        val >>= 7;
      }
      encoded.push(...bytes);
    }
  }
  const buf = Buffer.from(encoded);
  return Buffer.concat([Buffer.from([0x06]), encodeDERLength(buf.length), buf]);
}

function derUTF8String(str: string): Buffer {
  const buf = Buffer.from(str, 'utf-8');
  return Buffer.concat([Buffer.from([0x0c]), encodeDERLength(buf.length), buf]);
}

function derInteger(value: Buffer | number): Buffer {
  let buf: Buffer;
  if (typeof value === 'number') {
    if (value === 0) {
      buf = Buffer.from([0]);
    } else {
      const hex = value.toString(16);
      buf = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
      if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
    }
  } else {
    buf = value;
    if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
  }
  return Buffer.concat([Buffer.from([0x02]), encodeDERLength(buf.length), buf]);
}

function derBitString(data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from([0x00]), data]);
  return Buffer.concat([Buffer.from([0x03]), encodeDERLength(body.length), body]);
}

function derOctetString(data: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x04]), encodeDERLength(data.length), data]);
}

function derExplicit(tag: number, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from([0xa0 | tag]),
    encodeDERLength(data.length),
    data,
  ]);
}

function derBoolean(value: boolean): Buffer {
  return Buffer.from([0x01, 0x01, value ? 0xff : 0x00]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate Generation (pure Node.js crypto, no openssl CLI)
// ─────────────────────────────────────────────────────────────────────────────

function generateKeyPair(): { privateKey: string; publicKeyDER: Buffer } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'sec1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  return { privateKey, publicKeyDER: publicKey as unknown as Buffer };
}

function buildName(cn: string): Buffer {
  const cnAttr = derSequence([
    derOID('2.5.4.3'), // commonName
    derUTF8String(cn),
  ]);
  return derSequence([derSet([cnAttr])]);
}

function toUTCTime(d: Date): string {
  const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yy}${MM}${dd}${hh}${mm}${ss}Z`;
}

function buildValidity(days: number): Buffer {
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400000);

  const encode = (s: string) => {
    const buf = Buffer.from(s, 'ascii');
    return Buffer.concat([Buffer.from([0x17]), encodeDERLength(buf.length), buf]);
  };

  return derSequence([encode(toUTCTime(now)), encode(toUTCTime(end))]);
}

function signTBS(tbs: Buffer, privateKeyPem: string): Buffer {
  const signer = crypto.createSign('SHA256');
  signer.update(tbs);
  const sig = signer.sign(privateKeyPem);
  return sig;
}

function buildCertificate(
  tbs: Buffer,
  signature: Buffer,
): Buffer {
  const algId = derSequence([
    derOID('1.2.840.10045.4.3.2'), // ecdsa-with-SHA256
  ]);

  return derSequence([tbs, algId, derBitString(signature)]);
}

function toPEM(der: Buffer, label: string): string {
  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface CertPaths {
  caKeyPath: string;
  caCertPath: string;
  serverKeyPath: string;
  serverCertPath: string;
}

export interface EnsureCertsResult {
  paths: CertPaths;
  caGenerated: boolean;
  serverGenerated: boolean;
}

/**
 * Check if a PEM certificate file expires within `thresholdDays`.
 * Returns true if the cert is missing, unparseable, or expiring soon.
 */
function isCertExpiringSoon(certPath: string, thresholdDays = 30): boolean {
  if (!fs.existsSync(certPath)) return true;
  try {
    const pem = fs.readFileSync(certPath, 'utf-8');
    const cert = new crypto.X509Certificate(pem);
    const expiryMs = new Date(cert.validTo).getTime() - Date.now();
    if (isNaN(expiryMs)) return true;
    return expiryMs < thresholdDays * 86400000;
  } catch {
    return true;
  }
}

/**
 * Fix file ownership after sudo operations.
 * When certs are generated/trusted via `sudo`, files may end up owned by root.
 * This restores ownership to the original user if SUDO_UID/SUDO_GID are set.
 */
function fixCertOwnership(dir: string): void {
  const uid = process.env.SUDO_UID;
  const gid = process.env.SUDO_GID;
  if (!uid) return;

  const uidNum = parseInt(uid, 10);
  const gidNum = gid ? parseInt(gid, 10) : uidNum;
  if (isNaN(uidNum)) return;

  try {
    for (const entry of fs.readdirSync(dir)) {
      const filePath = path.join(dir, entry);
      try { fs.chownSync(filePath, uidNum, gidNum); } catch { /* best-effort */ }
    }
    try { fs.chownSync(dir, uidNum, gidNum); } catch { /* best-effort */ }
  } catch { /* best-effort */ }
}

/**
 * Ensure a local CA and server certificate exist.
 * Generates them if missing or expiring soon. Returns paths and whether new certs were created.
 */
export function ensureCerts(): EnsureCertsResult {
  const dir = ensureCertsDir();
  const paths: CertPaths = {
    caKeyPath: path.join(dir, CA_KEY_FILE),
    caCertPath: path.join(dir, CA_CERT_FILE),
    serverKeyPath: path.join(dir, SERVER_KEY_FILE),
    serverCertPath: path.join(dir, SERVER_CERT_FILE),
  };

  let caGenerated = false;
  let serverGenerated = false;

  // Generate or regenerate CA if missing or expiring
  if (!fs.existsSync(paths.caKeyPath) || !fs.existsSync(paths.caCertPath) || isCertExpiringSoon(paths.caCertPath, 90)) {
    generateCA(paths);
    caGenerated = true;
    // CA changed — server cert must be re-signed
    generateServerCert(paths);
    serverGenerated = true;
  }

  // Generate or regenerate server cert if missing or expiring
  if (!serverGenerated && (!fs.existsSync(paths.serverKeyPath) || !fs.existsSync(paths.serverCertPath) || isCertExpiringSoon(paths.serverCertPath, 30))) {
    generateServerCert(paths);
    serverGenerated = true;
  }

  fixCertOwnership(dir);

  return { paths, caGenerated, serverGenerated };
}

function generateCA(paths: CertPaths): void {
  const { privateKey, publicKeyDER } = generateKeyPair();

  const algId = derSequence([
    derOID('1.2.840.10045.4.3.2'), // ecdsa-with-SHA256
  ]);

  const serialNumber = derInteger(crypto.randomBytes(8));
  const issuer = buildName(CA_COMMON_NAME);
  const subject = buildName(CA_COMMON_NAME);
  const validity = buildValidity(CA_VALIDITY_DAYS);

  // Basic Constraints: CA=TRUE
  const basicConstraints = derSequence([
    derOID('2.5.29.19'), // basicConstraints
    derBoolean(true),    // critical
    derOctetString(derSequence([derBoolean(true)])),
  ]);

  // Key Usage: keyCertSign, cRLSign
  const keyUsage = derSequence([
    derOID('2.5.29.15'), // keyUsage
    derBoolean(true),    // critical
    derOctetString(derBitString(Buffer.from([0x06]))), // keyCertSign + cRLSign
  ]);

  const extensions = derExplicit(3, derSequence([basicConstraints, keyUsage]));

  const tbs = derSequence([
    derExplicit(0, derInteger(2)), // version v3
    serialNumber,
    algId,
    issuer,
    validity,
    subject,
    Buffer.from(publicKeyDER), // subjectPublicKeyInfo (already SPKI DER)
    extensions,
  ]);

  const signature = signTBS(tbs, privateKey);
  const certDER = buildCertificate(tbs, signature);

  fs.writeFileSync(paths.caKeyPath, privateKey, { mode: FILE_MODE });
  fs.writeFileSync(paths.caCertPath, toPEM(certDER, 'CERTIFICATE'), { mode: FILE_MODE });
}

function generateServerCert(paths: CertPaths): void {
  const { privateKey, publicKeyDER } = generateKeyPair();

  const caKeyPem = fs.readFileSync(paths.caKeyPath, 'utf-8');
  const _caCertPem = fs.readFileSync(paths.caCertPath, 'utf-8');

  // Extract issuer name from CA cert (simplified: reuse the CA CN)
  const issuer = buildName(CA_COMMON_NAME);

  const algId = derSequence([
    derOID('1.2.840.10045.4.3.2'),
  ]);

  const serialNumber = derInteger(crypto.randomBytes(8));
  const subject = buildName('Private Connect Local Server');
  const validity = buildValidity(CERT_VALIDITY_DAYS);

  // Subject Alternative Names: *.localhost, localhost, 127.0.0.1
  const dnsName = (name: string) => {
    const buf = Buffer.from(name, 'ascii');
    return Buffer.concat([Buffer.from([0x82]), encodeDERLength(buf.length), buf]);
  };
  const ipAddr = (ip: string) => {
    const parts = ip.split('.').map(Number);
    return Buffer.concat([Buffer.from([0x87, 0x04]), Buffer.from(parts)]);
  };

  const sanValue = derSequence([
    dnsName('*.localhost'),
    dnsName('localhost'),
    ipAddr('127.0.0.1'),
  ]);

  const san = derSequence([
    derOID('2.5.29.17'), // subjectAltName
    derOctetString(sanValue),
  ]);

  const extensions = derExplicit(3, derSequence([san]));

  const tbs = derSequence([
    derExplicit(0, derInteger(2)),
    serialNumber,
    algId,
    issuer,
    validity,
    subject,
    Buffer.from(publicKeyDER),
    extensions,
  ]);

  const signature = signTBS(tbs, caKeyPem);
  const certDER = buildCertificate(tbs, signature);

  fs.writeFileSync(paths.serverKeyPath, privateKey, { mode: FILE_MODE });
  fs.writeFileSync(paths.serverCertPath, toPEM(certDER, 'CERTIFICATE'), { mode: FILE_MODE });
}

/**
 * Check if the local CA is already trusted in the system keychain.
 */
export function isCATrusted(): boolean {
  const dir = ensureCertsDir();
  const caCertPath = path.join(dir, CA_CERT_FILE);

  if (!fs.existsSync(caCertPath)) return false;

  const platform = os.platform();

  if (platform === 'darwin') {
    try {
      const result = spawnSync('security', [
        'verify-cert', '-c', caCertPath, '-p', 'ssl',
      ], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  if (platform === 'linux') {
    // Check common trust store locations
    const trustDirs = [
      '/usr/local/share/ca-certificates',
      '/etc/pki/ca-trust/source/anchors',
    ];
    const certName = 'private-connect-ca.crt';
    return trustDirs.some(dir => fs.existsSync(path.join(dir, certName)));
  }

  return false;
}

/**
 * Trust the local CA in the system keychain.
 * Returns { trusted, error? }.
 */
export function trustCA(): { trusted: boolean; error?: string } {
  const dir = ensureCertsDir();
  const caCertPath = path.join(dir, CA_CERT_FILE);

  if (!fs.existsSync(caCertPath)) {
    return { trusted: false, error: 'CA certificate not found. Run ensureCerts() first.' };
  }

  const platform = os.platform();

  if (platform === 'darwin') {
    try {
      const result = spawnSync('security', [
        'add-trusted-cert', '-d',
        '-r', 'trustRoot',
        '-k', path.join(os.homedir(), 'Library/Keychains/login.keychain-db'),
        caCertPath,
      ], { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });

      if (result.status === 0) {
        fixCertOwnership(path.dirname(caCertPath));
        return { trusted: true };
      }

      const sudoResult = spawnSync('sudo', [
        'security', 'add-trusted-cert', '-d',
        '-r', 'trustRoot',
        '-k', '/Library/Keychains/System.keychain',
        caCertPath,
      ], { encoding: 'utf-8', timeout: 30000, stdio: 'inherit' });

      if (sudoResult.status === 0) {
        fixCertOwnership(path.dirname(caCertPath));
        return { trusted: true };
      }

      return { trusted: false, error: 'Failed to add CA to keychain. Try: sudo connect proxy trust' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { trusted: false, error: msg };
    }
  }

  if (platform === 'linux') {
    try {
      // Debian/Ubuntu
      if (fs.existsSync('/usr/local/share/ca-certificates')) {
        const dest = '/usr/local/share/ca-certificates/private-connect-ca.crt';
        execSync(`sudo cp "${caCertPath}" "${dest}" && sudo update-ca-certificates`, {
          timeout: 15000,
          stdio: 'inherit',
        });
        return { trusted: true };
      }

      // RHEL/Fedora
      if (fs.existsSync('/etc/pki/ca-trust/source/anchors')) {
        const dest = '/etc/pki/ca-trust/source/anchors/private-connect-ca.crt';
        execSync(`sudo cp "${caCertPath}" "${dest}" && sudo update-ca-trust`, {
          timeout: 15000,
          stdio: 'inherit',
        });
        return { trusted: true };
      }

      return { trusted: false, error: 'Could not find system CA trust store.' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { trusted: false, error: msg };
    }
  }

  return { trusted: false, error: `Unsupported platform: ${platform}` };
}

/**
 * Read TLS cert and key as Buffers for use with https/http2.
 * Returns null if certs don't exist.
 */
export function loadTLSOptions(): { cert: Buffer; key: Buffer } | null {
  const dir = getCertsDir();
  const certPath = path.join(dir, SERVER_CERT_FILE);
  const keyPath = path.join(dir, SERVER_KEY_FILE);

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}
