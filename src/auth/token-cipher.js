import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'v1';

/**
 * Encrypts secrets (Google access/refresh tokens) before they are stored in PostgreSQL, so a
 * database dump alone does not expose access to anyone's calendar. AES-256-GCM, random IV per value.
 *
 * @param {string} secret Key material (TOKEN_ENCRYPTION_KEY, falling back to the JWT secret).
 */
export function createTokenCipher(secret) {
  const key = createHash('sha256').update(String(secret)).digest();

  return {
    /**
     * @param {string | null | undefined} plain Text to protect.
     * @returns {string | null} "v1:iv:tag:data" (base64url), or null for empty input.
     */
    encrypt(plain) {
      if (!plain) return null;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
      return [PREFIX, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
    },

    /**
     * @param {string | null | undefined} stored Value produced by encrypt().
     * @returns {string | null} Plain text, or null when empty or not decryptable (wrong key / tampered).
     */
    decrypt(stored) {
      if (!stored) return null;
      try {
        const [version, iv, tag, data] = stored.split(':');
        if (version !== PREFIX) return null;
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
      } catch {
        return null;
      }
    }
  };
}
