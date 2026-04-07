import {
  generateKeyPairSync,
  diffieHellman,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  hkdfSync,
  KeyObject,
} from 'crypto';

const AES_KEY_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;

export interface X25519KeyPair {
  publicKey: Buffer;
  privateKey: KeyObject;
}

export interface SessionKeys {
  reachToExposeKey: Buffer;
  exposeToReachKey: Buffer;
}

export function generateX25519KeyPair(): X25519KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }),
    privateKey,
  };
}

export function computeSharedSecret(privateKey: KeyObject, peerPublicKeyDer: Buffer): Buffer {
  const peerKey = createPublicKey({ key: peerPublicKeyDer, type: 'spki', format: 'der' });
  return diffieHellman({ privateKey, publicKey: peerKey });
}

export function deriveSessionKeys(sharedSecret: Buffer, connectionId: string): SessionKeys {
  const salt = createHash('sha256').update(connectionId).digest();
  const keyMaterial = Buffer.from(
    hkdfSync('sha256', sharedSecret, salt, 'pc-e2e-v1', AES_KEY_BYTES * 2),
  );
  return {
    reachToExposeKey: keyMaterial.subarray(0, AES_KEY_BYTES),
    exposeToReachKey: keyMaterial.subarray(AES_KEY_BYTES, AES_KEY_BYTES * 2),
  };
}

function counterToNonce(counter: bigint): Buffer {
  const nonce = Buffer.alloc(GCM_NONCE_BYTES);
  nonce.writeBigUInt64BE(counter, 4); // first 4 bytes zero, last 8 bytes = counter
  return nonce;
}

export function encrypt(key: Buffer, counter: bigint, plaintext: Buffer): Buffer {
  const nonce = counterToNonce(counter);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]);
}

export function decrypt(key: Buffer, packet: Buffer, expectedCounter: bigint): Buffer {
  if (packet.length < GCM_NONCE_BYTES + GCM_TAG_BYTES) {
    throw new Error('E2E packet too short');
  }
  const nonce = packet.subarray(0, GCM_NONCE_BYTES);

  const packetCounter = nonce.readBigUInt64BE(4);
  if (packetCounter !== expectedCounter) {
    throw new Error(
      `E2E replay/reorder detected: expected counter ${expectedCounter}, got ${packetCounter}`,
    );
  }

  const tag = packet.subarray(packet.length - GCM_TAG_BYTES);
  const ciphertext = packet.subarray(GCM_NONCE_BYTES, packet.length - GCM_TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
