import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptJson, decryptJson, __cryptoInternal } from '../crypto';

describe('device-scoped PHI encryption (crypto)', () => {
  beforeEach(() => {
    localStorage.clear();
    __cryptoInternal.resetKey();
  });

  afterEach(() => {
    localStorage.clear();
    __cryptoInternal.resetKey();
  });

  it('should round-trip a JSON value', async () => {
    const value = { name: 'Priya', mobile: '+919876543210', embedding: [0.1, 0.2, 0.3] };
    const encrypted = await encryptJson(value);
    const decrypted = await decryptJson<typeof value>(encrypted);
    expect(decrypted).toEqual(value);
  });

  it('should produce non-deterministic ciphertext for the same input', async () => {
    const a = await encryptJson({ secret: 'same' });
    const b = await encryptJson({ secret: 'same' });
    // Random IV per call — ciphertext must differ.
    expect(a).not.toBe(b);
  });

  it('should not contain the plaintext in the ciphertext', async () => {
    const encrypted = await encryptJson({ aadhaar: '123456789012', note: 'HIV positive' });
    expect(encrypted).not.toContain('123456789012');
    expect(encrypted).not.toContain('HIV');
  });

  it('should reuse a stable device key across calls', async () => {
    const first = await encryptJson({ v: 1 });
    // Key is cached after the first derivation — subsequent operations
    // decrypt fine with the same device identity.
    const decrypted = await decryptJson<{ v: number }>(first);
    expect(decrypted.v).toBe(1);
    expect(__cryptoInternal.hasKey()).toBe(true);
  });

  it('should fail to decrypt tampered ciphertext', async () => {
    const encrypted = await encryptJson({ v: 1 });
    const [iv, data] = encrypted.split('.');
    const tampered = `${iv}.${data.slice(0, -4)}xxxx`; // corrupt the tail
    await expect(decryptJson(tampered)).rejects.toThrow();
  });

  it('should fail to decrypt ciphertext from a different device key', async () => {
    const encrypted = await encryptJson({ v: 1 });
    // Reset the key (simulates a different device / cleared localStorage).
    __cryptoInternal.resetKey();
    localStorage.clear();
    await expect(decryptJson(encrypted)).rejects.toThrow();
  });

  it('should handle empty and null-like values', async () => {
    expect(await decryptJson<unknown>(await encryptJson({} as Record<string, unknown>))).toEqual(
      {},
    );
    expect(await decryptJson<null>(await encryptJson(null))).toBeNull();
  });
});
