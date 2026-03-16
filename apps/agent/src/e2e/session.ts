import {
  generateX25519KeyPair,
  computeSharedSecret,
  deriveSessionKeys,
  encrypt,
  decrypt,
  X25519KeyPair,
} from './crypto';

export type E2ERole = 'initiator' | 'responder';

export class E2ESession {
  private keyPair: X25519KeyPair;
  private connectionId: string;
  private role: E2ERole;
  private sendKey: Buffer | null = null;
  private recvKey: Buffer | null = null;
  private sendCounter: bigint = 0n;
  private _ready = false;

  constructor(connectionId: string, role: E2ERole) {
    this.connectionId = connectionId;
    this.role = role;
    this.keyPair = generateX25519KeyPair();
  }

  getPublicKey(): Buffer {
    return this.keyPair.publicKey;
  }

  complete(peerPublicKey: Buffer): void {
    const sharedSecret = computeSharedSecret(this.keyPair.privateKey, peerPublicKey);
    const keys = deriveSessionKeys(sharedSecret, this.connectionId);

    if (this.role === 'initiator') {
      this.sendKey = keys.reachToExposeKey;
      this.recvKey = keys.exposeToReachKey;
    } else {
      this.sendKey = keys.exposeToReachKey;
      this.recvKey = keys.reachToExposeKey;
    }

    this._ready = true;
  }

  get ready(): boolean {
    return this._ready;
  }

  encrypt(data: Buffer): Buffer {
    if (!this.sendKey) throw new Error('E2E session not ready');
    const encrypted = encrypt(this.sendKey, this.sendCounter, data);
    this.sendCounter++;
    return encrypted;
  }

  decrypt(data: Buffer): Buffer {
    if (!this.recvKey) throw new Error('E2E session not ready');
    return decrypt(this.recvKey, data);
  }
}
