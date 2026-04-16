import { stripLeadingUtf8Bom } from './hosts';

describe('stripLeadingUtf8Bom', () => {
  it('removes a single UTF-8 BOM so line-anchored markers can match', () => {
    const bom = '\uFEFF';
    expect(stripLeadingUtf8Bom(`${bom}# BEGIN private-connect\n`)).toBe('# BEGIN private-connect\n');
  });

  it('is a no-op when no BOM', () => {
    expect(stripLeadingUtf8Bom('127.0.0.1 localhost\n')).toBe('127.0.0.1 localhost\n');
  });
});
