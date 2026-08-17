import { describe, expect, it } from 'vitest';

import { CredentialEncryption } from './credential-encryption.js';

const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('CredentialEncryption', () => {
  it('encrypts and decrypts a provider token', () => {
    const encryption = new CredentialEncryption(encryptionKey);

    const encrypted = encryption.encrypt('provider-secret-token');

    expect(encrypted).not.toContain('provider-secret-token');
    expect(encryption.decrypt(encrypted)).toBe('provider-secret-token');
  });

  it('uses a new initialization vector for every encryption', () => {
    const encryption = new CredentialEncryption(encryptionKey);

    const first = encryption.encrypt('same-token');
    const second = encryption.encrypt('same-token');

    expect(first).not.toBe(second);
  });

  it('rejects modified encrypted credentials', () => {
    const encryption = new CredentialEncryption(encryptionKey);
    const encrypted = encryption.encrypt('provider-secret-token');

    expect(() => encryption.decrypt(`${encrypted}modified`)).toThrow();
  });
});
