import { VALID_EVENTS } from './webhooks.controller';

describe('VALID_EVENTS', () => {
  it('includes service health transitions so POST /v1/webhooks can subscribe to them', () => {
    expect(VALID_EVENTS).toContain('service.healthy');
    expect(VALID_EVENTS).toContain('service.unhealthy');
  });

  it('includes grant events documented alongside other subscribable types', () => {
    expect(VALID_EVENTS).toContain('grant.created');
    expect(VALID_EVENTS).toContain('grant.revoked');
  });
});
