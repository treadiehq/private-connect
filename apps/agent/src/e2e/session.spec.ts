import { E2ESession } from './session';

function createPair(): [E2ESession, E2ESession] {
  const initiator = new E2ESession('conn-1', 'initiator');
  const responder = new E2ESession('conn-1', 'responder');
  initiator.complete(responder.getPublicKey());
  responder.complete(initiator.getPublicKey());
  return [initiator, responder];
}

describe('E2ESession', () => {
  it('encrypts and decrypts in order', () => {
    const [initiator, responder] = createPair();

    const messages = ['hello', 'world', 'test'];
    for (const msg of messages) {
      const encrypted = initiator.encrypt(Buffer.from(msg));
      const decrypted = responder.decrypt(encrypted);
      expect(decrypted.toString()).toBe(msg);
    }
  });

  it('works bidirectionally', () => {
    const [initiator, responder] = createPair();

    const enc1 = initiator.encrypt(Buffer.from('ping'));
    expect(responder.decrypt(enc1).toString()).toBe('ping');

    const enc2 = responder.encrypt(Buffer.from('pong'));
    expect(initiator.decrypt(enc2).toString()).toBe('pong');
  });

  it('rejects replayed packets', () => {
    const [initiator, responder] = createPair();

    const encrypted = initiator.encrypt(Buffer.from('transfer $100'));
    responder.decrypt(encrypted);

    expect(() => responder.decrypt(encrypted)).toThrow(/replay/i);
  });

  it('rejects out-of-order packets', () => {
    const [initiator, responder] = createPair();

    const pkt0 = initiator.encrypt(Buffer.from('first'));
    const pkt1 = initiator.encrypt(Buffer.from('second'));

    expect(() => responder.decrypt(pkt1)).toThrow(/replay/i);
  });

  it('rejects packets after replay attempt', () => {
    const [initiator, responder] = createPair();

    const pkt0 = initiator.encrypt(Buffer.from('msg-0'));
    responder.decrypt(pkt0);

    const pkt1 = initiator.encrypt(Buffer.from('msg-1'));
    responder.decrypt(pkt1);

    expect(() => responder.decrypt(pkt0)).toThrow(/replay/i);
  });
});
