// ─── Device-scoped PHI encryption ───────────────────────────────
//
// Offline data (patient records, transcripts, briefs, outbox payloads)
// is PHI. We encrypt it at rest in IndexedDB with AES-256-GCM using a
// per-device key derived via PBKDF2 from a random secret + salt kept in
// localStorage. The CryptoKey is non-extractable, so it can never be
// exported from the WebCrypto context.
//
// Honest threat model: this protects against casual IndexedDB inspection
// (e.g. a copied database, an extension dump, forensic read of the
// profile). It does NOT protect against full device compromise — the
// seed material lives in the same origin's localStorage, so an attacker
// with JS execution in this origin can always read the data. It raises
// the bar and keeps plaintext PHI off disk.

const SECRET_KEY = 'jeevandata.device.secret';
const SALT_KEY = 'jeevandata.device.salt';

let cachedKeyPromise: Promise<CryptoKey> | null = null;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Returns the device-scoped AES-GCM key. Derives it once (PBKDF2, 100k
 * iterations) from a random secret + salt generated on first use and
 * persisted to localStorage.
 */
function getDeviceKey(): Promise<CryptoKey> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      // localStorage can be unavailable (Safari private mode, storage
      // disabled). Fall back to an in-memory-only key — PHI is then not
      // persisted across sessions, but encrypting in memory is still better
      // than plaintext, and the offline feature keeps working for the
      // session instead of crashing.
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        storage = null;
      }
      let secret = storage?.getItem(SECRET_KEY) ?? null;
      let salt = storage?.getItem(SALT_KEY) ?? null;
      if (!secret || !salt) {
        secret = randomHex(32);
        salt = randomHex(16);
        try {
          storage?.setItem(SECRET_KEY, secret);
          storage?.setItem(SALT_KEY, salt);
        } catch {
          // Best-effort persistence — key stays in memory for this session.
        }
      }
      const baseKey = await crypto.subtle.importKey(
        'raw',
        hexToBytes(secret) as BufferSource,
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: hexToBytes(salt) as BufferSource,
          iterations: 100_000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      );
    })();
  }
  return cachedKeyPromise;
}

/** Encrypts a JSON-serializable value. Returns `${ivB64}.${ciphertextB64}`. */
export async function encryptJson(value: unknown): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext,
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/** Decrypts a value produced by `encryptJson`. */
export async function decryptJson<T>(payload: string): Promise<T> {
  const key = await getDeviceKey();
  const [ivB64, ciphertextB64] = payload.split('.');
  const iv = fromBase64(ivB64) as BufferSource;
  const ciphertext = fromBase64(ciphertextB64) as BufferSource;
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** Re-exports for testing — allows tests to force a fresh device key. */
export const __cryptoInternal = {
  resetKey: () => {
    cachedKeyPromise = null;
  },
  hasKey: () => cachedKeyPromise !== null,
};
